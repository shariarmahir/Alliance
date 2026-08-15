# Storefront Pixel-Faithful Rebuild — Design Spec

Date: 2026-08-15
Status: Approved by project owner, ready for implementation planning

## Background

The user provided `Alliance Storefront.dc.html`, a Claude Design mockup, and asked
for the storefront to match it "exactly" — not just the content/copy changes made in
the prior "Ask Price" redesign (`2026-08-15-storefront-ask-price-redesign-design.md`,
already merged to `master`), but the actual visual structure: spacing, typography
scale, layout grids, header/footer chrome, and per-screen composition. The prior
work correctly removed prices and relabeled CTAs, but did not restructure the
underlying layout to match the mockup's proportions — this spec covers that gap.

This is a large, separate effort from the prior pass and is scoped as its own
project per the user's choice to run a full brainstorm → spec → plan cycle before
implementation.

## Scope

Six primary-variant screens from the mockup, matching what was approved for the
prior project (alternate variants 1g/1h/1i/1j/1k are explicitly out of scope):

1. **1a** — Landing page (header, hero, category grid, most-requested, sections below the fold, footer)
2. **1b** — Product listing page
3. **1c** — Product detail page
4. **1d** — Ask Price page
5. **1e** — Order confirm page
6. **1f** — Order success page

## Decisions

1. **Wordmark stays AutoLink.** Every "Alliance" string in the mockup (wordmark,
   `info@alliance.com`, "About Alliance", copyright line) maps 1:1 to "AutoLink" /
   `info@autolink.com` / "About AutoLink" / the existing AutoLink copyright line —
   consistent with the prior project and CLAUDE.md's permanent rebrand.
2. **Hero stays a carousel, restyled.** The mockup's hero (1a) is a single static
   image with no embedded search bar. The live site has a real 3-slide auto-rotating
   carousel with dot navigation — genuine functionality not present in the mockup.
   Decision: keep the carousel mechanism, but restyle each slide to the mockup's
   proportions and remove the embedded search bar (search still exists in the header).
   Add the mockup's secondary "Browse the catalogue" button next to the primary CTA.
   Replace the current stats band (50,000+ Parts / 100+ Countries / 48 hrs / 24/7,
   on a `bg-primary` dark band) with the mockup's exact 4 stats — QUALITY SYSTEM "ISO
   9001:2015", PARTS CATALOGUED "50,000+" (adjusted from mockup's 42,000+ to match
   the site's existing claimed catalog size), QUOTE TURNAROUND "4 working hours",
   WARRANTY "2 years" — on the mockup's light `#f7f9fc` 4-column strip styling, not
   the dark band.
3. **Header nav row uses the mockup's exact static link labels — literally, per
   user override.** Initial recommendation was to keep real dynamic category links
   in the mockup's visual style; the user explicitly overrode this and confirmed
   the nav must show the mockup's literal link set: `All Products / Brands &
   Manufacturers / Repair & Exchange / Services / Sell Us Your Parts / About
   Alliance` (rendered as "About AutoLink" per decision 1's wordmark mapping), on
   white background with the WhatsApp callout on the right, matching the mockup's
   exact spacing/typography. "All Products" links to `/products` (existing route).
   The other four links point to new minimal stub pages — see decision 3a. The
   current blue category-pill bar (dropdown "All Categories" + dynamic category
   links) is removed from this nav position; category browsing still exists via
   the category grid section on the homepage and the PLP filter rail, so no
   navigation capability is lost, only this specific header row's content changes.
3a. **New stub pages for the four non-`/products` nav links.** Per user decision,
   each of `Brands & Manufacturers`, `Repair & Exchange`, `Services`, `Sell Us
   Your Parts`, and `About AutoLink` gets a real route (proposed:
   `/brands`, `/repair-exchange`, `/services`, `/sell-your-parts`, `/about`) with
   a minimal placeholder page (heading, one paragraph of AutoLink-appropriate
   copy, no "Coming soon" filler language — a short, genuine description of what
   the section will cover) rather than a dead `#` link or a 404. These stubs are
   intentionally minimal — no new data fetching, no admin editability, just static
   JSX — since building out full content for five new sections is explicitly out
   of scope for this visual-rebuild project.
4. **PLP switches from card grid to horizontal spec-row layout.** The mockup's 1b
   product listing is NOT a card grid — it's a stacked list of wide rows, each row a
   3-column grid (`132px thumbnail | 1fr details | 232px stock/qty/CTA column`).
   The live site currently renders a 2-3 column card grid (`ProductCard`). This is a
   structural change: `ProductCard` will be replaced by a new row-layout component
   for the PLP specifically (existing `ProductCard` may still be reused elsewhere —
   homepage sections keep using card-style components, only the PLP body changes to
   rows). Filter rail structure stays (manufacturer/part-number/description/category
   filters, brand checkbox list) but gets the mockup's exact spacing/typography.
5. **PDP restyled to mockup's exact two-column proportions.** Left column fixed at
   ~520px for gallery (main image + thumbnail strip), right column flexible for
   details. Spec table, documents panel, and "Engineers also asked about" cross-sell
   grid all restyled to match spacing/typography, keeping existing data-driven
   content (specifications table rows, related products) — no new data added.
6. **Ask Price page (1d) restyled to mockup's 4-step progress bar + part-row table.**
   Existing `/quote` page keeps its `useQuote()`/`addItem()`/submit-to-`/api/quotations`
   mechanics untouched (already correct per the prior spec) — only markup/layout
   changes to match the mockup's request-list table, step indicator, and sticky
   summary card styling.
7. **Confirm/Success (1e/1f) get a visual-only polish pass.** Content is already
   correct from the prior project (headings, copy, price visibility). This pass
   aligns spacing, card styling, and the timeline/stepper visual treatment on the
   success page to the mockup's exact layout.
8. **No data model, API route, or type changes anywhere in this project.** Same
   hard constraint as the prior project — this is presentation-layer only.
9. **Reuse existing image/icon assets.** No new photography; category SVGs and
   brand PNGs already in `public/images/` continue to be used.
10. **Footer needs only minor alignment**, not a rebuild — the live footer already
    has a 5-column dark layout structurally close to the mockup's (brand blurb +
    CATALOGUE + SERVICES + COMPANY + STOCK & PRICE ALERTS columns). This pass aligns
    exact link labels/order to the mockup where they don't already match, and
    confirms spacing/typography, but is not a structural rebuild like the PLP.

## Out of Scope

- Admin dashboard (`Alliance Admin.dc.html`) — separate, not requested here.
- Any alternate mockup variant (1g, 1h, 1i, 1j, 1k).
- New photography, new data fields, new API routes, new types.
- Full content for the five new stub pages (decision 3a) — minimal placeholder
  copy only, not fleshed-out sections. Building real Brands/Repair & Exchange/
  Services/Sell Us Your Parts/About content is a future project.

## Verification

Same approach as the prior project — no automated test suite exists in this repo:
1. `npx tsc --noEmit` → `npm run lint` → `npm run build` before considering any
   page done, per CLAUDE.md.
2. Manual visual comparison against the mockup file section by section (header,
   hero, category grid, PLP rows, PDP layout, Ask Price flow, confirm/success) in
   `npm run dev`, checking spacing/proportions/typography match, not just presence
   of content.
3. Confirm no regression to the prior project's price-free constraint (no
   `formatPrice()` before `/order/confirm`) — this rebuild only touches layout/
   markup, must not reintroduce price displays anywhere they were removed.
