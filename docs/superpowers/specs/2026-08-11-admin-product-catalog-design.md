# Product & Catalog Management — Design Spec

**Phase 2 of 4** in the Super Admin / Sub-Admin system. Builds on Phase 1's auth/shell (already committed). This phase gives both Super Admin and Sub-Admin the ability to manage the real product catalog: categories, single product add, bulk product + bulk image import with strict filename-number matching, stock control, and hero background image control.

## Background & Constraints

- No backend exists yet. Per user decision this phase writes **real files to disk** via Next.js Route Handlers (`fs`/`fs/promises`, Node runtime) — both product/category data (as JSON) and uploaded images (as real files under `public/`). This is a genuine upgrade from the pure-mock/localStorage approach used everywhere else so far.
- **Known limitation to flag, not solve here**: filesystem writes under `public/` work in local dev and traditional Node hosting, but will not work on read-only-filesystem serverless hosts (e.g. Vercel). This is acceptable for now — the real backend (FastAPI) replaces this layer later — but must be called out in code comments.
- Sub-admin's permitted access (per Phase 1's nav-config and proxy RBAC) is Products, Stock, Hero Images — all three are exactly what this phase builds, so this phase effectively completes the sub-admin's entire permitted surface.

## Architecture

### Data layer migration (zero-risk to existing consumers)

- New files: `data/products.json`, `data/categories.json` at the project root (sibling to `app/`, `public/`) — not served publicly, read/written only by server code.
- One-time seed: copy current `products` and `categoryDefs`/computed `categories` arrays from `app/lib/mock-data.ts` into these JSON files verbatim.
- `app/lib/mock-data.ts` is rewritten so its exports read from these JSON files instead of hardcoded arrays:
  ```typescript
  import "server-only";
  import fs from "fs";
  import path from "path";
  import type { Product, Category, Brand } from "./types";

  const DATA_DIR = path.join(process.cwd(), "data");

  function readJson<T>(file: string): T {
    return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), "utf-8"));
  }

  export const products: Product[] = readJson<Product[]>("products.json");
  export const categories: Category[] = readJson<Category[]>("categories.json");
  export const brands: Brand[] = [ /* unchanged, stays hardcoded — brands are not admin-manageable this phase */ ];

  // getProductBySlug, getProductsByCategory, getTopSelling, getRelatedProducts — unchanged, operate on the same in-memory arrays as today.
  ```
  All 12 existing consumers (`header.tsx`, `footer.tsx`, `brand-strip.tsx`, `category-grid.tsx`, product listing/detail pages, `sitemap.ts`, `api/products/*`, `api/quotes/route.ts`, `quote-cta.tsx`, admin best-sellers card) keep their current import path and function signatures — **no changes required in any of them**.
  - Caveat: because `mock-data.ts` reads the file once at module load, a Node long-lived dev server process will only pick up admin writes on the *next* request that re-evaluates the module (Next.js dev server re-evaluates server modules per request in the App Router for non-cached paths, which is sufficient here — no extra cache-busting needed).

### New admin data-mutation layer

`app/lib/admin-catalog.ts` (server-only) — the only place that writes to `data/*.json` and `public/images/products/*`:
```typescript
import "server-only";
import fs from "fs/promises";
import path from "path";
import type { Product, Category } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const PRODUCTS_IMAGE_DIR = path.join(process.cwd(), "public", "images", "products");

export async function readProducts(): Promise<Product[]> { /* fs.readFile + JSON.parse */ }
export async function writeProducts(products: Product[]): Promise<void> { /* JSON.stringify + fs.writeFile */ }
export async function readCategories(): Promise<Category[]> { /* ... */ }
export async function writeCategories(categories: Category[]): Promise<void> { /* ... */ }

export async function addProduct(product: Product): Promise<void> {
  const products = await readProducts();
  products.push(product);
  await writeProducts(products);
}

export async function updateProductStock(slug: string, stockQty: number): Promise<void> {
  const products = await readProducts();
  const product = products.find((p) => p.slug === slug);
  if (!product) throw new Error(`Product not found: ${slug}`);
  product.stockQty = stockQty;
  product.stock = deriveStockStatus(stockQty);
  await writeProducts(products);
}

function deriveStockStatus(qty: number): "in-stock" | "low-stock" | "out-of-stock" {
  if (qty <= 0) return "out-of-stock";
  if (qty < 10) return "low-stock";
  return "in-stock";
}

export async function saveProductImage(categorySlug: string, filename: string, buffer: Buffer): Promise<string> {
  const dir = path.join(PRODUCTS_IMAGE_DIR, categorySlug);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, filename), buffer);
  return `/images/products/${categorySlug}/${filename}`; // public URL path
}
```

### Types (additions to `app/lib/types.ts`)

```typescript
// Product gains a numeric stock quantity; `stock` status is derived from it, not set directly.
// (Existing `stock: StockStatus` field is kept for storefront display compatibility.)
export type Product = {
  // ...existing fields...
  stockQty: number; // NEW — admin sets this directly; `stock` status is derived
};

export type BulkProductRow = {
  lineNumber: number; // the leading "1.", "2." etc — also used for image filename matching
  name: string;
  partNumber: string;
  price: number;
  shortSpecs: string; // free text, comma-separated in the bulk line, split into shortSpecs[] on save
  stock: StockStatus;
};

export type BulkImportError = {
  lineNumber: number | null; // null = an image file with no matching product line
  message: string;
};
```

Note: existing seed products in `products.json` get `stockQty` backfilled during the one-time seed step (in-stock → 50, low-stock → 5, out-of-stock → 0), so `deriveStockStatus` stays consistent with their current displayed status.

### Route Handlers (new)

- `POST /api/admin/products` — single product add. Accepts `multipart/form-data` (all product fields + primary image + gallery images). Validates required fields, generates `slug` from name (kebab-case, collision-checked against existing slugs), saves images via `saveProductImage`, calls `addProduct`. Returns the created product or a 400 with field errors.
- `POST /api/admin/products/bulk` — bulk import. Accepts `multipart/form-data` with: `categorySlug`, `productsText` (the pasted numbered list), and multiple `images` files. Server-side validation (see Bulk Import Validation below) runs **before any write** — either the whole batch succeeds or nothing is written (atomic all-or-nothing, matching "otherwise, bulk product input showed an error").
- `PATCH /api/admin/products/[slug]/stock` — body `{ stockQty: number, delta?: boolean }`. `delta: true` means "stock in +N / stock out -N" (adds/subtracts from current), `delta: false` or omitted means "set exact quantity". Calls `updateProductStock`.
- `POST /api/admin/categories` — create category. Accepts `multipart/form-data` (`name`, optional icon file). Slugifies name, checks collision, saves icon under `public/images/categories/<slug>.<ext>` if provided (else a default icon), appends to `categories.json`.
- `POST /api/admin/hero-images` — replace one hero slot. Accepts `multipart/form-data` (`slot`: 1-5, `image` file). Saves as `public/images/hero/image<slot>.<ext>`, updates `data/hero-images.json` (new small file: `{ slot: number, path: string }[]`) so `hero-carousel.tsx` can read current paths.

All five routes: read the `alliance_admin_session` cookie directly (Route Handlers can call `cookies()` too), reject with 401 if missing, reject with 403 for sub-admin hitting nothing in this phase (all five actions above ARE in the sub-admin allowlist — products, stock, hero images, and categories are needed to add products at all, so category-create is implicitly allowed for sub-admin too as a supporting action).

### Bulk Import Validation (the filename-matching rule)

Given pasted text like:
```
1. SIMATIC S7-1500 CPU | 6ES7515-2AM02-0AB0 | 1250 | Compact PLC, 24V DC, PROFINET | in-stock
2. SINAMICS G120C Drive | 6SL3210-1KE21-3UF1 | 890 | 3-phase, 1.3kW, IP20 | in-stock
3. SIRIUS Contactor 9A | 3RT2015-1BB41 | 45 | 24V DC coil, AC-3 rated | low-stock
```
and uploaded image files `1-plc.jpg`, `2.png`, `3-contactor.jpg`:

1. Parse each non-empty text line with regex `^(\d+)\.\s*(.+)$`; split the remainder on `|`, trim each field. Malformed lines (wrong field count, non-numeric price, invalid stock value) produce a `BulkImportError` with that `lineNumber`.
2. For each uploaded image, extract its leading number via regex `^(\d+)[.\-_]`. An image filename that doesn't start with a number produces a `BulkImportError` with `lineNumber: null`.
3. Cross-check: every parsed product line number must have exactly one matching image (numbers must line up 1:1); every image number must have a matching product line. Missing/extra on either side produces a `BulkImportError` per offending line/file, e.g. `{ lineNumber: 4, message: "No image uploaded for product #4" }` or `{ lineNumber: null, message: "Image \"7-extra.jpg\" does not match any product line (no line starting with \"7.\")" }`.
4. If `errors.length > 0`, return **400 with the full error list** — nothing is written to disk (atomic).
5. If valid: generate slugs (collision-checked), save each image under `public/images/products/<categorySlug>/<slug>.<ext>` (renamed from the numbered upload name to the product's slug for a clean permanent filename — the number was only a matching key, not the final name), build full `Product` records (category from the batch-level picker, `stockQty` defaulted by parsed `stock` status: in-stock→50, low-stock→5, out-of-stock→0), append all to `products.json` in one write.

### UI — Admin Products Page (`app/admin/(dashboard)/products/page.tsx`, rewritten)

Replaces the Phase 1 "coming soon" stub. Tabbed layout (reusing the existing `Tabs` primitive):
- **Catalog** tab: product table (image thumb, name, category, price, stock qty + status badge, actions) with a "Add Product" button opening a dialog form (all `Product` fields per user's "full field set" decision: name, partNumber, category select, brand select, price, warranty years, short specs (3 lines), description bullets (repeatable text inputs), alternate part numbers (repeatable), specifications key/value pairs (repeatable), primary image upload, gallery upload (multi-file)). Needs a `Dialog` shadcn component — not yet installed, added this phase.
- **Bulk Import** tab: category picker, textarea for the numbered product list (with the exact format documented as placeholder text), multi-file image upload, "Validate & Import" button. On validation failure, renders the full error list (line-by-line) without navigating away so the admin can fix and resubmit. On success, toast + table refresh.
- **Categories** tab: grid of existing categories (icon, name, product count) + "Create Category" dialog (name, optional icon upload).

### UI — Admin Stock Page (`app/admin/(dashboard)/stock/page.tsx`, new — currently an inert "Soon" nav link, this phase activates it)

Table of all products: name, category, current `stockQty`, status badge, and inline "Stock In" / "Stock Out" quantity steppers (small number input + button) that PATCH the stock route immediately with `delta: true`. A "Set Exact Quantity" option per row for correcting counts directly.

### UI — Admin Hero Images Page (`app/admin/(dashboard)/hero-images/page.tsx`, new — activates the other currently-inert nav link)

Five slots (matching the user's `image1-5.jpg` naming), each showing the current image (or empty state for unused slots 4-5, since only 3 exist today) with an upload control to replace it. Live preview matches the storefront hero carousel's aspect ratio. Uploading calls `POST /api/admin/hero-images`; `hero-carousel.tsx` is updated to read slide image paths from `data/hero-images.json` (via a small server-side read, same `mock-data.ts`-style pattern) instead of the hardcoded `slides` array's `image` fields — headline/subheadline text stays hardcoded in the component (not in scope — spec only asked for background image control).

### Nav & RBAC updates

- `app/admin/nav-config.ts`: flip `enabled: false → true` for Stock and Hero Images (both already role-gated to `["super", "sub"]` from Phase 1).
- `proxy.ts`: `SUB_ADMIN_ALLOWED_PREFIXES` already includes `/admin/stock` and `/admin/hero-images` from Phase 1 — no change needed there. Products page already allowed.

## Error Handling

- All Route Handlers validate the session cookie first (401 if missing) — consistent with Phase 1's pattern.
- Bulk import is atomic: any validation failure blocks all writes for that batch, full error list returned together (not one-at-a-time).
- Single product / category slug collisions: append a numeric suffix (`-2`, `-3`) rather than erroring, since names can legitimately repeat across different part numbers in this domain (e.g. same product name, different variant) — but part number collisions ARE blocked with an explicit error, since part numbers must be unique.
- Filesystem write failures (disk full, permission error) surface as a 500 with a generic "Could not save changes" toast — not expected in normal operation, not worth granular handling.

## Testing Approach

- `npx tsc --noEmit` and `npm run lint` clean before each commit.
- Live browser verification (Chrome DevTools MCP):
  - Add a single product with full fields + images as super admin → verify it appears in the admin Catalog table AND on the real storefront `/products` listing and its own detail page after navigating there.
  - Bulk import: a valid 3-product batch with matching images → verify all 3 land correctly with images at the right category folder path.
  - Bulk import: an intentionally mismatched batch (missing image for line 2) → verify the full error is shown and nothing was written (products.json unchanged, no stray files).
  - Create a new category → verify it appears in the category picker and on the storefront category grid.
  - Stock In / Stock Out on an existing product → verify quantity and status badge update, and the storefront reflects the new status.
  - Replace a hero image slot → verify the storefront hero carousel shows the new image.
  - Sub-admin login → verify Products, Stock, Hero Images are all now clickable (not "Soon"), and all three flows above work identically for sub-admin.
  - Sub-admin still cannot reach `/admin` (Overview) — regression check against Phase 1's fix.

## Out of Scope (deferred)

- Product editing/deletion (only add is built this phase; edit/delete would be natural follow-ups).
- Brand management (brands stay a fixed hardcoded list).
- Hero slide headline/subheadline text editing (image only, per user's original spec wording).
- Phase 3 (orders/quotations/contact/email) and Phase 4 (employees/tasks/leave) — unchanged from the original 4-phase plan.
