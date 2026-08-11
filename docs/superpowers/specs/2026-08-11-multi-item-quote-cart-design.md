# Multi-Item Quote Cart Migration — Design Spec

Status: Approved
Date: 2026-08-11

## Scope

Replaces the storefront's single-product "Request Quotation" flow (one product per
quote, sessionStorage-backed, server-validated via `/api/quotes` and `/api/orders`)
with a persistent multi-item quote cart (add products from listing/detail pages,
review/edit the cart, submit contact info, confirm delivery, get an order
confirmation with tracking + invoice), matching the architecture and UX of
user-supplied reference code for: products listing, product detail, `/quote`
cart-review page, `/order/confirm`, and `/order/success`.

This supersedes the "single-product quote flow" decisions recorded in the original
storefront design spec (2026-08-11-storefront-design.md) — the user explicitly
re-opened and reversed that decision for this iteration.

## Why

The user supplied reference code for the full listing → detail → quote → confirm →
success flow, all built around a multi-item cart context. Re-adapting it down to
single-product a third time (as was done for the header and top-sellers section)
would mean permanently diverging from code the user keeps bringing back — better to
adopt the real architecture now.

## Architecture

- **State**: React Context (`QuoteProvider` in `app/lib/quote-context.tsx`),
  `localStorage`-backed under key `alliance_quote`. No TanStack Query — nothing in
  this flow needs server-side cache/refetch semantics; the reference's
  `QueryClientProvider` wraps nothing that uses it, so it's dropped as an
  unnecessary dependency.
- **Order creation is fully client-side**: on confirm, one order object (items,
  totals, delivery choice, address, generated order/tracking numbers) is written to
  `localStorage` under `alliance_order`, matching the reference. No server
  round-trip. This retires `/api/quotes` and `/api/orders` — nothing calls them
  after migration, and per the user's explicit choice, dead code is deleted, not
  kept around unused.
- **Data model**: `Product` type (in `app/lib/types.ts`) gains `rating: number`,
  `reviewCount: number`, `oldPrice: number`, `sku: string`,
  `condition: "New" | "Refurbished" | "Repair / Exchange"`. These are added to
  every product in `mock-data.ts` (computed deterministically from existing index,
  same approach already used for price/stock/rank generation — no separate parallel
  dataset). This retires `app/lib/top-sellers.ts` and `top-seller-card.tsx`: the
  landing page's "Top Selling Products" section switches to real catalog products
  (already have `weekRank`/`monthRank`/`yearRank`) rendered with the existing
  `ProductCard`, extended to show a rating line and old-price strikethrough.
- **Tracking**: the reference's "Track Order Live" link points to a fabricated
  external domain that will never resolve. This build points it at our real,
  working mock tracking page (`/track/[trackingId]`) instead — same UX, functional
  link. `trackingId` is still generated client-side at order-confirm time in the
  same format the tracking page already expects.
- **Invoice**: generated as a standalone downloadable HTML file (matching the
  reference's approach) rather than the previous jsPDF-based PDF. This is simpler
  (no binary dependency, no font-embedding concerns) and matches what was supplied.
  `jspdf` dependency and `invoice-actions.tsx` are retired.

## Component/File Plan

**New:**
- `app/lib/quote-context.tsx` — `QuoteProvider`, `useQuote()` hook. Client component.
- `app/providers.tsx` — thin wrapper composing `QuoteProvider` (kept separate from
  `layout.tsx` so the client boundary is isolated to one small file, matching the
  reference's `providers.js` pattern minus the unused query client).
- `app/quote/page.tsx` — cart review + contact form (replaces
  `app/quote/[productSlug]/page.tsx`).
- `app/components/ui/checkbox.tsx`, `app/components/ui/slider.tsx` — shadcn
  components needed for listing-page filters (not yet installed).

**Rewritten:**
- `app/products/page.tsx` — client-side filtered/sorted listing (category, brand,
  condition checkboxes; price slider; in-stock toggle; sort select), replacing the
  server-component + `ProductFilters` client-component split. Filtering logic moves
  fully client-side since it now operates on the in-memory `PRODUCTS` array exactly
  like the reference, no `searchParams`-driven server filtering needed beyond
  reading the initial `?category=`/`?q=` values.
- `app/products/[slug]/page.tsx` — gallery with thumbnail switcher, rating +
  SKU + condition badge, quantity stepper, "Request Quotation" now calls
  `addItem(product, qty)` then routes to `/quote` instead of `/quote/[slug]`,
  WhatsApp inline CTA, tabs (Description/Specifications/Reviews), related products.
- `app/order/confirm/page.tsx` — reads cart from `useQuote()`, delivery address
  form, 3-tier delivery options (Standard/Express/Priority Air, matching reference
  costs/ETAs), builds and persists the order object, clears cart, redirects to
  `/order/success`.
- `app/order/success/page.tsx` — reads persisted order from `localStorage`, order
  info cards, tracking link to `/track/[trackingId]`, downloadable HTML invoice,
  print, continue shopping.
- `app/components/header.tsx` — add "My Quote" link with live `count` badge from
  `useQuote()`.
- `app/lib/types.ts` — extended `Product` type as above.
- `app/lib/mock-data.ts` — products gain the new fields.
- `app/page.tsx` — "Top Selling Products" section switches from `topSellers`/
  `TopSellerCard` to real ranked `Product` records via existing `ProductCard`.
- `app/components/product-card.tsx` — extended to show `RatingStars` and
  `oldPrice` strikethrough (fields now exist on `Product`), "Request Quotation"
  becomes an `addItem` action button (still a link-styled button, but triggers
  cart add first) rather than a navigation-only link.

**Deleted** (nothing references them after migration):
`app/quote/[productSlug]/page.tsx`, `app/lib/quote-store.ts`,
`app/components/quote-cta.tsx`, `app/components/quote-form.tsx`,
`app/components/quantity-stepper.tsx` (superseded by inline qty controls built
directly into detail/quote/confirm pages), `app/components/delivery-options.tsx`,
`app/components/invoice-actions.tsx`, `app/components/product-filters.tsx`,
`app/lib/top-sellers.ts`, `app/components/top-seller-card.tsx`,
`app/api/quotes/route.ts`, `app/api/products/route.ts`,
`app/api/products/[slug]/route.ts`, `app/api/orders/route.ts`, `jspdf` dependency.

## Error handling

- `/quote` with an empty cart: friendly empty-state (icon + message + "Browse
  Products" CTA), matching reference — no redirect-with-toast needed since it's a
  valid state, not an error.
- `/order/confirm` with an empty cart: redirect to `/quote` (cart was cleared or
  never populated — nothing to confirm).
- `/order/success` with no persisted order: friendly "No recent order found" state
  with a link back to `/products` — not a hard error page, since arriving here
  directly (bookmarked, back button after clearing storage) is a normal navigation
  case, not a bug.
- `/products/[slug]` with invalid slug: existing `notFound()` behavior unchanged.
- `localStorage` reads wrapped in `try/catch` per the reference (private browsing /
  storage-disabled edge cases fail soft to empty cart rather than crashing).

## Testing approach

Manual verification via dev server: walk the full golden path (browse with filters
→ product detail → add to quote → cart review with qty edit/remove → contact info
→ confirm order with delivery option → success page → tracking link → invoice
download/print). Confirm `tsc --noEmit` and lint clean. Confirm no dead imports
remain after deletions (`tsc` will catch missing-module errors; grep confirms no
lingering references to deleted files).
