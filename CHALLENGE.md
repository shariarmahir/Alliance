# Client Specification Conformance — Complete Audit

Every clause of both client documents, checked against the code.

- *Working Principle – Price Request & Quotation Management* (14 items)
- *Invoice & Challan Management Working Principle* (Sections A, B, C)

Audited 2026-08-26 against commit `10a9fc5`.

**Audit result: 51 of 54 clauses met. 3 gaps, all in "loaded automatically".**

**All three are now closed — 54 of 54.** The fixes are described under
"The three gaps" below; each entry names what was wrong and what replaced it.

---

## Document 1 — Price Request & Quotation Management

| # | Clause | Status | Where |
|---|---|---|---|
| 1 | New requests display in **Inbox** | ✅ | `quotations-client.tsx` — status defaults to `inbox` |
| 2 | **View** shows customer info, items, specs, quantity | ✅ | `QuotationDetailDialog` |
| 3 | **Prepare** opens a window for prices, terms, delivery, payment, validity | ✅ | `ConfirmationPanel` + 7 `TERM_FIELDS` |
| 4 | **Save** transfers automatically to **Pending** | ✅ | `confirm=false` → `pending` |
| 5 | From Pending: review & edit options | ✅ | Stage-aware row |
| 6 | **View** the complete quotation | ✅ | |
| 7 | **Edit** or correct before submission | ✅ | Edit button on Pending |
| 8 | **Generate/preview** the Formal Quotation | ✅ | Preview PDF |
| 9 | **Send E-mail** to the customer | ✅ | `SendQuotationButton` |
| 10 | Successful send → status becomes **Submitted** | ✅ | Server-side on confirmed send |
| 11 | Customer accepts → **Order Confirmed** | ✅ | Confirm Order button |
| 12 | Revise quotation against the confirmed Work Order/PO | ✅ | Edit remains on Submitted |
| 13 | **Upload & save** the customer's Work Order / PO | ✅ | `WorkOrderDialog` |
| 14 | Complete history kept for audit | ✅ | `OrderHistoryDialog` |
| — | Tabs: Inbox │ Pending │ Submitted │ Order Confirmed │ Cancelled │ All | ✅ | Exact match |

**14 of 14 met.**

---

## Document 2, Section A — Invoice

| # | Clause | Status | Where |
|---|---|---|---|
| 1–2 | All confirmed orders available for invoicing | ✅ | `_confirmed_order()` |
| 3 | Customer info, **Work Order/PO No.**, quotation ref, items, qty, unit price, commercial terms **loaded automatically** | ⚠️ **GAP 1** | PO No. and terms never shown in the prepare window |
| 4–5 | **Prepare Invoice** opens the preparation window | ✅ | `PrepareInvoiceDialog` |
| 6 | Select items and quantities | ✅ | Defaults to what is unbilled |
| 7 | Auto-calculate Item Amount → Subtotal → Discount → VAT/Tax → Other Charges → Grand Total | ✅ | `compute_totals()`, tax after discount |
| 8–10 | **Save** → stored in Pending | ✅ | |
| 11–12 | From Pending: **View, Edit, Delete/Cancel, Preview, Print** | ✅ | Cancel keeps the record, by decision |
| 13 | Corrections before final approval | ✅ | Backend 409s on an approved invoice |
| 14–16 | **Approve** assigns final Invoice Number and Date | ✅ | Numbers assigned at approval, never at draft |
| 17–18 | Printed, downloaded as PDF, **or sent by e-mail** | ✅ | `DocumentActions` + `SendInvoiceButton` |
| 19 | Successful submission → **Submitted** | ✅ | Only on a confirmed send |
| 20–21 | Unpaid → Partially Paid → Paid | ✅ | Derived from arithmetic |
| 22 | Payment date, amount, method/reference, outstanding balance | ✅ | `InvoicePayment` |
| 23–24 | Fully paid → **Completed**, kept for audit | ✅ | Complete button + Completed tab |
| — | Tabs: Pending │ Submitted │ Partially Paid │ Paid │ Cancelled │ All | ✅ | Plus Completed, for item 24 |

**23 of 24 met. 1 gap.**

---

## Document 2, Section B — Challan

| # | Clause | Status | Where |
|---|---|---|---|
| 1–2 | Starts from the confirmed Work Order/PO | ✅ | |
| 3 | Customer, **delivery address**, PO/WO reference, ordered items **loaded automatically** | ⚠️ **GAP 2** | Address prefills the country only; no PO/WO shown |
| 4–6 | **Prepare Challan**, select delivery items | ✅ | `PrepareChallanDialog` |
| 7–8 | Quantity control: Order → Previous Delivered → Current → Balance | ✅ | Four columns, `order_balances()` |
| — | Important when one order ships in several challans | ✅ | `exclude_challan` |
| — | **Save as Pending** before dispatch | ✅ | |
| — | **View, Edit, Preview, Print, Cancel** before finalisation | ✅ | `challan-dialogs.tsx` |
| — | **Approve** generates Challan Number and Date | ✅ | |
| — | Dispatch records date, vehicle, driver, receiver, remarks | ✅ | `DispatchDialog` — all five |
| — | After dispatch → **Dispatched** | ✅ | |
| — | Customer confirms → **Delivered** | ✅ | `DeliverDialog` |
| — | Signed/received challan can be uploaded | ✅ | |
| — | Partial delivery leaves the remainder for the next challan | ✅ | Derived balances |
| — | Total delivered → order becomes **Completed** automatically | ✅ | `delivery_is_complete()` |
| — | Tabs: Pending │ Dispatched │ Delivered │ Cancelled │ All | ✅ | Exact match |

**15 of 16 met. 1 gap.**

---

## Document 2, Section C — Combined Document Flow

| Quick option | Status |
|---|---|
| View Order | ✅ |
| View Quotation | ✅ |
| Prepare Invoice | ✅ Deep-links with the order preselected |
| Prepare Challan | ✅ Same |
| View Documents | ✅ `OrderDocumentsDialog` |
| Upload Document | ✅ `WorkOrderDialog` |
| Order History | ✅ `OrderHistoryDialog` |
| Chain: Price Request → … → Completed | ⚠️ **GAP 3** — no single screen shows the chain's position |

**7 of 8 met. 1 gap.**

---

# The three gaps

All three are the same omission: **"loaded automatically" is only partly honoured.**
Every workflow, status, document and calculation is conformant. What is missing
is context that should appear without being looked up.

## GAP 1 — Invoice prepare window omits PO No. and commercial terms

Section A item 3 requires the Work Order/PO number, quotation reference and
commercial terms to load automatically. The window loads lines and prices, and
the order selector shows only `refNumber · companyName`.

An admin invoicing against a customer PO has to leave the screen to find that
number — and the PO number is normally what the customer's accounts department
matches the invoice against before paying it.

**Fix:** an order summary panel in the prepare window — customer, quotation
ref, PO No., and the confirmed commercial terms — populated on selection.

## GAP 2 — Challan prepare window prefills only the country as the address

`setAddress(order?.details.country ?? "")` puts *"Bangladesh"* in the delivery
address field. Section B item 3 requires the delivery address to load
automatically. A country is not a delivery address, and this one is prefilled
convincingly enough to be dispatched unchanged.

The quotation holds `companyName`, `fullName`, `phone` and `country`; there is
no street address on a price request, so the honest fix composes what exists
and marks it as needing completion rather than pretending it is an address.

**Fix:** compose company / contact / phone / country into the field, and show
the PO No. and quotation ref alongside it.

## GAP 3 — The combined flow has no single view

Section C describes one connected chain:

```
Price Request → Quotation → Submitted → Order Confirmed → Work Order/PO
             → Invoice → Challan → Payment/Delivery → Completed
```

Order History lists the events, but nothing shows **where an order currently
sits** in that chain, or what the next step is. That is the "better control"
the section asks for.

**Fix:** a progress strip at the top of the Order History dialog, marking each
stage done, current, or pending.

---

# Resolution

All three closed in `order-summary.tsx` and `order-history-dialog.tsx`:

1. **`OrderSummary`** — customer, contact, quotation ref and PO No. appear as
   soon as an order is selected, in both prepare windows. Commercial terms
   show on the invoice only; a challan carries no prices. An order with no PO
   yet reads "Not received" in amber rather than showing an empty field that
   looks like missing data.

2. **`composeDeliveryAddress()`** — company, contact, phone and country, one
   per line, instead of the bare country. The field is now a textarea, since
   the single-line input silently hid everything past the first line. This
   does not invent a street address the record has never held; it presents
   what exists and leaves the rest to be typed.

3. **`FlowStrip`** — Section C's nine stages across the top of Order History,
   each marked done, current, or pending. Derived from the events already
   fetched rather than a stored stage column, so it cannot disagree with the
   documents underneath it.

**Verified:** 339 backend tests, typecheck clean, lint 0 errors, build
successful.

Nothing else in either document is outstanding.
