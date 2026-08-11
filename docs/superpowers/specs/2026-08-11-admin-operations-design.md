# Operations Management — Design Spec

**Phase 3 of 4** in the Super Admin / Sub-Admin system. Builds on Phase 1 (auth/shell/analytics) and Phase 2 (product/catalog, JSON-file data layer pattern). This phase gives Super Admin the ability to manage order and quotation status, view contact requests, and browse a mock email inbox. All of this is Super Admin only — none of it is in the sub-admin's permitted surface (products/stock/hero-images), consistent with Phase 1's RBAC design.

## Background & Constraints

- **The core problem this phase solves**: orders and quotations currently exist only in each customer's own browser `localStorage` (`alliance_order`, `alliance_quotation`, `alliance_quote` keys) — there is no server record at all. An admin "confirm/cancel orders" screen is impossible against that data. This phase moves orders and quotations to server-side JSON storage, the same pattern Phase 2 established for the product catalog (`data/*.json`, read/written via Route Handlers using `fs`).
- Two stale, unused API routes exist (`app/api/quotes/route.ts`, `app/api/orders/route.ts`) with an old schema mismatched to the current cart-based `QuoteItem`/`Order`/`QuotationDetails` types (a leftover from an earlier single-product-flow session). They are replaced by this phase's new routes with correct schemas.
- No real contact form exists on the storefront today — the landing page's "Contact Us" button just links to `/products`. This phase adds a genuine `/contact` page.
- No real email service exists or is being integrated this phase. The "Emails" admin screen is an explicitly mock/demo inbox view, seeded with sample data, clearly commented as a UI preview — not wired to any real mailbox.
- Same filesystem-write caveat as Phase 2: works in local dev/traditional hosting, not on read-only-filesystem serverless hosts. Already an accepted tradeoff, not re-litigated here.

## Architecture

### Data layer additions

New files under `data/` (repo root, alongside `products.json`/`categories.json`):
- `data/orders.json` — array of `Order` records (extended, see Types below)
- `data/quotations.json` — array of `Quotation` records (a `QuotationDetails` + its `QuoteItem[]` + status, see Types below)
- `data/contact-requests.json` — array of `ContactRequest` records
- `data/emails.json` — seeded mock inbox data (see Mock Email Inbox below)

`app/lib/admin-operations.ts` (server-only, mirrors Phase 2's `admin-catalog.ts` pattern):
```typescript
import "server-only";
import fs from "fs/promises";
import path from "path";
import type { Order, Quotation, ContactRequest, OrderStatus, QuotationStatus } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");

export async function readOrders(): Promise<Order[]> { /* fs.readFile + JSON.parse */ }
export async function writeOrders(orders: Order[]): Promise<void> { /* ... */ }
export async function addOrder(order: Order): Promise<void> { /* append, status defaults to "pending" */ }
export async function updateOrderStatus(orderNumber: string, status: OrderStatus): Promise<void> { /* ... */ }

export async function readQuotations(): Promise<Quotation[]> { /* ... */ }
export async function writeQuotations(quotations: Quotation[]): Promise<void> { /* ... */ }
export async function addQuotation(quotation: Quotation): Promise<void> { /* append, status defaults to "pending" */ }
export async function updateQuotationStatus(id: string, status: QuotationStatus): Promise<void> { /* ... */ }

export async function readContactRequests(): Promise<ContactRequest[]> { /* ... */ }
export async function addContactRequest(request: ContactRequest): Promise<void> { /* ... */ }
export async function markContactRequestHandled(id: string, handled: boolean): Promise<void> { /* ... */ }
```

### Types (additions to `app/lib/types.ts`)

```typescript
export type OrderStatus = "pending" | "confirmed" | "cancelled";
export type QuotationStatus = "pending" | "confirmed" | "cancelled";

// Order gains server-side identity and status. All existing fields kept as-is.
export type Order = {
  // ...existing fields unchanged (orderNumber, trackingId, items, subtotal, shippingCost,
  //     grandTotal, deliveryOption, deliveryOptionName, deliveryEta, preferredDate, address, placedAt)...
  status: OrderStatus; // NEW — defaults to "pending" on creation
};

// A submitted quotation, now persisted server-side (was previously sessionStorage-only).
export type Quotation = {
  id: string; // crypto.randomUUID()
  items: QuoteItem[];
  total: number;
  details: QuotationDetails; // existing type, unchanged
  status: QuotationStatus; // defaults to "pending"
};

export type ContactRequest = {
  id: string;
  name: string;
  email: string;
  subject: string;
  message: string;
  submittedAt: string; // ISO
  handled: boolean; // admin marks true once actioned
};

// Mock inbox entry — explicitly NOT a real email integration, UI preview only.
export type MockEmail = {
  id: string;
  from: string;
  subject: string;
  preview: string;
  receivedAt: string; // ISO
  status: "pending" | "received"; // matches user's literal "pending email, received email" wording
};
```

### Storefront changes (minimal, additive — no breaking changes to existing flows)

1. **`app/(site)/order/confirm/page.tsx`**: after building the `Order` object (currently only written to `localStorage` + navigates to success), also `POST /api/orders` with the full order payload (status defaults to `"pending"` server-side). The existing `localStorage` write and `router.push` to the success page are unchanged — success/invoice page keeps working exactly as today, reading from `localStorage` for its own display. The POST is fire-and-forget from the UI's perspective (awaited but its failure doesn't block navigation — show a toast warning if it fails, since the local order experience should not break for the customer even if the server write fails).
2. **`app/(site)/quote/page.tsx`**: after building the `QuotationDetails` (currently only written to `sessionStorage`), also `POST /api/quotations` with the full `{ items, total, details }` payload before navigating to `/order/confirm`. Same fire-and-forget-with-toast-on-failure pattern.
3. **New `app/(site)/contact/page.tsx`**: a real contact form (name, email, subject, message — all required) styled consistently with the existing `QuotationForm`'s card sections. Submits to `POST /api/contact`. On success, shows a confirmation state (not a redirect — stays on page with a success message, since there's nothing further for the visitor to do).
4. **Landing page "Contact Us" button** (`app/(site)/page.tsx:204`): changed from linking to `/products` to linking to `/contact` — this was clearly a placeholder link (a "Contact Us" button going to the product catalog doesn't make sense), now fixed to point at the real page.

### Route Handlers (new, replacing the two stale ones)

- `app/api/orders/route.ts` — **rewritten**. `POST`: validates body against the current `Order` shape (zod schema matching the real type, not the old stale one), calls `addOrder` with `status: "pending"`. Returns 201.
- `app/api/quotations/route.ts` — **new** (`app/api/quotes/route.ts`'s old stale file is deleted, replaced by this correctly-named/shaped route). `POST`: validates `{ items, total, details }`, calls `addQuotation` with `status: "pending"`. Returns 201.
- `app/api/contact/route.ts` — **new**. `POST`: validates `{ name, email, subject, message }`, calls `addContactRequest`. Returns 201.
- `app/api/admin/orders/[orderNumber]/status/route.ts` — **new**. `PATCH`, body `{ status: OrderStatus }`. Admin-session-gated (super only — checks role, not just presence, per Phase 2's defense-in-depth pattern). Calls `updateOrderStatus`.
- `app/api/admin/quotations/[id]/status/route.ts` — **new**. Same pattern for quotations.
- `app/api/admin/contact-requests/[id]/handled/route.ts` — **new**. `PATCH`, body `{ handled: boolean }`. Admin-session-gated.

All admin-mutation routes follow Phase 1/2's established pattern: read `alliance_admin_session` cookie via the shared `app/api/admin/_auth.ts` helper, 401 if missing, and — since every screen in this phase is super-only — 403 if role is `"sub"`.

### UI — Admin Orders Page (`app/admin/(dashboard)/orders/page.tsx`, new — activates the currently-inert "Orders" nav link)

Table: order number, customer name (from `address.name`), item count, grand total, placed date, status badge. Row actions: "Confirm" / "Cancel" buttons (only shown when status is `"pending"`; a confirmed/cancelled order shows its final badge with no further actions — no un-confirming, matching the simple two-terminal-state workflow decided). A filter tab bar (All / Pending / Confirmed / Cancelled) using the existing `Tabs` primitive, consistent with Phase 1's Revenue chart range toggle pattern.

### UI — Admin Quotations Page (`app/admin/(dashboard)/quotations/page.tsx`, new — activates "Quotations" nav link)

Same table/filter/action pattern as Orders, adapted to quotation fields: contact name (`details.fullName`), company (`details.companyName`), item count, estimated total, submitted date, status badge, Confirm/Cancel actions. Clicking a row expands (or opens a dialog, reusing Phase 2's newly-added `Dialog` component) showing full quotation details — all items with quantities/prices, and the full contact/company/preferences form data — since this is the richest record type and a table row alone can't show everything.

### UI — Admin Contact Requests Page (`app/admin/(dashboard)/contact-requests/page.tsx`, new — activates "Contact Requests" nav link)

List of submissions (name, email, subject, message preview, submitted date), each with a "Mark Handled" / "Mark Unhandled" toggle button. Filter tabs (All / Unhandled / Handled). No status workflow beyond the boolean — this is simpler than orders/quotations by design, matching how lightweight a contact inquiry is compared to a commercial transaction.

### UI — Admin Emails Page (`app/admin/(dashboard)/emails/page.tsx`, new — activates "Emails" nav link)

Two-column inbox-style layout: a list of mock emails on the left (sender, subject, preview, received date, a "Pending"/"Received" status pill) and a detail pane on the right showing the selected email's full content. Seeded from `data/emails.json` with realistic sample entries (e.g. supplier inquiries, shipping notifications — content that fits Alliance's industrial-electronics domain). Page header includes a visible note: *"Preview only — not connected to a live mailbox."* No send/reply capability (out of scope — this is a tracking/preview surface per the user's literal "pending email, received email" wording, not a full email client).

### Nav updates

`app/admin/nav-config.ts`: flip `enabled: false → true` for Orders, Quotations, Contact Requests, Emails (all already `roles: ["super"]` from Phase 1 — no RBAC change needed, sub-admin continues to not see these at all).

## Error Handling

- Fire-and-forget server POSTs from the storefront (order confirm, quotation submit) never block the customer's local flow — a failed POST shows a toast warning but the customer still reaches their success/confirmation page using local data, consistent with this being a non-critical enhancement layer over the working local-first flow.
- Admin status-change actions (Confirm/Cancel) are synchronous with a loading state on the clicked button; on failure, a toast error and the row stays in its previous state (optimistic-free — wait for server confirmation before updating the badge, since this is a real business-state change, not cosmetic).
- Contact form validation: required-field + email-format checks client-side (matching `QuotationForm`'s existing pattern) plus server-side zod validation as the source of truth.

## Testing Approach

- `npx tsc --noEmit` and `npm run lint` clean before each commit.
- Live browser verification (Chrome DevTools MCP):
  - Full customer flow: add to cart → submit quotation → confirm order → verify the order now appears in the admin Orders table with status "Pending", and the quotation appears in admin Quotations with status "Pending".
  - Admin confirms an order → verify status badge updates, Confirm/Cancel buttons disappear, filter tabs reflect the count change.
  - Admin cancels a quotation → same verification.
  - Submit the new `/contact` form → verify it appears in admin Contact Requests; mark it handled → verify toggle persists on refresh.
  - Emails page renders seeded mock data correctly, detail pane updates on selection, "preview only" notice is visible.
  - Sub-admin login → confirm Orders/Quotations/Contact Requests/Emails are NOT visible in their sidebar at all (regression check — these must stay super-only, unlike Phase 2's Products/Stock/Hero Images which sub-admin can use).
  - Landing page "Contact Us" button → verify it now navigates to `/contact`, not `/products`.

## Out of Scope (deferred)

- Real email service integration (sending, receiving, replying) — Emails page stays mock/preview.
- Order/quotation editing beyond status (no line-item changes, no address edits from admin).
- Multi-stage fulfillment pipeline (processing/shipped/delivered) — kept to the simple pending/confirmed/cancelled model per user's confirmed choice.
- Phase 4 (employee/task/leave system) — unchanged from the original 4-phase plan.
