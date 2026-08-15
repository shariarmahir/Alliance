# Storefront "Ask Price" Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle the AutoLink storefront to match the Claude Design bundle's visual
language (glassy hero, stat bars, card treatments, FAQ/contact layout) while switching
every customer-facing price display to a price-free "Ask Price" pattern, without
introducing any new API routes, data fields, or automated test infrastructure.

**Architecture:** Pure presentation-layer change. No `Product`/`QuoteItem`/`Quotation`
type changes, no new routes. Existing components keep their props and data-fetching
contracts; only JSX/className output changes, plus two small additions (an FAQ
accordion and a "Most requested parts" section reusing an existing card component).
The `useQuote()` context, `addItem()`/`/quote` → `/api/quotations` → `/order/confirm`
flow, and all admin-visible pricing are untouched.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind v4 (utility
classes + `app/globals.css` tokens), lucide-react icons, existing shadcn/ui primitives
in `app/components/ui/`.

## Global Constraints

- Wordmark is **AutoLink** everywhere — never "Alliance" in rendered output (spec
  decision 1).
- No `formatPrice()` calls anywhere reachable before `/order/confirm` — homepage,
  `/products`, `/products/[slug]`, `/quote` never render a price (spec decision 2).
- `Product.price`, `QuoteItem.price`, `Quotation`, `Order` types are unchanged; no new
  fields, no new API routes (spec decision 2–3).
- "Ask Price" buttons call the existing `addItem()` from `useQuote()` and navigate to
  `/quote` — same mechanics as today's `RequestQuoteButton`/`QuoteCta`, only relabeled
  (spec decision 3).
- Colors/tokens already match the bundle (`--color-primary: #007dcc`,
  `--color-accent: #ffb900` in `app/globals.css`) — reuse `.btn-glass` /
  `.btn-glass-accent` for primary/accent CTAs per CLAUDE.md, don't invent new button
  classes.
- No product ratings are added anywhere except `TopSellerCard`, which already has
  them (spec decision 6, correction).
- Reuse existing assets only: `public/images/categories/*.svg`,
  `public/images/brands/*.png`, existing hero images via `data/hero-images.json`. No
  new image files.
- Before any task is considered done: `npx tsc --noEmit` must pass with no new errors.
  Before the final task: `npm run lint` then `npm run build` must both pass (per
  CLAUDE.md, in that order).
- Run all commands from `Alliance-frontend/` (package.json lives there, not repo root).

---

### Task 1: Header and footer restyle

**Files:**
- Modify: `app/components/header-client.tsx`
- Modify: `app/components/footer.tsx`

**Interfaces:**
- Consumes: `Category[]` prop (header, unchanged shape), no props (footer).
- Produces: no new exports; both keep their existing named exports
  (`HeaderClient`, `Footer`) and prop signatures for downstream pages.

- [ ] **Step 1: Restyle header-client.tsx to the bundle's 1a/1b header treatment**

Edit `app/components/header-client.tsx`. Keep every existing behavior (search
submit, mobile drawer, category dropdown) — only change markup/classes:
- Utility bar: keep as-is (already matches bundle's thin top bar with phone/email/social).
- Main bar: change the "Login" pill + "Browse Catalog" button cluster to add a
  "Price Requests" badge matching the bundle's `1a`/`1b` header (a pill showing the
  current `useQuote()` count). Import `useQuote` from `@/app/lib/quote-context` and
  add:

```tsx
import { useQuote } from "@/app/lib/quote-context";
```

Inside `HeaderClient`, after the existing `const router = useRouter();` line, add:

```tsx
  const { count } = useQuote();
```

Replace the desktop controls block (the `<div className="ml-auto hidden shrink-0 items-center gap-3 md:flex">...</div>`)
with:

```tsx
          <div className="ml-auto hidden shrink-0 items-center gap-3 md:flex">
            <Link
              href="/admin/login"
              className="flex h-11 items-center gap-2 rounded-full border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition-all hover:border-primary hover:text-primary hover:shadow-sm"
            >
              <User className="size-4" />
              <span className="hidden sm:inline">Login</span>
            </Link>
            <Link
              href="/quote"
              className="flex h-11 items-center gap-2 rounded-lg bg-[#10192d] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#1a2740]"
            >
              Price Requests
              {count > 0 && (
                <span className="flex min-w-5 items-center justify-center rounded-full bg-accent px-1.5 py-0.5 text-xs font-bold text-[#10192d]">
                  {count}
                </span>
              )}
            </Link>
          </div>
```

Leave the mobile menu panel's `/quote` link absent (no change needed there for this
task — mobile "Price Requests" access is via the existing mobile drawer's category
list, which already routes through `/products`).

- [ ] **Step 2: Restyle footer.tsx to the bundle's dark footer with newsletter block**

Edit `app/components/footer.tsx`. Keep the existing grid of columns (brand blurb,
Categories, Company, Get in Touch) and all links/copy exactly as-is — this task only
adds a 5th column matching the bundle's "Stock & Price Alerts" newsletter block
(`Alliance Storefront.dc.html`, 1a footer, "STOCK & PRICE ALERTS" panel) and widens
the grid to 5 columns on desktop.

Change the grid container class:

```tsx
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-4 py-14 md:grid-cols-5">
```

After the closing `</div>` of the "Get in Touch" column (the 4th `<div>` inside the
grid, ending right before `</div>\n\n      <div className="border-t border-white/20">`),
add a 5th column:

```tsx

        <div>
          <h4 className="mb-4 font-semibold text-white">Stock &amp; Price Alerts</h4>
          <p className="mb-3 text-sm text-white/70">
            New arrivals and obsolete finds, once a month. No resellers.
          </p>
          <form className="flex gap-2" onSubmit={(e) => e.preventDefault()}>
            <input
              type="email"
              placeholder="Work email"
              className="min-w-0 flex-1 rounded-md border border-white/20 bg-white/10 px-3 py-2 text-sm text-white placeholder:text-white/50 outline-none focus:border-accent"
            />
            <button
              type="submit"
              className="shrink-0 rounded-md bg-accent px-3 py-2 text-sm font-bold text-slate-900 hover:bg-accent-dark"
            >
              Join
            </button>
          </form>
        </div>
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors (pre-existing errors, if any, are out of scope).

- [ ] **Step 4: Manual check in dev server**

Run: `npm run dev`, open `http://localhost:3000`. Confirm:
- Header shows "Price Requests" badge (no count badge if `/quote` is empty).
- Footer shows 5 columns on desktop including the new newsletter form.
- No console errors.

- [ ] **Step 5: Commit**

```bash
git add app/components/header-client.tsx app/components/footer.tsx
git commit -m "Restyle header and footer with Ask Price badge and newsletter column"
```

---

### Task 2: Hero carousel copy pass

**Files:**
- Modify: `app/components/hero-carousel-client.tsx`

**Interfaces:**
- Consumes: `Slide[]` prop (unchanged shape: `{ image, headlineLine1, headlineLine2, subheadline }`).
- Produces: no new exports; `HeroCarouselClient` keeps its signature.

- [ ] **Step 1: Update the CTA buttons and search placeholder to match the bundle's hero**

Edit `app/components/hero-carousel-client.tsx`. The existing stats bar
(`STATS` array, rendered in the `bg-primary` div at the bottom) already satisfies the
spec's "stats bar under hero" requirement — no structural change needed there, just
confirm copy matches bundle tone. Change only the search form's CTA button and add a
secondary "Browse the catalogue" link to match bundle 1a's two-button CTA row.

Replace the search `<form>` block:

```tsx
              <form onSubmit={submit} className="mb-4 flex w-full max-w-xl flex-col gap-2 sm:mb-6 sm:flex-row sm:gap-0">
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search 50,000+ parts by number or brand..."
                  className="h-11 w-full min-w-0 rounded-md border-0 bg-white px-4 text-sm text-slate-900 outline-none placeholder:text-slate-400 sm:h-12 sm:rounded-l-md sm:rounded-r-none"
                />
                <button
                  type="submit"
                  className="btn-glass-accent flex h-11 shrink-0 items-center justify-center gap-2 rounded-md px-5 sm:h-12 sm:rounded-l-none sm:rounded-r-md"
                >
                  <Search className="size-4" /> Search
                </button>
              </form>
```

with:

```tsx
              <form onSubmit={submit} className="mb-4 flex w-full max-w-xl flex-col gap-2 sm:mb-3 sm:flex-row sm:gap-0">
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search 50,000+ parts by number or brand..."
                  className="h-11 w-full min-w-0 rounded-md border-0 bg-white px-4 text-sm text-slate-900 outline-none placeholder:text-slate-400 sm:h-12 sm:rounded-l-md sm:rounded-r-none"
                />
                <button
                  type="submit"
                  className="btn-glass-accent flex h-11 shrink-0 items-center justify-center gap-2 rounded-md px-5 sm:h-12 sm:rounded-l-none sm:rounded-r-md"
                >
                  <Search className="size-4" /> Ask a Price
                </button>
              </form>
              <Link
                href="/products"
                className="mb-4 inline-flex w-fit items-center gap-2 rounded-md border border-white/30 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/20 sm:mb-6"
              >
                Browse the catalogue
              </Link>
```

Add the `Link` import at the top of the file:

```tsx
import Link from "next/link";
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Manual check**

Run: `npm run dev`, confirm the hero shows both an "Ask a Price" search button and a
"Browse the catalogue" link below the search bar, and the stats bar still renders
underneath.

- [ ] **Step 4: Commit**

```bash
git add app/components/hero-carousel-client.tsx
git commit -m "Add Ask a Price hero CTA and browse-catalogue link"
```

---

### Task 3: Product card and PLP price removal

**Files:**
- Modify: `app/components/product-card.tsx`
- Modify: `app/components/request-quote-button.tsx`

**Interfaces:**
- Consumes: `{ product: Product }` prop (both files, unchanged).
- Produces: `ProductCard`, `RequestQuoteButton` keep their exports and prop shapes —
  `app/(site)/products/page.tsx` and `app/(site)/products/[slug]/page.tsx` (Task 5)
  continue to import them unchanged.

- [ ] **Step 1: Remove price display and relabel the CTA in request-quote-button.tsx**

Edit `app/components/request-quote-button.tsx`. Change the button label only:

```tsx
    <button type="button" onClick={requestQuote} className="btn-glass-accent">
      Ask Price
    </button>
```

(replaces the existing `Create Quotation` text — everything else in the file is
unchanged.)

- [ ] **Step 2: Remove the price line from product-card.tsx**

Edit `app/components/product-card.tsx`. Remove the `formatPrice` import and the price
`<p>` line:

Remove this line:
```tsx
import { formatPrice } from "@/app/lib/utils";
```

Remove this line:
```tsx
      <p className="mb-3 text-lg font-bold text-slate-900">{formatPrice(product.price)}</p>
```

Replace it with an "Ask Price" affordance matching the bundle's card pattern (a small
label above the buttons, no dollar figure):

```tsx
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-primary">Ask Price</p>
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors, and no "unused import" warning for `formatPrice` in
`product-card.tsx`.

- [ ] **Step 4: Manual check**

Run: `npm run dev`, open `/products`. Confirm no price appears on any card, and the
button reads "Ask Price".

- [ ] **Step 5: Commit**

```bash
git add app/components/product-card.tsx app/components/request-quote-button.tsx
git commit -m "Remove prices from product cards, relabel CTA to Ask Price"
```

---

### Task 4: Top seller card price removal (Most requested parts section)

**Files:**
- Modify: `app/components/top-seller-card.tsx`

**Interfaces:**
- Consumes: `{ product: TopSeller }` prop (`app/lib/top-sellers.ts` type, unchanged).
- Produces: `TopSellerCard` keeps its export/signature — `app/(site)/page.tsx`
  (Task 6) continues to render it in a grid over `topSellers`.

- [ ] **Step 1: Remove the price block, keep the rating display**

Edit `app/components/top-seller-card.tsx`. Remove the `formatPrice` import:

```tsx
import { formatPrice } from "@/app/lib/utils";
```

Replace the price block:

```tsx
        <div className="mt-1">
          <span className="text-lg font-bold text-slate-900">{formatPrice(product.price)}</span>
          {product.oldPrice > product.price && (
            <span className="ml-2 text-xs text-slate-400 line-through">{formatPrice(product.oldPrice)}</span>
          )}
        </div>
```

with:

```tsx
        <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-primary">Ask Price</p>
```

- [ ] **Step 2: Relabel the CTA**

Replace:

```tsx
        <Link href={browseHref} className="btn-glass-accent mt-1 w-full">
          Create Quotation
        </Link>
```

with:

```tsx
        <Link href={browseHref} className="btn-glass-accent mt-1 w-full">
          Ask Price
        </Link>
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors, no unused `formatPrice` import warning.

- [ ] **Step 4: Manual check**

Confirm in dev server (after Task 6 wires this into the homepage) that top-seller
cards show "Ask Price" with no dollar amount and no strikethrough old price.

- [ ] **Step 5: Commit**

```bash
git add app/components/top-seller-card.tsx
git commit -m "Remove prices from top seller cards, relabel CTA to Ask Price"
```

---

### Task 5: Product detail page (PDP) and QuoteCta price removal

**Files:**
- Modify: `app/components/quote-cta.tsx`
- Modify: `app/(site)/products/[slug]/page.tsx`

**Interfaces:**
- Consumes: `{ product: Product }` (`quote-cta.tsx`), `{ params: Promise<{ slug: string }> }` (page, unchanged Next.js route contract).
- Produces: no new exports; `QuoteCta` keeps its signature for `page.tsx` to consume.

- [ ] **Step 1: Relabel QuoteCta's button**

Edit `app/components/quote-cta.tsx`. Replace:

```tsx
      <button type="button" onClick={requestQuote} className="btn-glass-accent">
        Create Quotation
      </button>
```

with:

```tsx
      <button type="button" onClick={requestQuote} className="btn-glass-accent">
        Ask Price for This Part
      </button>
```

- [ ] **Step 2: Remove the price display from the PDP**

Edit `app/(site)/products/[slug]/page.tsx`. Remove the `formatPrice` import:

```tsx
import { formatPrice } from "@/app/lib/utils";
```

Replace the price line:

```tsx
          <p className="mb-6 text-3xl font-bold text-slate-900">{formatPrice(product.price)}</p>
```

with an "Ask Price" panel matching the bundle's PDP (1c) treatment — a bordered
callout instead of a dollar figure:

```tsx
          <div className="mb-6 rounded-xl border border-primary/20 bg-primary/5 p-4">
            <p className="text-sm font-semibold text-primary">Ask Price</p>
            <p className="mt-1 text-sm text-slate-600">
              No price shown until an engineer confirms stock and freight. Firm
              quotation valid 14 days, typically returned within 4 working hours.
            </p>
          </div>
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors, no unused `formatPrice` import warning.

- [ ] **Step 4: Manual check**

Run: `npm run dev`, open any `/products/[slug]` page. Confirm no dollar figure
appears anywhere on the page, and the CTA button reads "Ask Price for This Part".

- [ ] **Step 5: Commit**

```bash
git add app/components/quote-cta.tsx "app/(site)/products/[slug]/page.tsx"
git commit -m "Remove price display from product detail page, add Ask Price panel"
```

---

### Task 6: Landing page — add stats/FAQ sections, wire in Most requested parts

**Files:**
- Modify: `app/(site)/page.tsx`
- Create: `app/components/faq-accordion.tsx`

**Interfaces:**
- Consumes: no props (page is the route's default export); `faq-accordion.tsx`
  takes `{ items: { question: string; answer: string }[] }`.
- Produces: `FaqAccordion` named export, consumed by `app/(site)/page.tsx`.

- [ ] **Step 1: Create the FAQ accordion component**

Create `app/components/faq-accordion.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Plus, Minus } from "lucide-react";

type FaqItem = { question: string; answer: string };

export function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      {items.map((item, i) => {
        const isOpen = openIndex === i;
        return (
          <div key={item.question} className={i > 0 ? "border-t border-slate-200" : ""}>
            <button
              type="button"
              onClick={() => setOpenIndex(isOpen ? null : i)}
              className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
              aria-expanded={isOpen}
            >
              <span className="text-sm font-semibold text-slate-900">{item.question}</span>
              {isOpen ? (
                <Minus className="size-4 shrink-0 text-primary" />
              ) : (
                <Plus className="size-4 shrink-0 text-slate-400" />
              )}
            </button>
            {isOpen && (
              <p className="px-5 pb-4 text-sm leading-relaxed text-slate-600">{item.answer}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck the new component**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Add the stats bar, Most requested parts, and FAQ sections to the homepage**

Edit `app/(site)/page.tsx`. Add imports at the top, after the existing
`import { topSellers } from "@/app/lib/top-sellers";` line:

```tsx
import { TopSellerCard } from "@/app/components/top-seller-card";
import { FaqAccordion } from "@/app/components/faq-accordion";
```

(Note: `TopSellerCard` and `topSellers` are already imported in the current file for
the existing "Top Selling Products" section — do not duplicate the import if it's
already present; only add `FaqAccordion`.)

Add an `faqs` constant near the other data arrays at the top of the file (after
`differenceItems`):

```tsx
const faqs = [
  {
    question: "Why don't you publish prices?",
    answer:
      "Automation stock and freight move weekly, and most orders are multi-line. Send an Ask Price request and we reply with a firm quotation valid 14 days, including delivery.",
  },
  {
    question: "Are the parts new or surplus?",
    answer:
      "Both — every listing states its condition. New parts are factory sealed; surplus parts are function-tested and covered by the same AutoLink warranty.",
  },
  {
    question: "Do you ship to my country?",
    answer: "Yes — we ship to 100+ countries, with export documentation included on every order.",
  },
  {
    question: "What payment terms do you offer?",
    answer: "Terms are confirmed on your quotation; typical terms are 50% advance with balance before dispatch.",
  },
  {
    question: "Can you repair a unit instead of replacing it?",
    answer: "Often, yes — mention it in your Ask Price notes and our engineers will offer a repair route where available.",
  },
];
```

Add a stats bar section right after `<HeroCarousel />` (the hero already renders its
own internal stats bar in `hero-carousel-client.tsx` from Task 2 — this is a
*second*, page-level bar matching bundle 1a's 4-column strip below the hero, so
insert it between `<HeroCarousel />` and `<CategoryGrid />`):

```tsx
      <HeroCarousel />

      <div className="grid grid-cols-2 border-b border-slate-200 bg-slate-50 sm:grid-cols-4">
        <div className="border-r border-slate-200 px-6 py-5">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Quality System</p>
          <p className="mt-1 text-lg font-bold text-primary">ISO 9001:2015</p>
        </div>
        <div className="border-slate-200 px-6 py-5 sm:border-r">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Parts Catalogued</p>
          <p className="mt-1 text-lg font-bold text-primary">50,000+</p>
        </div>
        <div className="border-r border-t border-slate-200 px-6 py-5 sm:border-t-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Quote Turnaround</p>
          <p className="mt-1 text-lg font-bold text-primary">4 working hours</p>
        </div>
        <div className="border-t border-slate-200 px-6 py-5 sm:border-t-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Warranty</p>
          <p className="mt-1 text-lg font-bold text-primary">2 years</p>
        </div>
      </div>

      <CategoryGrid />
```

Add a "Most requested parts" section right after the existing "Top Selling Products"
section's closing `</section>` (they're adjacent per the bundle's flow — this section
reuses the same `topSellers` data with different framing copy, matching the bundle's
"Most requested parts" grid):

```tsx
      {/* Most Requested Parts */}
      <section className="mx-auto max-w-7xl px-4 py-12">
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Most Requested Parts</h2>
            <p className="mt-1 text-sm text-slate-500">Ranked by price requests received this month</p>
          </div>
          <Link href="/products" className="text-sm font-medium text-primary hover:underline">
            Browse All
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {topSellers.slice(0, 4).map((p) => (
            <TopSellerCard key={p.id} product={p} />
          ))}
        </div>
      </section>
```

Add the FAQ accordion inside the existing "We Are Here To Help You" `<section id="contact">`,
as a second column beside the current contact panel. Change the section's inner
wrapper from a single `<div className="relative overflow-hidden ...">` block to a
two-column grid with the FAQ on the left and the existing contact panel on the right.
Replace the opening of that section:

```tsx
      <section id="contact" className="mx-auto max-w-7xl px-4 py-12">
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/60 sm:p-8">
```

with:

```tsx
      <section id="contact" className="mx-auto max-w-7xl px-4 py-12">
        <div className="mb-10 grid grid-cols-1 gap-8 lg:grid-cols-2 lg:items-start">
          <div>
            <h2 className="mb-2 text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Frequently Asked</h2>
            <p className="mb-5 text-sm text-slate-600">
              Still unsure? WhatsApp an engineer on{" "}
              <a href="tel:+8801713116019" className="font-semibold text-primary">+8801713-116019</a>.
            </p>
            <FaqAccordion items={faqs} />
          </div>
          <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 shadow-lg shadow-slate-200/60 sm:p-8">
```

And its matching close — find the section's final two closing tags:

```tsx
          </div>
        </div>
      </section>
```

(the last occurrence in the file, closing the contact panel `<div>` and the
`<section id="contact">`) and add one more closing `</div>` to close the new grid
wrapper:

```tsx
          </div>
        </div>
      </div>
      </section>
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Manual check**

Run: `npm run dev`, open `/`. Confirm, top to bottom: hero → 4-column stats bar →
category grid → protect uptime video → top selling products → most requested parts
(no prices, "Ask Price" buttons) → quality/trust section → services → brands →
difference → reviews → FAQ accordion (click to expand/collapse) beside the contact
form → footer.

- [ ] **Step 6: Commit**

```bash
git add "app/(site)/page.tsx" app/components/faq-accordion.tsx
git commit -m "Add stats bar, Most requested parts, and FAQ accordion to landing page"
```

---

### Task 7: Products listing page (PLP) visual pass

**Files:**
- Modify: `app/(site)/products/page.tsx`

**Interfaces:**
- Consumes: `searchParams` (unchanged Next.js route contract).
- Produces: no exports consumed elsewhere; this is a leaf route page.

- [ ] **Step 1: Update the results header copy to match the bundle's PLP tone**

Edit `app/(site)/products/page.tsx`. Replace the results count line:

```tsx
          <p className="mb-4 text-sm text-slate-600">{filtered.length} results</p>
```

with a version matching bundle 1b's phrasing (still using the real `filtered.length`
and `page`/`PAGE_SIZE` values already computed above it — no new data needed):

```tsx
          <p className="mb-4 text-sm text-slate-600">
            Showing <span className="font-semibold text-slate-900">{start + 1}–{Math.min(start + PAGE_SIZE, filtered.length)}</span> of{" "}
            <span className="font-semibold text-slate-900">{filtered.length}</span> results
          </p>
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors (confirms `start` and `PAGE_SIZE` are in scope at this point
in the file — they are, both are already defined above this line in the existing
code).

- [ ] **Step 3: Manual check**

Run: `npm run dev`, open `/products`. Confirm the results line shows a range (e.g.
"Showing 1–24 of 184 results") and cards still render via the already-updated
`ProductCard` from Task 3 (no price, "Ask Price" button).

- [ ] **Step 4: Commit**

```bash
git add "app/(site)/products/page.tsx"
git commit -m "Update PLP results copy to show result range"
```

---

### Task 8: Ask Price page (formerly /quote) — drop price/subtotal display

**Files:**
- Modify: `app/(site)/quote/page.tsx`
- Modify: `app/components/quote-line-item.tsx`

**Interfaces:**
- Consumes: `useQuote()` (`{ items, total, updateQty, removeItem }`, unchanged
  context shape from `app/lib/quote-context.tsx`), `{ item: QuoteItem, onQtyChange, onRemove }` (`quote-line-item.tsx`).
- Produces: no new exports; both keep existing signatures. `total` from `useQuote()`
  is still destructured (needed by the POST to `/api/quotations`, per spec decision
  2 — the *data* keeps flowing, only the *display* of price disappears) but is no
  longer rendered in the JSX.

- [ ] **Step 1: Remove the per-unit and per-line price from quote-line-item.tsx**

Edit `app/components/quote-line-item.tsx`. Remove the `formatPrice` import:

```tsx
import { formatPrice } from "@/app/lib/utils";
```

Remove this line:

```tsx
        <p className="mt-1 text-sm text-slate-500">{formatPrice(item.price)} / unit</p>
```

Replace the quantity+total block:

```tsx
      <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end sm:justify-center">
        <QuantityStepper initial={item.quantity} onChange={onQtyChange} />
        <p className="font-bold text-slate-900">{formatPrice(item.price * item.quantity)}</p>
      </div>
```

with:

```tsx
      <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end sm:justify-center">
        <QuantityStepper initial={item.quantity} onChange={onQtyChange} />
        <span className="text-xs font-semibold uppercase tracking-wide text-primary">Ask Price</span>
      </div>
```

- [ ] **Step 2: Update quote/page.tsx heading, empty state, and summary card**

Edit `app/(site)/quote/page.tsx`. Remove the `formatPrice` import:

```tsx
import { formatPrice } from "@/app/lib/utils";
```

Replace the page heading:

```tsx
      <h1 className="mb-2 flex items-center gap-3 text-3xl font-extrabold text-slate-900">
        <FileText className="size-8 text-primary" /> Create Quotation
      </h1>
      <p className="mb-8 text-slate-500">
        Review your items and share your details. Our team confirms availability &amp; final pricing
        within one business day.
      </p>
```

with:

```tsx
      <h1 className="mb-2 flex items-center gap-3 text-3xl font-extrabold text-slate-900">
        <FileText className="size-8 text-primary" /> Ask Price
      </h1>
      <p className="mb-8 text-slate-500">
        Confirm quantities and share your details. An engineer replies with a firm
        quotation, including freight, within one business day.
      </p>
```

Replace the empty-state copy:

```tsx
        <h1 className="mt-4 text-2xl font-bold text-slate-900">Your quotation is empty</h1>
        <p className="mt-2 text-slate-500">Add products to request a quotation.</p>
```

with:

```tsx
        <h1 className="mt-4 text-2xl font-bold text-slate-900">Your price request list is empty</h1>
        <p className="mt-2 text-slate-500">Add products to ask for a price.</p>
```

Replace the summary card body — find this block:

```tsx
          <Card className="sticky top-24 p-6">
            <h2 className="mb-4 text-lg font-bold">Quotation Summary</h2>
            <div className="mb-4 max-h-56 space-y-2 overflow-auto text-sm">
              {items.map((item) => (
                <div key={item.slug} className="flex justify-between gap-2">
                  <span className="line-clamp-1 text-slate-500">
                    {item.quantity}× {item.partNumber}
                  </span>
                  <span className="font-medium text-slate-900">
                    {formatPrice(item.price * item.quantity)}
                  </span>
                </div>
              ))}
            </div>
            <div className="space-y-2 border-t border-slate-200 pt-3 text-sm">
              <div className="flex justify-between text-base font-extrabold">
                <span>Estimated Total</span>
                <span className="text-primary">{formatPrice(total)}</span>
              </div>
            </div>
            <button type="submit" disabled={submitting} className="btn-glass-accent mt-6 flex w-full items-center justify-center gap-2 disabled:opacity-60">
              {submitting ? "Submitting..." : "Submit Quotation"} <ArrowRight className="size-5" />
            </button>
            <p className="mt-3 text-center text-xs text-slate-500">
              Final pricing confirmed by our team within 1 business day.
            </p>
          </Card>
```

with:

```tsx
          <Card className="sticky top-24 p-6">
            <h2 className="mb-4 text-lg font-bold">Request Summary</h2>
            <div className="mb-4 max-h-56 space-y-2 overflow-auto text-sm">
              {items.map((item) => (
                <div key={item.slug} className="flex justify-between gap-2">
                  <span className="line-clamp-1 text-slate-500">
                    {item.quantity}× {item.partNumber}
                  </span>
                  <span className="font-medium text-primary">Ask Price</span>
                </div>
              ))}
            </div>
            <div className="space-y-2 border-t border-slate-200 pt-3 text-sm">
              <div className="flex justify-between text-base font-extrabold">
                <span>Lines</span>
                <span className="text-primary">{items.length}</span>
              </div>
            </div>
            <button type="submit" disabled={submitting} className="btn-glass-accent mt-6 flex w-full items-center justify-center gap-2 disabled:opacity-60">
              {submitting ? "Submitting..." : "Send Price Request"} <ArrowRight className="size-5" />
            </button>
            <p className="mt-3 text-center text-xs text-slate-500">
              Firm quotation, including freight, confirmed by our team within 1 business day.
            </p>
          </Card>
```

Note `total` is still destructured from `useQuote()` at the top of the file (`const
{ items, total, updateQty, removeItem } = useQuote();`) and still passed in the POST
body to `/api/quotations` — leave that line and the `fetch` call untouched, since the
data still needs to reach the backend per spec decision 2. Only the JSX display of
`total` is removed above.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors, no unused `formatPrice` import warnings in either file.

- [ ] **Step 4: Manual check — full flow**

Run: `npm run dev`. From a product detail page, click "Ask Price for This Part",
confirm redirect to `/quote` (now titled "Ask Price") with no prices/totals visible
anywhere, adjust quantity, click "Send Price Request", confirm it still POSTs
successfully (check network tab or toast) and redirects to `/order/confirm`.

- [ ] **Step 5: Commit**

```bash
git add "app/(site)/quote/page.tsx" app/components/quote-line-item.tsx
git commit -m "Rename quote page to Ask Price, remove price/total display"
```

---

### Task 9: Order confirm, success, and tracking pages — visual pass only

**Files:**
- Modify: `app/(site)/order/confirm/page.tsx`
- Modify: `app/(site)/order/success/page.tsx`

**Interfaces:**
- Consumes: existing page-local state/localStorage reads (unchanged).
- Produces: no exports consumed elsewhere (leaf route pages).

Per spec decision 2, prices stay visible on these pages (they render after an
engineer has responded). This task is copy/heading alignment with the bundle's 1e/1f
screens only — no price removal.

- [ ] **Step 1: Read the current confirm page to find the heading to update**

Run: `Read app/(site)/order/confirm/page.tsx` (use the Read tool, not Bash) and
locate the page's `<h1>` heading and intro paragraph.

- [ ] **Step 2: Align the confirm page heading with bundle 1e copy**

In `app/(site)/order/confirm/page.tsx`, update the top `<h1>` text to "Confirm your
order" and the paragraph beneath it to: "Prices, freight and terms are exactly as
issued on your quotation. Choose how it ships and when you want it." — keep every
existing field, delivery-option list, and submit handler exactly as-is; this is a
copy-only edit to the heading and intro paragraph text nodes, not a structural
change.

- [ ] **Step 3: Align the success page heading with bundle 1f copy**

In `app/(site)/order/success/page.tsx`, the heading already reads "Order Confirmed
Successfully!" — update it to "Order confirmed" (bundle 1f's exact heading) and
shorten the paragraph beneath it to remove redundant wording, keeping the existing
`{order.orderNumber}`-driven confirmation sentence structure intact. Locate:

```tsx
        <h1 className="mt-4 text-3xl font-extrabold text-slate-900">Order Confirmed Successfully!</h1>
        <p className="mt-2 text-slate-500">
          Thank you. A confirmation has been sent and your order is being prepared.
        </p>
```

Replace with:

```tsx
        <h1 className="mt-4 text-3xl font-extrabold text-slate-900">Order confirmed</h1>
        <p className="mt-2 text-slate-500">
          Your parts are being picked and an engineer will confirm handover to
          courier shortly.
        </p>
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Manual check**

Complete a full flow in `npm run dev` (Ask Price → submit → `/order/confirm` →
confirm order → `/order/success`) and confirm headings read "Confirm your order" and
"Order confirmed" respectively, and prices are still shown correctly at both steps.

- [ ] **Step 6: Commit**

```bash
git add "app/(site)/order/confirm/page.tsx" "app/(site)/order/success/page.tsx"
git commit -m "Align order confirm/success headings with design bundle copy"
```

---

### Task 10: Existing homepage sections — confirm visual parity with the bundle

**Files:**
- Modify: `app/(site)/page.tsx` (spacing/border tweaks only, if any are found)

**Interfaces:**
- Consumes: no new props/data.
- Produces: no new exports.

The spec (decision 5) calls for the pre-existing sections (uptime tags, trust stats,
services, brands, difference, reviews) to be "restyled to match the bundle's visual
treatment." These sections already use the same design language as the bundle
(`rounded-xl border border-slate-200`, hover shadow/translate, `bg-primary`/`bg-accent`
tokens) — this task is a deliberate, scoped check rather than a rewrite, so it doesn't
silently drop the spec requirement.

- [ ] **Step 1: Compare each section against its bundle counterpart**

Open `app/(site)/page.tsx` and, side by side with `Alliance Storefront.dc.html`
section `1a`, check these four sections against their bundle equivalents:
- "Protect Uptime. Reduce Downtime." vs bundle's matching video/text split section
- "Services & Support" vs bundle's 4-card icon grid
- "The AutoLink Difference" (dark `bg-primary` section) vs bundle's numbered
  06-item dark section
- `<BrandStrip />` vs bundle's logo grid

For each, confirm: rounded-xl cards, consistent border/hover treatment, and spacing
(`py-12` sections, `gap-4`/`gap-8` grids) already match what Tasks 1–6 established
elsewhere on the page. Do not change copy or restructure grids — only fix any
visually inconsistent spacing/border/radius value found (e.g. a section still using
`rounded-lg` where the rest of the page uses `rounded-xl`).

- [ ] **Step 2: Apply any spacing/border fixes found**

If Step 1 found no inconsistencies, skip to Step 3 with no file changes. If it found
specific mismatches, make the minimal className edit to align them (e.g. change
`rounded-lg` to `rounded-xl` on a specific card element) — list each change made in
the commit message.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Manual visual check**

Run: `npm run dev`, scroll the full homepage, confirm all sections read as one
consistent visual system (consistent card radius, border color, hover behavior)
matching the bundle's polish level.

- [ ] **Step 5: Commit**

```bash
git add "app/(site)/page.tsx"
git commit -m "Align remaining homepage sections with design bundle visual treatment"
```

If Step 1 found nothing to change, this step is a no-op — do not create an empty
commit.

---

### Task 11: Final verification — lint and production build

**Files:** none (verification only)

**Interfaces:** none

- [ ] **Step 1: Run the type checker**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 2: Run the linter**

Run: `npm run lint`
Expected: no errors (warnings acceptable only if identical to pre-existing baseline —
if unsure, run `git stash` and re-run lint to compare before restoring with
`git stash pop`).

- [ ] **Step 3: Run the production build**

Run: `npm run build`
Expected: build completes successfully with no errors. This catches build-only
failures (e.g. missing `Suspense` boundaries around `useSearchParams()`) that `tsc`
and `lint` don't — per CLAUDE.md, this is required before considering the work done.

- [ ] **Step 4: Full manual click-through**

Run: `npm run dev` and walk the entire flow one more time end to end: `/` (all
sections, FAQ accordion works) → `/products` (filters work, no prices) → a product
detail page (no prices, spec table intact) → "Ask Price for This Part" → `/quote`
(no prices, submit works) → `/order/confirm` (prices visible here) → `/order/success`
(prices visible, invoice download/print still work) → `/track/[trackingId]` (loads
without error). Also check the mobile header drawer opens/closes correctly at a
narrow viewport width.

- [ ] **Step 5: Commit (only if any fixes were needed in this task)**

If steps 1–4 required any fixes, stage and commit them:

```bash
git add -A
git commit -m "Fix build/lint issues found in final verification pass"
```

If no fixes were needed, skip this step — there is nothing to commit.
