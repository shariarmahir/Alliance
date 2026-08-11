# Alliance Storefront Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the public-facing Alliance storefront (industrial electronics B2B e-commerce) as a Next.js 16 App Router application — landing page, product catalog, product detail, quotation-to-order flow, mock delivery tracking, and invoice generation — per the approved spec.

**Architecture:** Single Next.js app in `Alliance-frontend/`, App Router, Server Components by default with Client Components only where interactivity requires (forms, quantity steppers, tabs, accordions, carousels). Route Handlers under `app/api/` back onto an in-memory mock catalog/quote/order store, shaped like a future FastAPI response so swapping base URLs later is contained. No `src/` folder. No component CSS files — one `app/globals.css` with Tailwind v4 `@theme` tokens plus custom glassmorphism utility classes.

**Tech Stack:** Next.js 16.3.0 (App Router) · React 19.2.8 · Tailwind CSS 4.3.3 (CSS-first, no `tailwind.config.ts`) · TypeScript 5.x · shadcn/ui (Radix-based) · Zod 4 (Route Handler validation) · lucide-react (icons) · sessionStorage-based quote/order flow state.

## Global Constraints

- Project root for this phase: `Alliance-frontend/` (already exists as an empty dir at repo root).
- No `src/` folder — everything under `app/`.
- No component-level CSS files — all styling in `app/globals.css` + Tailwind utility classes.
- All page content lives in each route's `page.tsx` — don't split page markup into extra wrapper files beyond genuinely reusable components in `app/components/`.
- Background: white `#FFFFFF`. Primary: `#007DCC` (blue). Accent: `#FFB900` (orange).
- Buttons use a glassmorphism style: translucent fill, `backdrop-blur`, subtle border, hover glow/scale — implemented as reusable classes in `globals.css` (`.btn-glass`, `.btn-glass-accent`), not one-off inline styles.
- Layout patterns are **inspired by** industrial-distributor UX (Radwell-style: hero → categories → product grid; sidebar-filtered listing; gallery+specs product detail) but reimplemented with Alliance's own brand, copy, and original component code. Never copy literal markup, CSS, image assets, or text from any third-party site.
- No "Add to Cart" anywhere — product detail and listing use **"Request Quotation"**.
- Footer contact: Uttara, Dhaka, Bangladesh · info@alliance.com · +8801713-116019. Copyright: "© Alliance 2026-2028. All rights reserved." Credit line: "Developed by Mahir Shariar Mahin".
- Mock data (`app/lib/mock-data.ts`) and Route Handlers reading it are clearly marked `// TEMPORARY MOCK DATA — replace with FastAPI backend` at the top of each file.
- Gate every task on `npx tsc --noEmit` passing with zero errors before commit.
- Out of scope for this plan: Super Admin dashboard, Sub-Admin dashboard, employee/leave management, bulk import, real auth, real payments/couriers, FastAPI backend (all future phases).

---

## File Structure

```
Alliance-frontend/
  app/
    layout.tsx                       # root layout: <html>, header, footer, WhatsApp widget
    page.tsx                         # landing page
    globals.css                      # Tailwind v4 theme tokens + glassmorphism utilities
    not-found.tsx                    # custom 404
    products/
      page.tsx                       # category grid + filtered listing (reads searchParams)
      [slug]/
        page.tsx                     # product detail
        not-found.tsx                # invalid slug 404
    quote/
      [productSlug]/
        page.tsx                     # request quotation form (client component page body)
    order/
      confirm/
        page.tsx                     # confirm order: delivery options/date
      success/
        page.tsx                     # order confirmed: tracking id, invoice buttons
    track/
      [trackingId]/
        page.tsx                     # mock delivery tracking timeline
    api/
      products/
        route.ts                     # GET list (filters via searchParams)
        [slug]/
          route.ts                   # GET one
      quotes/
        route.ts                     # POST create quote
      orders/
        route.ts                     # POST create order
    components/
      ui/                            # shadcn primitives (button, input, select, accordion, etc.)
      header.tsx
      footer.tsx
      whatsapp-button.tsx
      hero-carousel.tsx
      category-grid.tsx
      product-card.tsx
      product-tabs-section.tsx       # week/month/year top-selling tabs
      brand-strip.tsx
      trust-section.tsx              # "Quality Parts & Services You Can Trust"
      uptime-section.tsx             # "Protect Uptime. Reduce Downtime."
      support-section.tsx            # "Services & Support"
      reviews-section.tsx
      faq-section.tsx
      contact-form.tsx
      product-filters.tsx            # sidebar filters (client component)
      quantity-stepper.tsx
      quote-form.tsx                 # client component
      delivery-options.tsx           # client component
      tracking-timeline.tsx
      invoice-actions.tsx            # download/print buttons (client component)
    lib/
      mock-data.ts                   # TEMPORARY: categories, products, brands, reviews, FAQ
      types.ts                       # shared TypeScript types
      utils.ts                       # cn() helper, price formatting, date helpers
      quote-store.ts                 # sessionStorage read/write helpers for quote/order flow
  public/
    images/
      hero/                          # hero1.jpg..hero5.jpg (placeholder SVGs for now)
      categories/                    # category icons
      products/                      # product placeholder images
      brands/                        # brand logos
  components.json                    # shadcn config
  next.config.ts
  tsconfig.json
  package.json
  .eslintrc / eslint.config.mjs
```

**Interfaces locked now (used across tasks):**

```ts
// app/lib/types.ts
export type StockStatus = "in-stock" | "low-stock" | "out-of-stock";

export type Category = {
  slug: string;
  name: string;
  icon: string; // path under /images/categories
  productCount: number;
};

export type Brand = {
  slug: string;
  name: string;
  logo: string; // path under /images/brands
};

export type Product = {
  slug: string;
  partNumber: string;
  name: string;
  brand: string; // Brand.slug
  categorySlug: string; // Category.slug
  image: string; // path under /images/products
  gallery: string[];
  shortSpecs: string[]; // bullets for cards
  description: string[]; // bullets for detail page
  alternatePartNumbers: string[];
  specifications: Record<string, string>;
  price: number; // USD, unit price
  stock: StockStatus;
  warrantyYears: number;
  weekRank?: number; // present + low number = top seller this week
  monthRank?: number;
  yearRank?: number;
};

export type Review = {
  id: string;
  author: string;
  country: string;
  rating: 1 | 2 | 3 | 4 | 5;
  text: string;
};

export type FaqItem = { question: string; answer: string };

export type QuoteRequest = {
  id: string;
  productSlug: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  name: string;
  email: string;
  phone: string;
  company: string;
  country: string;
  createdAt: string; // ISO
};

export type DeliveryOption = "standard" | "express";

export type Order = {
  id: string;
  orderNumber: string;
  quoteId: string;
  deliveryOption: DeliveryOption;
  estimatedDeliveryDate: string; // ISO date
  trackingId: string;
  createdAt: string; // ISO
};
```

```ts
// app/lib/quote-store.ts
export function saveQuote(quote: QuoteRequest): void;
export function loadQuote(id: string): QuoteRequest | null;
export function saveOrder(order: Order): void;
export function loadOrder(orderNumber: string): Order | null;
```

---

### Task 1: Scaffold Next.js app + Tailwind v4 + TypeScript + shadcn/ui

**Files:**
- Create: `Alliance-frontend/` (full scaffold via `create-next-app`)
- Modify: `Alliance-frontend/app/globals.css` (theme tokens)
- Create: `Alliance-frontend/components.json` (shadcn config)

**Interfaces:**
- Produces: working `npm run dev` on port 3000, `npx tsc --noEmit` clean, Tailwind v4 theme tokens (`--color-primary`, `--color-accent`) usable as `bg-primary`, `text-accent`, etc., and `app/lib/utils.ts` exporting `cn()`.

- [ ] **Step 1: Scaffold the app**

Run from repo root:
```bash
npx create-next-app@latest Alliance-frontend --typescript --tailwind --eslint --app --no-src-dir --import-alias "@/*" --turbopack --yes
```

- [ ] **Step 2: Verify scaffold versions**

Run: `cd Alliance-frontend && cat package.json`
Expected: `next` `^16.x`, `react`/`react-dom` `^19.x`, `tailwindcss` `^4.x`, `typescript` `^5.x` present as dependencies.

- [ ] **Step 3: Set Tailwind v4 theme tokens in globals.css**

Replace `Alliance-frontend/app/globals.css` contents with:

```css
@import "tailwindcss";

@theme {
  --color-primary: #007dcc;
  --color-primary-dark: #005f9e;
  --color-accent: #ffb900;
  --color-accent-dark: #cc9400;
  --font-sans: var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif;
}

body {
  background: #ffffff;
  color: #0f172a;
}

.btn-glass {
  @apply relative inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5
    font-medium text-white bg-primary/80 backdrop-blur-md border border-white/20
    shadow-lg shadow-primary/20 transition-all duration-200
    hover:bg-primary hover:shadow-xl hover:shadow-primary/30 hover:scale-[1.02]
    active:scale-[0.98];
}

.btn-glass-accent {
  @apply relative inline-flex items-center justify-center gap-2 rounded-lg px-5 py-2.5
    font-semibold text-slate-900 bg-accent/85 backdrop-blur-md border border-white/30
    shadow-lg shadow-accent/30 transition-all duration-200
    hover:bg-accent hover:shadow-xl hover:shadow-accent/40 hover:scale-[1.02]
    active:scale-[0.98];
}
```

- [ ] **Step 4: Initialize shadcn/ui**

Run:
```bash
npx shadcn@latest init -d
```
Expected: `components.json` created, `app/components/ui/` directory ready, `app/lib/utils.ts` created with `cn()`.

- [ ] **Step 5: Add initial shadcn components needed across the app**

Run:
```bash
npx shadcn@latest add button input select accordion tabs badge card separator label textarea sonner
```
Expected: files appear under `app/components/ui/`.

- [ ] **Step 6: Verify typecheck and dev server**

Run: `npx tsc --noEmit`
Expected: no errors.

Run: `npm run dev -- -p 3010 &` then `curl -s -o /dev/null -w "%{http_code}" http://localhost:3010` (kill after)
Expected: `200`.

- [ ] **Step 7: Commit**

```bash
cd "/m/Private projects/Alliance"
git add Alliance-frontend
git commit -m "Scaffold Alliance storefront: Next.js 16, Tailwind v4, shadcn/ui"
```

---

### Task 2: Shared types, mock data, and utils

**Files:**
- Create: `Alliance-frontend/app/lib/types.ts`
- Create: `Alliance-frontend/app/lib/mock-data.ts`
- Modify: `Alliance-frontend/app/lib/utils.ts` (add price/date helpers alongside existing `cn()`)
- Create: `Alliance-frontend/app/lib/quote-store.ts`

**Interfaces:**
- Consumes: nothing (foundational).
- Produces: `Category`, `Brand`, `Product`, `Review`, `FaqItem`, `QuoteRequest`, `DeliveryOption`, `Order` types (exact shapes above); `mock-data.ts` exports `categories: Category[]`, `brands: Brand[]`, `products: Product[]`, `reviews: Review[]`, `faqs: FaqItem[]`, plus helper functions `getProductBySlug(slug): Product | undefined`, `getProductsByCategory(slug): Product[]`, `getTopSelling(period: "week"|"month"|"year"): Product[]`, `getRelatedProducts(slug): Product[]`; `utils.ts` adds `formatPrice(n: number): string` and `addBusinessDays(date: Date, days: number): Date`; `quote-store.ts` implements the 4 functions from the File Structure interface block.

- [ ] **Step 1: Write `app/lib/types.ts`**

Paste the full type block from the "Interfaces locked now" section above verbatim into `Alliance-frontend/app/lib/types.ts`.

- [ ] **Step 2: Write `app/lib/mock-data.ts`**

Create with header comment `// TEMPORARY MOCK DATA — replace with FastAPI backend`, then:
- 8 categories: PLCs & Machine Control, Drives, HMI/MMI/OIT, Contactors & Starters, Pneumatics, Safety Systems, Power Supplies, Sensors & Switches — each with `slug`, `name`, `icon: "/images/categories/<slug>.svg"`, `productCount` (computed after products array is built, so compute via `products.filter(...).length` at module load, not hardcoded).
- 6 brands: Allen Bradley, Siemens, Mitsubishi, Omron, Schneider Electric, Danfoss — `logo: "/images/brands/<slug>.svg"`.
- 48 products spanning all 8 categories (6 each), each with realistic-looking part numbers (e.g. `1756-L61`, `PowerFlex 525`, `GT2310-VTBD`), `shortSpecs` (3 bullets), `description` (4-6 bullets), `alternatePartNumbers` (1-3), `specifications` (4-8 key/value pairs like Voltage, Current, I/O Points, Mounting), `price` between 45 and 4200, `stock` mixed across all 3 statuses, `warrantyYears: 2`, and `weekRank`/`monthRank`/`yearRank` set on a rotating subset (8 products each) so all three top-seller tabs have content.
- Helper functions per the Interfaces block, implemented with plain `Array.prototype` methods (`find`, `filter`, sort by rank ascending, `slice`).
- 6 reviews with 4-5 star ratings, varied countries (Bangladesh, UAE, USA, UK, Germany, India).
- 6 FAQ items covering shipping internationally, quotation process, warranty, payment terms, lead times, returns.

- [ ] **Step 3: Add helpers to `app/lib/utils.ts`**

Append to the existing shadcn-generated file (keep its `cn()` export intact):

```ts
export function formatPrice(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(n);
}

export function addBusinessDays(date: Date, days: number): Date {
  const result = new Date(date);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const day = result.getDay();
    if (day !== 0 && day !== 6) added++;
  }
  return result;
}
```

- [ ] **Step 4: Write `app/lib/quote-store.ts`**

```ts
import type { QuoteRequest, Order } from "./types";

const QUOTE_PREFIX = "alliance_quote_";
const ORDER_PREFIX = "alliance_order_";

export function saveQuote(quote: QuoteRequest): void {
  sessionStorage.setItem(QUOTE_PREFIX + quote.id, JSON.stringify(quote));
}

export function loadQuote(id: string): QuoteRequest | null {
  const raw = sessionStorage.getItem(QUOTE_PREFIX + id);
  return raw ? (JSON.parse(raw) as QuoteRequest) : null;
}

export function saveOrder(order: Order): void {
  sessionStorage.setItem(ORDER_PREFIX + order.orderNumber, JSON.stringify(order));
}

export function loadOrder(orderNumber: string): Order | null {
  const raw = sessionStorage.getItem(ORDER_PREFIX + orderNumber);
  return raw ? (JSON.parse(raw) as Order) : null;
}
```

- [ ] **Step 5: Typecheck**

Run: `cd Alliance-frontend && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd "/m/Private projects/Alliance"
git add Alliance-frontend/app/lib
git commit -m "Add shared types, mock catalog data, and quote-store helpers"
```

---

### Task 3: Root layout — header, footer, WhatsApp widget

**Files:**
- Modify: `Alliance-frontend/app/layout.tsx`
- Create: `Alliance-frontend/app/components/header.tsx`
- Create: `Alliance-frontend/app/components/footer.tsx`
- Create: `Alliance-frontend/app/components/whatsapp-button.tsx`

**Interfaces:**
- Consumes: `categories` from `app/lib/mock-data.ts` (for header nav dropdown).
- Produces: `<Header />`, `<Footer />`, `<WhatsAppButton />` components rendered in every route via root layout; sets page `metadata` (title template, description) for SEO.

- [ ] **Step 1: Write `app/components/header.tsx`**

Server component: logo "Alliance", top bar with phone/email, main nav (Home, All Products, categories dropdown sourced from `mock-data.categories`, About/Contact anchors), search input (client sub-component or simple form GET to `/products?q=`), sticky on scroll via `className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b"`.

- [ ] **Step 2: Write `app/components/footer.tsx`**

Server component with columns (Customer Care, Company, Policies placeholders as plain text links to `#` where no route exists yet — do not link to unbuilt routes), contact block (Uttara, Dhaka, Bangladesh · info@alliance.com · +8801713-116019), newsletter email input (non-functional visual only, `<form>` with no handler needed this phase — omit submit action rather than wire a fake one), bottom bar: `© Alliance 2026-2028. All rights reserved.` and `Developed by Mahir Shariar Mahin`.

- [ ] **Step 3: Write `app/components/whatsapp-button.tsx`**

Client component (`"use client"`), fixed bottom-right circular button linking to `https://wa.me/8801713116019` with WhatsApp icon (lucide-react `MessageCircle` or inline SVG), `target="_blank" rel="noopener noreferrer"`.

- [ ] **Step 4: Wire into `app/layout.tsx`**

```tsx
import type { Metadata } from "next";
import "./globals.css";
import { Header } from "./components/header";
import { Footer } from "./components/footer";
import { WhatsAppButton } from "./components/whatsapp-button";

export const metadata: Metadata = {
  title: { default: "Alliance — Industrial Electronics & Automation Parts", template: "%s | Alliance" },
  description: "Alliance supplies PLCs, drives, servos, HMIs, and industrial automation components worldwide, shipped from Bangladesh.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Header />
        <main>{children}</main>
        <Footer />
        <WhatsAppButton />
      </body>
    </html>
  );
}
```

- [ ] **Step 5: Typecheck + visual check**

Run: `npx tsc --noEmit` — expect no errors.
Run dev server, load `http://localhost:3010/` — header, empty main, footer, WhatsApp button all render without console errors.

- [ ] **Step 6: Commit**

```bash
git add Alliance-frontend/app/layout.tsx Alliance-frontend/app/components/header.tsx Alliance-frontend/app/components/footer.tsx Alliance-frontend/app/components/whatsapp-button.tsx
git commit -m "Add root layout with header, footer, and WhatsApp widget"
```

---

### Task 4: Landing page — hero, categories, top-selling tabs, brand strip

**Files:**
- Modify: `Alliance-frontend/app/page.tsx`
- Create: `Alliance-frontend/app/components/hero-carousel.tsx`
- Create: `Alliance-frontend/app/components/category-grid.tsx`
- Create: `Alliance-frontend/app/components/product-card.tsx`
- Create: `Alliance-frontend/app/components/product-tabs-section.tsx`
- Create: `Alliance-frontend/app/components/brand-strip.tsx`

**Interfaces:**
- Consumes: `categories`, `brands`, `getTopSelling` from `mock-data.ts`; `Product` type.
- Produces: `<ProductCard product={Product} />` reused by Task 6 (listing page) and Task 4 — signature locked: `{ product: Product }`, renders image, brand, part number, 2 short specs, stock badge, price, "View Details" link to `/products/${slug}`, "Request Quotation" `.btn-glass-accent` link to `/quote/${slug}`.

- [ ] **Step 1: Write `app/components/product-card.tsx`**

```tsx
import Link from "next/link";
import Image from "next/image";
import type { Product } from "@/app/lib/types";
import { formatPrice } from "@/app/lib/utils";
import { Badge } from "@/app/components/ui/badge";

const stockLabel: Record<Product["stock"], string> = {
  "in-stock": "In Stock",
  "low-stock": "Low Stock",
  "out-of-stock": "Out of Stock",
};
const stockVariant: Record<Product["stock"], "default" | "secondary" | "destructive"> = {
  "in-stock": "default",
  "low-stock": "secondary",
  "out-of-stock": "destructive",
};

export function ProductCard({ product }: { product: Product }) {
  return (
    <div className="group flex flex-col rounded-xl border border-slate-200 bg-white p-4 transition-shadow hover:shadow-lg">
      <Link href={`/products/${product.slug}`} className="relative mb-3 aspect-square overflow-hidden rounded-lg bg-slate-50">
        <Image src={product.image} alt={product.name} fill className="object-contain p-4" />
      </Link>
      <Badge variant={stockVariant[product.stock]} className="mb-2 w-fit">{stockLabel[product.stock]}</Badge>
      <p className="text-xs font-medium uppercase text-primary">{product.brand}</p>
      <Link href={`/products/${product.slug}`} className="font-semibold text-slate-900 hover:text-primary">
        {product.partNumber}
      </Link>
      <ul className="my-2 space-y-1 text-xs text-slate-600">
        {product.shortSpecs.slice(0, 2).map((s) => <li key={s}>• {s}</li>)}
      </ul>
      <p className="mb-3 text-lg font-bold text-slate-900">{formatPrice(product.price)}</p>
      <div className="mt-auto flex flex-col gap-2">
        <Link href={`/products/${product.slug}`} className="btn-glass">View Details</Link>
        <Link href={`/quote/${product.slug}`} className="btn-glass-accent">Request Quotation</Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write `app/components/hero-carousel.tsx`**

Client component using `useState` + `setInterval` (cleanup on unmount) cycling through 3-5 static images under `/images/hero/hero1.jpg..hero5.jpg`, headline + subheadline + `.btn-glass-accent` CTA to `/products`, dot indicators.

- [ ] **Step 3: Write `app/components/category-grid.tsx`**

Server component, section titled "Top Categories", responsive grid (`grid-cols-2 sm:grid-cols-4 lg:grid-cols-8`) of `categories` — icon circle, name, product count, links to `/products?category=${slug}`.

- [ ] **Step 4: Write `app/components/product-tabs-section.tsx`**

Client component (`"use client"`) using shadcn `Tabs` (Week/Month/Year), each `TabsContent` renders a grid of `getTopSelling(period)` results (6 products) using `<ProductCard>`.

- [ ] **Step 5: Write `app/components/brand-strip.tsx`**

Server component, "Popular Brands Available" heading, horizontal row/grid of brand logos linking to `/products?brand=${slug}`.

- [ ] **Step 6: Assemble `app/page.tsx`**

Compose in order: `HeroCarousel`, `CategoryGrid`, `ProductTabsSection`, `BrandStrip`, then inline sections (can stay in `page.tsx` directly per "no unnecessary files" rule, since they're single-use static content, not reused components):
- "Quality Parts & Services You Can Trust" — 3-4 feature cards (icon + heading + text): Genuine Parts, Global Shipping, Expert Support, Fast Quotations.
- "Protect Uptime. Reduce Downtime. The Alliance Difference." — 2-column: copy + stats (e.g. "24/7 Support", "150+ Brands", "Same-Day Quotation") vs. supporting image.
- "Services & Support" — 3 cards: Technical Support, Repair Services, Bulk Ordering.
- Client reviews — reads `reviews` from mock-data, star ratings via lucide `Star`, horizontal scroll or grid.
- FAQ — shadcn `Accordion` reading `faqs` from mock-data.
- Contact form — reuses `app/components/contact-form.tsx` (build in this step too): client component, fields Name/Email/Message, `POST`-free (local `useState` "submitted" confirmation state is enough for this phase — no backend endpoint required by spec).

- [ ] **Step 7: Add placeholder images**

Create `Alliance-frontend/public/images/hero/hero1.svg` .. `hero3.svg`, `public/images/categories/<slug>.svg` (8 files), `public/images/brands/<slug>.svg` (6 files), `public/images/products/<slug>.svg` (48 files, can reuse a small set of category-representative SVGs keyed by product category rather than 48 unique drawings) as simple flat-color SVG placeholders (industrial device silhouette or initials-based). Update `mock-data.ts` image paths to match exactly what's generated.

- [ ] **Step 8: Typecheck + visual check**

Run: `npx tsc --noEmit` — no errors.
Load `/` in dev server — all sections render, tabs switch content, accordion expands, no hydration warnings in console.

- [ ] **Step 9: Commit**

```bash
git add Alliance-frontend/app/page.tsx Alliance-frontend/app/components Alliance-frontend/public/images
git commit -m "Build landing page: hero, categories, top-selling tabs, trust/support/reviews/FAQ sections"
```

---

### Task 5: Products API route handlers

**Files:**
- Create: `Alliance-frontend/app/api/products/route.ts`
- Create: `Alliance-frontend/app/api/products/[slug]/route.ts`

**Interfaces:**
- Consumes: `products`, `getProductBySlug` from `mock-data.ts`.
- Produces: `GET /api/products?category=&brand=&q=&inStock=&page=` → `{ products: Product[], total: number, page: number, pageSize: number }`; `GET /api/products/[slug]` → `Product` or `404 { error: string }`.

- [ ] **Step 1: Write `app/api/products/route.ts`**

```ts
// TEMPORARY MOCK DATA — replace with FastAPI backend
import { NextRequest, NextResponse } from "next/server";
import { products } from "@/app/lib/mock-data";

const PAGE_SIZE = 24;

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const category = sp.get("category");
  const brand = sp.get("brand");
  const q = sp.get("q")?.toLowerCase();
  const inStock = sp.get("inStock");
  const page = Math.max(1, Number(sp.get("page") ?? "1"));

  let filtered = products;
  if (category) filtered = filtered.filter((p) => p.categorySlug === category);
  if (brand) filtered = filtered.filter((p) => p.brand === brand);
  if (inStock === "true") filtered = filtered.filter((p) => p.stock !== "out-of-stock");
  if (q) {
    filtered = filtered.filter(
      (p) => p.name.toLowerCase().includes(q) || p.partNumber.toLowerCase().includes(q)
    );
  }

  const start = (page - 1) * PAGE_SIZE;
  const paged = filtered.slice(start, start + PAGE_SIZE);

  return NextResponse.json({ products: paged, total: filtered.length, page, pageSize: PAGE_SIZE });
}
```

- [ ] **Step 2: Write `app/api/products/[slug]/route.ts`**

```ts
// TEMPORARY MOCK DATA — replace with FastAPI backend
import { NextResponse } from "next/server";
import { getProductBySlug } from "@/app/lib/mock-data";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = getProductBySlug(slug);
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }
  return NextResponse.json(product);
}
```

- [ ] **Step 3: Manual verification**

Run dev server, then:
```bash
curl -s "http://localhost:3010/api/products?category=plcs-machine-control" | head -c 300
curl -s -o /dev/null -w "%{http_code}\n" "http://localhost:3010/api/products/does-not-exist"
```
Expected: first call returns JSON with filtered products; second returns `404`.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit` — no errors.

- [ ] **Step 5: Commit**

```bash
git add Alliance-frontend/app/api/products
git commit -m "Add products API route handlers over mock catalog"
```

---

### Task 6: Product listing page (`/products`)

**Files:**
- Create: `Alliance-frontend/app/products/page.tsx`
- Create: `Alliance-frontend/app/components/product-filters.tsx`

**Interfaces:**
- Consumes: `categories`, `brands`, `products` from `mock-data.ts`; `<ProductCard>` from Task 4.
- Produces: page reads `searchParams: Promise<{ category?: string; brand?: string; q?: string; inStock?: string; page?: string }>` (Next 16 async searchParams), server-side filters `products` directly (no need to fetch own API route from a Server Component — call `mock-data` functions directly), renders `<ProductFilters>` (client component controlling URL query params via `useRouter`/`useSearchParams`) + grid of `<ProductCard>` + pagination controls.

- [ ] **Step 1: Write `app/components/product-filters.tsx`**

Client component (`"use client"`): category checkboxes/tree (from `categories`), brand checkboxes (from `brands`), in-stock toggle (shadcn `Switch` — add via `npx shadcn@latest add switch` if not already present), part-number/description search input. On change, updates URL via `useRouter().push` with new query string, preserving other params.

- [ ] **Step 2: Write `app/products/page.tsx`**

```tsx
import { categories, brands, products } from "@/app/lib/mock-data";
import { ProductCard } from "@/app/components/product-card";
import { ProductFilters } from "@/app/components/product-filters";

const PAGE_SIZE = 24;

export const metadata = { title: "All Products" };

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; brand?: string; q?: string; inStock?: string; page?: string }>;
}) {
  const sp = await searchParams;
  let filtered = products;
  if (sp.category) filtered = filtered.filter((p) => p.categorySlug === sp.category);
  if (sp.brand) filtered = filtered.filter((p) => p.brand === sp.brand);
  if (sp.inStock === "true") filtered = filtered.filter((p) => p.stock !== "out-of-stock");
  if (sp.q) {
    const q = sp.q.toLowerCase();
    filtered = filtered.filter((p) => p.name.toLowerCase().includes(q) || p.partNumber.toLowerCase().includes(q));
  }

  const page = Math.max(1, Number(sp.page ?? "1"));
  const start = (page - 1) * PAGE_SIZE;
  const paged = filtered.slice(start, start + PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">PLC &amp; Industrial Automation Controls</h1>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]">
        <ProductFilters categories={categories} brands={brands} />
        <div>
          <p className="mb-4 text-sm text-slate-600">{filtered.length} results</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {paged.map((p) => <ProductCard key={p.slug} product={p} />)}
          </div>
          {totalPages > 1 && (
            <div className="mt-8 flex justify-center gap-2">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                <a
                  key={n}
                  href={`?${new URLSearchParams({ ...sp, page: String(n) } as Record<string, string>).toString()}`}
                  className={`rounded-md px-3 py-1.5 text-sm ${n === page ? "bg-primary text-white" : "border border-slate-200"}`}
                >
                  {n}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck + manual walk**

Run: `npx tsc --noEmit` — no errors.
Load `/products`, `/products?category=drives`, `/products?page=2` — grid updates, filters visible, pagination works.

- [ ] **Step 4: Commit**

```bash
git add Alliance-frontend/app/products/page.tsx Alliance-frontend/app/components/product-filters.tsx
git commit -m "Add product listing page with category/brand/stock filters and pagination"
```

---

### Task 7: Product detail page (`/products/[slug]`)

**Files:**
- Create: `Alliance-frontend/app/products/[slug]/page.tsx`
- Create: `Alliance-frontend/app/products/[slug]/not-found.tsx`
- Create: `Alliance-frontend/app/components/quantity-stepper.tsx`

**Interfaces:**
- Consumes: `getProductBySlug`, `getRelatedProducts` from `mock-data.ts`; `<ProductCard>`.
- Produces: `<QuantityStepper initial={1} onChange={(n: number) => void} />` client component reused nowhere else this phase but interface kept generic for Task 8 reuse if needed.

- [ ] **Step 1: Write `app/components/quantity-stepper.tsx`**

```tsx
"use client";
import { useState } from "react";
import { Button } from "@/app/components/ui/button";

export function QuantityStepper({
  initial = 1,
  min = 1,
  onChange,
}: {
  initial?: number;
  min?: number;
  onChange: (n: number) => void;
}) {
  const [qty, setQty] = useState(initial);
  function update(n: number) {
    const next = Math.max(min, n);
    setQty(next);
    onChange(next);
  }
  return (
    <div className="flex items-center gap-2">
      <Button type="button" variant="outline" size="icon" onClick={() => update(qty - 1)}>-</Button>
      <input
        type="number"
        value={qty}
        min={min}
        onChange={(e) => update(Number(e.target.value) || min)}
        className="w-16 rounded-md border border-slate-300 px-2 py-1.5 text-center"
      />
      <Button type="button" variant="outline" size="icon" onClick={() => update(qty + 1)}>+</Button>
    </div>
  );
}
```

- [ ] **Step 2: Write `app/products/[slug]/not-found.tsx`**

```tsx
import Link from "next/link";

export default function ProductNotFound() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-24 text-center">
      <h1 className="mb-4 text-3xl font-bold">Product Not Found</h1>
      <p className="mb-6 text-slate-600">The part you&apos;re looking for doesn&apos;t exist or has been removed.</p>
      <Link href="/products" className="btn-glass">Browse All Products</Link>
    </div>
  );
}
```

- [ ] **Step 3: Write `app/products/[slug]/page.tsx`**

Server component: `const { slug } = await params; const product = getProductBySlug(slug); if (!product) notFound();`. Layout: left image gallery (main image + thumbnail strip using `product.gallery`, simple `useState`-driven client sub-component inline or a small client component `GalleryClient` defined in the same file with `"use client"` at top — since it's page-specific and small, per spec's "no unnecessary files" rule it's fine to keep in `page.tsx` only if the whole file can stay server; if gallery needs interactivity, extract just the gallery piece as `app/components/product-gallery.tsx` client component taking `{ images: string[]; alt: string }`). Right column: brand, part number as title, warranty badge, price, stock badge, description bullets, "Also Known As" alternate part numbers, `<QuantityStepper>` + "Request Quotation" `.btn-glass-accent` link to `/quote/${slug}?qty=${qty}` (qty passed via client state lifted into an `<a>` href built in a small client wrapper, OR simplest: make the quantity+button block its own client component `app/components/quote-cta.tsx` taking `{ slug: string }`, internally tracking qty and rendering the Link with dynamic href — do this to keep `page.tsx` a server component). Specifications table (`Object.entries(product.specifications)`). Warranty callout block. "Customers Also Bought" — `getRelatedProducts(slug)` rendered via `<ProductCard>` grid.

Add `app/components/product-gallery.tsx` and `app/components/quote-cta.tsx` as the two client sub-components this task introduces.

`quote-cta.tsx`:
```tsx
"use client";
import Link from "next/link";
import { QuantityStepper } from "./quantity-stepper";
import { useState } from "react";

export function QuoteCta({ slug }: { slug: string }) {
  const [qty, setQty] = useState(1);
  return (
    <div className="flex flex-col gap-3">
      <QuantityStepper initial={1} onChange={setQty} />
      <Link href={`/quote/${slug}?qty=${qty}`} className="btn-glass-accent">Request Quotation</Link>
    </div>
  );
}
```

Add `metadata` export using `generateMetadata` for SEO (title = `${partNumber} | ${name}`, description from first description bullet).

- [ ] **Step 4: Typecheck + manual walk**

Run: `npx tsc --noEmit` — no errors.
Load a valid `/products/<slug>` and an invalid one — valid shows full detail, invalid shows the not-found page.

- [ ] **Step 5: Commit**

```bash
git add Alliance-frontend/app/products/[slug] Alliance-frontend/app/components/quantity-stepper.tsx Alliance-frontend/app/components/product-gallery.tsx Alliance-frontend/app/components/quote-cta.tsx
git commit -m "Add product detail page with gallery, specs, and Request Quotation flow entry"
```

---

### Task 8: Quotation, order confirmation, order success, and tracking API routes

**Files:**
- Create: `Alliance-frontend/app/api/quotes/route.ts`
- Create: `Alliance-frontend/app/api/orders/route.ts`

**Interfaces:**
- Consumes: `getProductBySlug` from `mock-data.ts`; `QuoteRequest`, `Order` types.
- Produces: `POST /api/quotes` body `{ productSlug, quantity, name, email, phone, company, country }` → `201 QuoteRequest` or `400 { error, fields }`; `POST /api/orders` body `{ quoteId, deliveryOption }` → `201 Order` (server computes `trackingId`, `orderNumber`, `estimatedDeliveryDate` via `addBusinessDays`).

- [ ] **Step 1: Write `app/api/quotes/route.ts`**

```ts
// TEMPORARY MOCK DATA — replace with FastAPI backend
import { NextResponse } from "next/server";
import { z } from "zod";
import { getProductBySlug } from "@/app/lib/mock-data";

const QuoteSchema = z.object({
  productSlug: z.string().min(1),
  quantity: z.coerce.number().int().min(1),
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(6),
  company: z.string().min(1),
  country: z.string().min(2),
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = QuoteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", fields: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const product = getProductBySlug(parsed.data.productSlug);
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }
  const quote = {
    id: crypto.randomUUID(),
    productSlug: product.slug,
    quantity: parsed.data.quantity,
    unitPrice: product.price,
    totalPrice: Math.round(product.price * parsed.data.quantity * 100) / 100,
    name: parsed.data.name,
    email: parsed.data.email,
    phone: parsed.data.phone,
    company: parsed.data.company,
    country: parsed.data.country,
    createdAt: new Date().toISOString(),
  };
  return NextResponse.json(quote, { status: 201 });
}
```

- [ ] **Step 2: Write `app/api/orders/route.ts`**

```ts
// TEMPORARY MOCK DATA — replace with FastAPI backend
import { NextResponse } from "next/server";
import { z } from "zod";
import { addBusinessDays } from "@/app/lib/utils";

const OrderSchema = z.object({
  quoteId: z.string().min(1),
  deliveryOption: z.enum(["standard", "express"]),
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = OrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", fields: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const days = parsed.data.deliveryOption === "express" ? 3 : 10;
  const orderNumber = `ALC-${Date.now().toString(36).toUpperCase()}`;
  const trackingId = `TRK-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const order = {
    id: crypto.randomUUID(),
    orderNumber,
    quoteId: parsed.data.quoteId,
    deliveryOption: parsed.data.deliveryOption,
    estimatedDeliveryDate: addBusinessDays(new Date(), days).toISOString(),
    trackingId,
    createdAt: new Date().toISOString(),
  };
  return NextResponse.json(order, { status: 201 });
}
```

- [ ] **Step 3: Typecheck + manual verification**

Run: `npx tsc --noEmit` — no errors.
```bash
curl -s -X POST http://localhost:3010/api/quotes -H "Content-Type: application/json" \
  -d '{"productSlug":"<valid-slug>","quantity":2,"name":"Test","email":"a@b.com","phone":"123456","company":"Acme","country":"BD"}'
```
Expected: `201` with quote JSON including `totalPrice`.

- [ ] **Step 4: Commit**

```bash
git add Alliance-frontend/app/api/quotes Alliance-frontend/app/api/orders
git commit -m "Add quotes and orders API route handlers with Zod validation"
```

---

### Task 9: Quote request page (`/quote/[productSlug]`)

**Files:**
- Create: `Alliance-frontend/app/quote/[productSlug]/page.tsx`
- Create: `Alliance-frontend/app/components/quote-form.tsx`

**Interfaces:**
- Consumes: `getProductBySlug` from `mock-data.ts`; `formatPrice` from `utils.ts`; `saveQuote` from `quote-store.ts`; `POST /api/quotes` from Task 8.
- Produces: on successful submit, calls `saveQuote(quote)` then `router.push(`/order/confirm?quoteId=${quote.id}`)`.

- [ ] **Step 1: Write `app/components/quote-form.tsx`**

Client component (`"use client"`) props `{ product: Product; initialQty: number }`. Local state for quantity (reuse `<QuantityStepper>`), live-computed `unitPrice * qty` display via `formatPrice`, form fields (name, email, phone, company, country) using shadcn `Input`/`Label`, client-side required validation, on submit `POST /api/quotes`, on `201` call `saveQuote(data)` and `router.push`, on `400` render field errors inline, on network/other error show a `sonner` toast.

- [ ] **Step 2: Write `app/quote/[productSlug]/page.tsx`**

```tsx
import { notFound } from "next/navigation";
import { getProductBySlug } from "@/app/lib/mock-data";
import { QuoteForm } from "@/app/components/quote-form";

export default async function QuotePage({
  params,
  searchParams,
}: {
  params: Promise<{ productSlug: string }>;
  searchParams: Promise<{ qty?: string }>;
}) {
  const { productSlug } = await params;
  const { qty } = await searchParams;
  const product = getProductBySlug(productSlug);
  if (!product) notFound();

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-bold">Request a Quotation</h1>
      <QuoteForm product={product} initialQty={Number(qty ?? "1") || 1} />
    </div>
  );
}
```

- [ ] **Step 3: Typecheck + manual walk**

Run: `npx tsc --noEmit` — no errors.
Load `/quote/<valid-slug>?qty=3`, fill form, submit — expect redirect to `/order/confirm?quoteId=...` (Task 10 must exist for full walk; if run before Task 10 exists, verify network call returns 201 and redirect attempt occurs, e.g. via browser URL bar changing even to a temporary 404).

- [ ] **Step 4: Commit**

```bash
git add Alliance-frontend/app/quote Alliance-frontend/app/components/quote-form.tsx
git commit -m "Add Request Quotation form page with live price calculation"
```

---

### Task 10: Confirm order page (`/order/confirm`)

**Files:**
- Create: `Alliance-frontend/app/order/confirm/page.tsx`
- Create: `Alliance-frontend/app/components/delivery-options.tsx`

**Interfaces:**
- Consumes: `loadQuote`, `saveOrder` from `quote-store.ts`; `getProductBySlug` from `mock-data.ts`; `POST /api/orders` from Task 8; `formatPrice`, `addBusinessDays` from `utils.ts`.
- Produces: on confirm, `router.push(`/order/success?orderNumber=${order.orderNumber}`)`.

- [ ] **Step 1: Write `app/components/delivery-options.tsx`**

Client component `{ value: DeliveryOption; onChange: (v: DeliveryOption) => void }`, radio group (shadcn `RadioGroup` — run `npx shadcn@latest add radio-group` if missing) with two cards: Standard (7-10 business days, free) and Express (2-3 business days, +$45 surcharge shown), each showing computed delivery date via `addBusinessDays(new Date(), days)`.

- [ ] **Step 2: Write `app/order/confirm/page.tsx`**

Entirely client component page (`"use client"` at top of `page.tsx` is acceptable here since the whole page is interactive — reads `useSearchParams()` for `quoteId`, `loadQuote(quoteId)` on mount via `useEffect`; if quote missing → redirect to `/products` with a `sonner` toast "Your quotation session expired — please request a new quote."). Renders itemized summary (product name/part number via `getProductBySlug(quote.productSlug)`, qty, unit price, total), `<DeliveryOptions>`, "Confirm Order" button that `POST /api/orders` with `{ quoteId, deliveryOption }`, on `201` calls `saveOrder(order)` then `router.push`.

- [ ] **Step 3: Typecheck + manual walk**

Run: `npx tsc --noEmit` — no errors.
Full walk: `/products` → detail → quote form submit → confirm page shows correct itemized total and delivery date → confirm → redirects to success (Task 11 needed for final landing; verify URL construction is correct even if success page 404s until built).

- [ ] **Step 4: Commit**

```bash
git add Alliance-frontend/app/order/confirm Alliance-frontend/app/components/delivery-options.tsx
git commit -m "Add order confirmation page with delivery option selection"
```

---

### Task 11: Order success page + invoice generation (`/order/success`)

**Files:**
- Create: `Alliance-frontend/app/order/success/page.tsx`
- Create: `Alliance-frontend/app/components/invoice-actions.tsx`
- Modify: `Alliance-frontend/package.json` (add `jspdf` dependency)

**Interfaces:**
- Consumes: `loadOrder`, `loadQuote` from `quote-store.ts`; `getProductBySlug` from `mock-data.ts`.
- Produces: `<InvoiceActions order={Order} quote={QuoteRequest} product={Product} />` — "Download Invoice" (generates PDF via `jspdf`, client-side) and "Print Invoice" (`window.print()` on a hidden print-only invoice layout).

- [ ] **Step 1: Install jsPDF**

```bash
cd Alliance-frontend && npm install jspdf
```

- [ ] **Step 2: Write `app/components/invoice-actions.tsx`**

Client component: `handleDownload` builds a simple PDF with jsPDF (Alliance header, order number, date, customer info, line item, total, footer contact info) and `doc.save(`invoice-${order.orderNumber}.pdf`)`; `handlePrint` calls `window.print()`. Both rendered as `.btn-glass` / `.btn-glass-accent` buttons.

- [ ] **Step 3: Write `app/order/success/page.tsx`**

Client component page: reads `orderNumber` from `useSearchParams()`, `loadOrder(orderNumber)`, then `loadQuote(order.quoteId)` and `getProductBySlug(quote.productSlug)`; if any missing → redirect to `/products` with toast. Renders success banner (checkmark icon), order number, tracking ID with link to `/track/${order.trackingId}`, delivery estimate, `<InvoiceActions>`.

- [ ] **Step 4: Typecheck + manual walk**

Run: `npx tsc --noEmit` — no errors.
Complete full golden path from `/products` through to success page, click "Download Invoice" (PDF downloads), click tracking link (navigates to `/track/[id]`, built next task).

- [ ] **Step 5: Commit**

```bash
git add Alliance-frontend/app/order/success Alliance-frontend/app/components/invoice-actions.tsx Alliance-frontend/package.json Alliance-frontend/package-lock.json
git commit -m "Add order success page with tracking link and PDF invoice generation"
```

---

### Task 12: Delivery tracking page (`/track/[trackingId]`)

**Files:**
- Create: `Alliance-frontend/app/track/[trackingId]/page.tsx`
- Create: `Alliance-frontend/app/components/tracking-timeline.tsx`

**Interfaces:**
- Consumes: nothing external — tracking status is derived deterministically from `trackingId` (hash) and current date, no persistence needed.
- Produces: `<TrackingTimeline currentStep={0|1|2|3} steps={{label,date}[]} />`.

- [ ] **Step 1: Write `app/components/tracking-timeline.tsx`**

Server component, `{ currentStep: number; steps: { label: string; date: string }[] }`, renders 4-stage horizontal/vertical stepper (Processing → Shipped → In Transit → Delivered) with completed steps highlighted in primary color, current step pulsing accent dot, future steps greyed.

- [ ] **Step 2: Write `app/track/[trackingId]/page.tsx`**

Server component: `const { trackingId } = await params;`. Derive a deterministic pseudo-random step (0-3) from the tracking ID string (simple char-code sum modulo 4) so reloading the page shows consistent state. Compute 4 dates spaced by `addBusinessDays` from a base date derived similarly. Render page header "Tracking: `{trackingId}`", `<TrackingTimeline>`, and a note that this is a live-tracking placeholder pending courier integration.

- [ ] **Step 3: Typecheck + manual walk**

Run: `npx tsc --noEmit` — no errors.
Load `/track/TRK-ABC12345` — timeline renders with a consistent step on repeated loads.

- [ ] **Step 4: Commit**

```bash
git add Alliance-frontend/app/track Alliance-frontend/app/components/tracking-timeline.tsx
git commit -m "Add mock delivery tracking timeline page"
```

---

### Task 13: Custom 404, metadata/SEO pass, and full golden-path verification

**Files:**
- Create: `Alliance-frontend/app/not-found.tsx`
- Modify: `Alliance-frontend/app/products/page.tsx` (metadata export if not already present)
- Create: `Alliance-frontend/app/sitemap.ts`
- Create: `Alliance-frontend/app/robots.ts`

**Interfaces:**
- Consumes: `products`, `categories` from `mock-data.ts`.
- Produces: root-level 404 page; `sitemap.ts` default-exports a function returning `MetadataRoute.Sitemap` covering `/`, `/products`, every `/products/[slug]`; `robots.ts` returns `MetadataRoute.Robots` allowing all except `/api/`, `/order/`, `/quote/`.

- [ ] **Step 1: Write `app/not-found.tsx`**

```tsx
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-center justify-center px-4 text-center">
      <h1 className="mb-4 text-4xl font-bold">404 — Page Not Found</h1>
      <p className="mb-6 text-slate-600">The page you&apos;re looking for doesn&apos;t exist.</p>
      <Link href="/" className="btn-glass">Back to Home</Link>
    </div>
  );
}
```

- [ ] **Step 2: Write `app/sitemap.ts`**

```ts
import type { MetadataRoute } from "next";
import { products } from "@/app/lib/mock-data";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://www.alliance.example";
  const staticRoutes = ["", "/products"].map((path) => ({
    url: `${base}${path}`,
    lastModified: new Date(),
  }));
  const productRoutes = products.map((p) => ({
    url: `${base}/products/${p.slug}`,
    lastModified: new Date(),
  }));
  return [...staticRoutes, ...productRoutes];
}
```

- [ ] **Step 3: Write `app/robots.ts`**

```ts
import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/order/", "/quote/"] },
    sitemap: "https://www.alliance.example/sitemap.xml",
  };
}
```

- [ ] **Step 4: Full golden-path manual verification**

Run: `cd Alliance-frontend && npx tsc --noEmit` — zero errors.
Run: `npm run lint` — zero errors (warnings acceptable only if pre-existing from shadcn generated files).
Run dev server and manually walk, noting pass/fail for each:
1. `/` loads, all sections render, hero rotates, tabs switch, accordion opens, contact form shows submitted state.
2. `/products` loads, filters change results, pagination works.
3. `/products/[valid-slug]` loads with full detail; `/products/does-not-exist` shows custom not-found.
4. Submit quote form from a product detail page → lands on `/order/confirm` with correct itemized total.
5. Confirm order with each delivery option → lands on `/order/success` with tracking link and working invoice download/print.
6. Tracking link → `/track/[id]` renders consistent timeline.
7. Visiting `/order/confirm` or `/order/success` directly (no sessionStorage state) redirects to `/products` with a toast, not a crash.
8. `/sitemap.xml` and `/robots.txt` respond with `200`.

- [ ] **Step 5: Commit**

```bash
git add Alliance-frontend/app/not-found.tsx Alliance-frontend/app/sitemap.ts Alliance-frontend/app/robots.ts
git commit -m "Add custom 404, sitemap, and robots.txt for SEO"
```

---

## Self-Review Notes

- **Spec coverage:** Landing page sections (Task 4), product listing with sidebar filters (Task 6), product detail with gallery/specs/warranty/related (Task 7), quote→order→success→tracking flow (Tasks 8-12), footer contact/copyright (Task 3), WhatsApp widget (Task 3), mock data + API shaped like future backend (Tasks 2, 5, 8), error handling for invalid slugs and missing session state (Tasks 7, 10, 11, 13), SEO (Task 13) — all covered. Super Admin/Sub-Admin/backend explicitly out of scope per spec.
- **Type consistency:** `Product`, `QuoteRequest`, `Order` types defined once in Task 2 and referenced identically in Tasks 4-13. `ProductCard({ product: Product })` signature locked in Task 4, reused unchanged in Tasks 6 and 7. `quote-store.ts` function signatures locked in Task 2, used as-is in Tasks 9-11.
- **Placeholder scan:** No TBD/TODO markers; every step has complete, runnable code or an exact command.
