# Client Specification Conformance — Complete Audit

Every clause of both client documents, checked against the code.

- *Working Principle – Price Request & Quotation Management* (14 items)
- *Invoice & Challan Management Working Principle* (Sections A, B, C)

Audited 2026-08-26 against commit `10a9fc5`.

**Audit result: 51 of 54 clauses met. 3 gaps, all in "loaded automatically".**

**All three are now closed — 54 of 54.** The fixes are described under
"The three gaps" below; each entry names what was wrong and what replaced it.

> **Second pass, same date — a further audit found a defect class the first
> pass could not see.** The tables below check that each clause has a
> *feature*. They do not check that the **arrows between them are enforced**.
> They were not. See "Pass 2 — the workflow arrows" at the end of this file.

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

---

# Pass 2 — the workflow arrows

The audit above asks, for each clause, *does this feature exist?* Every answer
was yes. But both documents specify a **chain**, not a set of buttons:

```
Approve → Generate Invoice → Send/Print → Submitted → Payment Status → Completed
Approve → Generate Challan → Dispatch → Delivered → Completed
```

The arrows are part of the specification. Nothing was enforcing them.

`PATCH /invoices/{id}/status` and `PATCH /challans/{id}/status` wrote the new
status straight to the column. Pydantic checked that the value was one of the
six spelled correctly — not that the move was legal. Every transition below
returned **200 OK**, confirmed by running them:

| Illegal move | What it costs |
|---|---|
| pending → `completed` | An unpaid invoice filed as Completed. The money is still owed and now appears on no outstanding list. |
| partially_paid → `cancelled` | Receipts recorded against a document that no longer exists. |
| pending → `paid` | The badge says Paid; the payments table says nothing was received. Item 21's chain becomes decorative. |
| pending → `delivered` (challan) | Delivered with no dispatch: no vehicle, no driver, no delivery date. Section B items for Dispatch are simply skipped. |
| delivered → `cancelled` | The goods are with the customer, and the quantity returns to the order balance — so the order shows stock still owed that has already gone. |

The last one is the worst: it corrupts the quantity arithmetic that Section B
item 8 exists to protect.

## Why the first pass missed it

Feature-presence auditing cannot see this. "Can an invoice be cancelled?" —
yes, there is a button and an endpoint. The question that finds the defect is
"**can it be cancelled when it must not be?**", which only a written test
answers.

## The fix

`_guard_transition()` in `app/services/billing.py`, applied in the service
rather than the router so no future caller can route around it.

Two statuses are deliberately unreachable by hand: **`partially_paid` and
`paid` are conclusions drawn from the payments recorded**, never assertions an
admin makes. `record_payment()` already derived them correctly; now nothing
else can overwrite what it derived.

Dispatch and delivery are likewise not settable through the status field —
they carry evidence (vehicle, driver, signed copy) and are recorded through
their own endpoints, which collect it.

The two Cancel buttons were corrected to match: the invoice's now appears only
on Pending and Submitted, the challan's only on Pending. Both screens now show
the backend's own refusal message instead of a generic failure.

**Six tests added, each one failing with 200 OK before the fix and passing
after. 345 backend tests, typecheck clean, lint 0 errors, build successful.**

---

# Pass 3 — the missing mirror

Pass 2 fixed the arrows between statuses. This pass asked a different
question: **where the two documents do the same job, does the code treat
them the same way?**

One place it did not. `create_challan()` calls `_guard_quantities()` and
refuses to ship more than the order still owes. `create_invoice()` had no
equivalent — nothing checked billed quantities against ordered ones.

Confirmed by test: an order for 10 units, invoiced twice for 10 units each,
returned **201 Created** both times. **The customer is billed twice for one
order**, and the second invoice looks exactly as legitimate as the first —
there is nothing on the document to show the quantity was already invoiced.

The figure needed to prevent this already existed. `order_balances()` has
returned an `uninvoiced` value all along, and the Prepare Invoice window uses
it to default the quantity. It was displayed but never enforced, so it guided
the normal path and stopped nothing on the abnormal one.

**Fix:** `OverBilling` and `_guard_invoice_quantities()`, mirroring
`OverDelivery` exactly, applied to both create and edit. The edit path
excludes the invoice's own lines from the billed figure — otherwise raising a
draft back to the full ordered quantity would fail against the balance it had
itself consumed. Both cases are covered by test: editing up to the ordered
quantity passes, one unit past it is refused.

**347 backend tests, typecheck clean, lint 0 errors, build successful.**
