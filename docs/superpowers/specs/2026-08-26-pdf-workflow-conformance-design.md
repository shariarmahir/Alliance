# Price Request, Quotation, Invoice & Challan — PDF conformance

Date: 2026-08-26

Brings the admin UI in line with the client's two specification documents:
*Working Principle – Price Request & Quotation Management* and
*Invoice & Challan Management Working Principle*.

## The problem

The backend implements both documents closely. The frontend does not surface
it. A seven-stage workflow was collapsed into a single button.

`ConfirmQuotationTrigger` renders as **"Accept"** and performs pricing entry,
terms capture, save, and order confirmation in one action. There is no
`Prepare` control anywhere in `quotations-client.tsx`.

The visible symptom: a request sits in **Pending** with **Quoted Total: —**.
Per the specification, Pending means "quotation prepared, awaiting send" — but
nothing was prepared, because the only path forward jumps straight to
confirmed.

Endpoints that exist, are deployed, and are unreachable from the UI:

| Endpoint | Specification reference |
|---|---|
| `POST /quotations/{id}/email` | Send E-mail → Submitted (item 10) |
| `POST /quotations/{id}/work-order` | Upload Work Order/PO (item 13) |
| `PATCH /quotations/{id}/work-order` | PO number capture |
| `POST /quotations/{id}/invoice/email` | Invoice by e-mail (item 18) |
| `POST /quotations/{id}/challan/email` | Challan dispatch |

Columns `po_number`, `po_document_url`, `po_uploaded_at` ship in migration
`a1c93f27e04b` with no interface to populate them.

## Scope

Frontend wiring plus two PDF renderers. Pricing arithmetic, the billing
service, quantity control, and both tab sets are already conformant and are
covered by 326 passing tests. They are not touched.

## 1. Stage-aware row actions

Each row shows only the actions valid for its stage. This is what makes the
tabs meaningful — today every tab renders identical buttons.

| Stage | Actions |
|---|---|
| Inbox | View · **Prepare** · Cancel |
| Pending | View · **Edit** · Preview PDF · **Send E-mail** · Cancel |
| Submitted | View · Preview PDF · **Confirm Order** · Cancel |
| Order Confirmed | View · Quotation PDF · **Upload Work Order/PO** · Prepare Invoice · Prepare Challan · **History** |
| Cancelled | View · Remove |

### Prepare saves without confirming

`ConfirmationPanel` already takes a `confirm` boolean (line 167) selecting
between save-only and save-and-confirm. Only the confirming path is ever
invoked. Exposing the other requires no new pricing logic.

Stage transitions follow the specification exactly:

```
inbox --Prepare/Save--> pending --Send E-mail--> submitted --Confirm--> confirmed
```

### Send E-mail is its own action

`POST /quotations/{id}/email` already calls `mark_quotation_submitted` on a
confirmed send. The status change on successful delivery — not on clicking —
is the specification's requirement, and it is already correct server-side.

## 2. Upload Work Order/PO

A dialog on confirmed rows capturing PO number and document, posting to the
existing endpoints. Accepts PDF, JPG, PNG, WEBP up to 15 MB per
`validate_document()`.

Once uploaded, the row shows the PO number and links the stored document, so
the confirmed record carries the customer's own paperwork — the specification's
"complete history" requirement.

## 3. Invoice and Challan PDFs

Two renderers in `app/integrations/pdf.py`, reusing `BASE_CSS`, `_header`,
`_footer`, `_customer_block`, and `amount_in_words` so all four documents share
one visual identity.

**`render_invoice_document_pdf(invoice, quotation)`** — line items, then
Subtotal → Discount → VAT/Tax → Other Charges → Grand Total in that order,
matching the arithmetic in `billing.compute_totals`. Recorded payments and
outstanding balance appear when any payment exists.

**`render_challan_document_pdf(challan, quotation, balances)`** — carries the
four-column quantity table the specification names:

```
Ordered → Previously Delivered → This Delivery → Balance
```

Previously-delivered excludes this challan's own lines, using
`order_balances(exclude_challan=...)`. Without that exclusion a saved challan
counts itself as prior delivery and every balance reads low.

Dispatch details (date, vehicle, driver, receiver) print when set. A challan
carries no prices — it is a delivery document, and pricing on it invites
disputes about goods in transit.

New endpoints: `GET /invoices/{id}/pdf`, `GET /challans/{id}/pdf`.

## 4. Order History

Section C of the invoice specification requires each confirmed record to offer
quick options and "complete traceability from the customer's initial inquiry".

A dialog assembling one timeline: the original request, the prepared quotation,
the send, the confirmation, the uploaded PO, and every invoice and challan
raised against it — each with its number, date, status and total.

Backed by `GET /quotations/{id}/history`, which reads existing tables. No new
storage: the events already exist as timestamps and rows.

## Non-goals

- Pricing, tax, or balance arithmetic — verified correct
- Tab sets — already match both specifications exactly
- Storefront — neither document concerns it
- Numbering — already assigned at approval, not at draft

## Testing

Router tests per new endpoint. Stage-transition tests asserting Prepare leaves
a quotation in `pending` (not `confirmed`) and that a failed e-mail send does
**not** advance to `submitted`. PDF tests assert bytes are produced and that a
challan's previously-delivered figure excludes its own lines.
