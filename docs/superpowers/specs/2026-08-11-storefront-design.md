# Alliance Storefront — Design Spec (Phase 1 of 3)

Status: Approved
Date: 2026-08-11

## Scope

Public customer-facing e-commerce frontend for Alliance, an industrial electronics
e-commerce company (PLCs, drives, servos, HMI, contactors, sensors, etc.) based in
Bangladesh, sold internationally.

This spec covers **only** the storefront: landing page, product catalog, product
details, quotation-to-order flow, mock delivery tracking, and invoice generation.

Out of scope (future specs): Super Admin dashboard, Sub-Admin dashboard, employee/leave
management, bulk product/image import, real authentication, real payment/courier
integration, FastAPI backend.

## Design reference

The layout patterns (hero → categories → product grid, sidebar-filtered listing page,
product detail with gallery/specs/warranty/related-products) are inspired by common
industrial-distributor e-commerce UX (e.g. Radwell-style layouts), reimplemented with
Alliance's own brand identity, copy, and original component code — not a literal clone
of any third-party site's markup, assets, or text.

## Tech stack

- Next.js 16 (App Router, Server Components by default)
- Tailwind CSS v4 (CSS-first `@theme` tokens in `globals.css`, no `tailwind.config.ts`)
- TypeScript
- ShadCN UI components (`app/components/ui/`)
- Zod for Route Handler input validation
- sessionStorage + query params for quote→order flow state
- Client-side PDF generation for invoices

No `src/` folder — everything lives under `app/`. No component-level CSS files;
all styling in `app/globals.css` plus Tailwind utility classes.

## Design tokens

- Background: white `#FFFFFF`
- Primary: `#007DCC` (blue) — nav, headers, links, primary actions
- Accent: `#FFB900` (orange) — CTAs, highlights, badges
- Buttons: glassmorphism style (translucent fill, backdrop-blur, subtle border,
  hover glow/scale), implemented as reusable utility classes in `globals.css`

## Route map

| Route | Purpose |
|---|---|
| `/` | Landing page |
| `/products` | Category grid + all-products listing with sidebar filters |
| `/products/[slug]` | Product details |
| `/quote/[productSlug]` | Request Quotation form (qty, price calc, customer info) |
| `/order/confirm` | Confirm Order (delivery options/date) |
| `/order/success` | Order confirmed — tracking ID/link, invoice download/print |
| `/track/[trackingId]` | Mock live delivery tracking timeline |

## File structure

```
app/
  layout.tsx                    # root layout: header, footer, WhatsApp widget
  page.tsx                      # landing page
  globals.css                   # all styling, Tailwind v4 theme tokens
  products/
    page.tsx                    # category grid + listing
    [slug]/page.tsx              # product details
  quote/
    [productSlug]/page.tsx       # request quotation
  order/
    confirm/page.tsx             # confirm order
    success/page.tsx             # order confirmed + invoice
  track/
    [trackingId]/page.tsx        # mock tracking timeline
  api/
    products/route.ts
    products/[slug]/route.ts
    quotes/route.ts
    orders/route.ts
  components/
    ui/                          # ShadCN components
    header.tsx
    footer.tsx
    whatsapp-button.tsx
    product-card.tsx
    ...
  lib/
    mock-data.ts                 # temporary mock catalog — replaced by API later
    types.ts
    utils.ts
```

## Landing page sections (in order)

1. Hero — rotating background images (admin-controlled in a later phase; static
   images for now)
2. Top Categories grid
3. Featured / Top-Selling Products — tabs for week / month / year
4. Popular Brands Available
5. Quality Parts & Services You Can Trust
6. Protect Uptime · Reduce Downtime (the "Alliance Difference")
7. Services & Support
8. Client Reviews (star ratings)
9. FAQ (accordion)
10. Contact Us form
11. Sticky WhatsApp button (bottom-right), linking to `+8801713-116019`

## Product listing (`/products`)

- Left sidebar: category tree, manufacturer/brand filter, in-stock toggle,
  part-number/description search
- Right: responsive product card grid — image, brand, part number, short spec
  bullets, stock badge, price, "View Details" + "Request Quotation" buttons
- Pagination

## Product details (`/products/[slug]`)

- Image gallery (left)
- Title, brand, part number, warranty badge (right)
- Description bullets
- "Also Known As" alternate part numbers
- Specifications table
- Warranty callout block
- Quantity selector + **"Request Quotation"** button (no Add to Cart) → routes to
  `/quote/[slug]?qty=n`
- "Customers Also Bought" carousel

## Quotation → Order flow

1. **`/quote/[productSlug]`** — product summary, quantity input, live-calculated
   unit price × qty, customer info form (name, email, phone, company, country).
   Submits `POST /api/quotes` → quote object stashed in `sessionStorage`, quote ID
   passed via query param.
2. **`/order/confirm`** — reads quote from `sessionStorage`, itemized pricing,
   delivery option radio group (e.g. Standard / Express) with computed delivery
   dates. "Confirm Order" → `POST /api/orders`.
3. **`/order/success`** — order number, generated tracking ID linking to
   `/track/[trackingId]`, "Download Invoice" (client-generated PDF) and
   "Print Invoice" buttons.
4. **`/track/[trackingId]`** — mock shipment timeline (Processing → Shipped →
   In Transit → Delivered), deterministic based on tracking ID / order date.

## Mock data & API

- `lib/mock-data.ts`: ~8-10 categories, ~40-60 products spanning PLCs, drives, HMI,
  servos, contactors, sensors, power supplies, etc. Each product: brand, part
  number, spec bullets, unit price, stock status, placeholder category-style icon
  image.
- Route Handlers (`app/api/products`, `app/api/products/[slug]`, `app/api/quotes`,
  `app/api/orders`) read/write this in-memory mock data using the same
  request/response shapes a future FastAPI backend would return, so swapping the
  base URL later is a small, contained change.
- Mock data and handlers are clearly marked as temporary and intended for removal
  once the FastAPI backend is wired in.

## Footer

Address: Uttara, Dhaka, Bangladesh
Email: info@alliance.com
Phone: +8801713-116019
Copyright: "All rights reserved, Alliance 2026-2028"
Credit: "Developed by Mahir Shariar Mahin"

## Error handling

- Invalid/missing product slug → Next.js `notFound()` → custom 404
- Quote/order flow accessed without required sessionStorage state → redirect back
  to `/products` with a toast explaining why
- API route validation failures (Zod) → 400 with field-level error messages
  surfaced in the form

## Testing approach

- Manual verification via dev server: walk the full golden path (browse →
  product detail → request quote → confirm order → success → track → invoice
  download) and confirm no route errors
- Type-checking (`tsc --noEmit`) and lint as automated gates before considering
  any page complete
