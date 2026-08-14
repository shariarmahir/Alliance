# Storefront "Ask Price" Redesign — Design Spec

Date: 2026-08-15
Status: Approved by project owner, ready for implementation planning

## Background

A Claude Design handoff bundle (`Alliance Storefront.dc.html`, `Alliance Admin.dc.html`)
was provided as an HTML/CSS mockup to guide a visual redesign of the storefront and
admin dashboard. The bundle uses the wordmark "Alliance" and a price-free "Ask Price"
commercial flow, both of which conflict with decisions already made and documented in
`CLAUDE.md` (the AutoLink rebrand, and the existing quotation-cart flow that currently
still shows prices). This spec resolves those conflicts and scopes **only the storefront
half** of the bundle. The admin dashboard (`Alliance Admin.dc.html`) is a separate,
later project.

## Decisions

1. **Wordmark stays AutoLink.** The bundle's "Alliance" text is a 1:1 swap back to
   "AutoLink" everywhere (header, footer, invoice HTML, page copy). `info@alliance.com`
   → `info@autolink.com`, etc. — matching the existing rebrand already in the codebase.
2. **Pricing goes fully "Ask Price," price-free on the public storefront.** Product
   cards, PLP rows, PDP, and the quote/enquiry page never render `formatPrice()`.
   `Product.price` and `QuoteItem.price` stay in the data model unchanged. Order
   confirm, order success/invoice, tracking, and all admin views keep showing real
   numbers — those happen after an engineer has responded to the request, which is
   after the point where prices become relevant per the bundle's own IA (`Ask Price →
   quotation issued → Confirm order → Track delivery`).
3. **"Ask Price" is a relabel of the existing request-quote interaction, not a new
   flow.** Clicking "Ask Price" still calls the existing `addItem()` (via
   `useQuote()`) and routes to `/quote`. No new interaction patterns (no inline
   PLP-row quantity+price display, no new API routes, no new persisted fields).
4. **Scope order:** storefront first (this spec), admin dashboard is a separate
   follow-up spec/plan.
5. **Landing page follows the bundle's section list** (hero → stats bar → category
   grid → most-requested parts → protect-uptime → quality/trust → services → brands →
   difference → reviews → FAQ + contact → footer), reusing existing components
   (`CategoryGrid`, `BrandStrip`, `ClientReviews`, etc.) restyled to match, plus the
   few genuinely new sections (stats bar, most-requested grid, FAQ accordion).
6. **No product ratings/reviews are added to cards or PLP rows.** No rating data model
   exists for individual products (only site-wide client testimonials); fabricating
   mock ratings was explicitly rejected.
7. **Reuse existing image assets.** `public/images/categories/*.svg` and
   `public/images/brands/*.png` already cover what the bundle's `assets/cat/*` and
   `assets/brands/*` need. No new hero/factory/team photography is added — the
   existing `HeroCarousel` / homepage video continue to be used where the bundle
   references imagery that doesn't exist in the repo.
8. **Bundle variant selection: primary variants only.** Where the bundle shows
   multiple options for one screen (hero 1a vs 1g vs 1h; product card 1a vs 1i vs
   1j; mobile 1k), implement only the primary/first-listed variant (1a hero, the
   1a/1b card style, existing mobile header/drawer restyled). The alternates (1g,
   1h, 1i, 1j, 1k) are not built.

## Scope

### In scope (files touched)

**Restyled in place — same data contract, no logic changes:**
- `app/components/header-client.tsx`
- `app/components/footer.tsx`
- `app/components/product-card.tsx`
- `app/components/product-gallery.tsx`
- `app/components/product-filters.tsx`
- `app/components/quantity-stepper.tsx`
- `app/components/quote-cta.tsx` (PDP "Ask Price for this part" panel — relabel only,
  `addItem` + redirect to `/quote` unchanged)
- `app/components/hero-carousel.tsx` / `hero-carousel-client.tsx` (visual restyle to
  bundle's hero treatment; keep existing carousel data source)
- `app/components/category-grid.tsx`, `brand-strip.tsx`, `client-reviews*.tsx` (visual
  restyle only — keep the existing rotating-theme card pattern per CLAUDE.md)
- `app/(site)/page.tsx` — reordered/extended per decision 5
- `app/(site)/products/page.tsx`, `app/(site)/products/[slug]/page.tsx` — visual
  restyle, drop `formatPrice` usage
- `app/(site)/quote/page.tsx` (relabeled "Ask Price" page, bundle 1d layout) — drop
  price/subtotal display from the UI; existing submit-to-`/api/quotations` →
  `/order/confirm` flow unchanged
- `app/(site)/order/confirm/page.tsx`, `app/(site)/order/success/page.tsx`,
  `app/(site)/track/[trackingId]/page.tsx` — visual restyle to bundle 1e/1f; prices
  stay visible here (post-quote, decision 2)

**New (bundle sections without an existing equivalent):**
- A stats bar section on the landing page (ISO cert / parts catalogued / quote
  turnaround / warranty — static copy, no new data source)
- A "Most requested parts" grid section (reuses `ProductCard` + existing top-sellers
  data from `app/lib/top-sellers.ts`)
- An FAQ accordion, added alongside the existing "We Are Here To Help You" contact
  panel (that panel already covers the bundle's contact-form requirement, so it is
  extended rather than duplicated)

### Out of scope
- `Alliance Admin.dc.html` (admin dashboard) — separate future spec
- Any change to `data/*.json`, API routes, or the `Product`/`QuoteItem`/`Quotation`
  types
- Product ratings/reviews data model
- New photography assets
- Any bundle variant other than the primary one per screen (1g/1h/1i/1j/1k skipped)

## Verification

No new server logic or data fields are introduced, so verification is:
1. `npx tsc --noEmit` → `npm run lint` → `npm run build` (per CLAUDE.md, in that
   order) before considering the work done.
2. Manual click-through in `npm run dev`: homepage section-by-section, `/products`
   filtering, a product detail page, "Ask Price" → `/quote` → `/order/confirm` →
   `/order/success` → `/track/[id]`, confirming no price renders anywhere before
   `/order/confirm`, and that the mobile header/drawer still works.
3. No automated test suite exists in this repo; none is introduced here, consistent
   with the project's no-speculative-abstraction convention.
