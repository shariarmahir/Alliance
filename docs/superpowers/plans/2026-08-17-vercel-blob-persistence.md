# Vercel Blob Persistence Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace local-disk `fs`/`fs/promises` reads and writes across the app's data
layer with Vercel Blob, so admin mutations (quotations, orders, employees, tasks,
leave, daily reports, contact requests, products, categories, hero images) work on
Vercel's read-only serverless filesystem instead of throwing in production.

**Architecture:** Every JSON file gets one fixed Blob pathname. The three write-layer
modules (`admin-operations.ts`, `admin-catalog.ts`, `admin-employees.ts`) keep every
exported function's exact name/params/return type — only their internal
`readJsonFile`/`writeJsonFile` helpers change from `fs` calls to Blob `put()`/`fetch()`
calls, via one new shared helper module. `mock-data.ts`'s `products`/`categories`
Proxies (which relied on synchronous `fs.readFileSync`) are replaced with real async
functions, since Blob reads are HTTP fetches. Binary image uploads
(`saveProductImage`, `saveCategoryIcon`, `saveHeroImage`) switch from `public/images/...`
disk writes to Blob `put()`, returning the Blob's public URL. A one-time seed script
uploads the current `data/*.json` files and `public/images/**` binaries into the
connected Blob store before the app can read anything in production.

**Tech Stack:** Next.js 16 (App Router), TypeScript, `@vercel/blob` SDK, no test
framework in this repo (verification is `npx tsc --noEmit` + `npm run lint` +
`npm run build` + manual curl/Node scratch-script checks against the real dev server,
matching this project's existing verification convention).

## Global Constraints

- No `src/` folder — everything under `app/`. (CLAUDE.md)
- Server-only data modules (`import "server-only"`) must never be imported into a
  `"use client"` file directly. (CLAUDE.md)
- Short, direct code — no speculative abstractions, no unused config toggles.
  (CLAUDE.md)
- Before every push: `npx tsc --noEmit` → `npm run lint` → `npm run build`, in that
  order, all three clean. (CLAUDE.md)
- Every exported function in `admin-operations.ts`, `admin-catalog.ts`,
  `admin-employees.ts` keeps its exact current name, parameter types, and return type
  — no call site outside these three files may need to change. (spec)
- Local dev and production share one Vercel Blob store — no separate dev/staging
  store, no environment branching in code. (spec)
- `BLOB_READ_WRITE_TOKEN` and `BLOB_STORE_ID` already exist in
  `Alliance-frontend/.env.local` (git-ignored via `.env*` in `.gitignore`) and are
  already connected to the Vercel project's environment variables. Do not regenerate
  or rotate these.
- Data volume is small (~80KB across 11 JSON files) — no locking/concurrency-control
  layer is in scope (spec explicitly defers this).

---

### Task 1: Install `@vercel/blob` and add the shared Blob JSON helper

**Files:**
- Modify: `package.json` (add dependency)
- Create: `app/lib/blob-store.ts`

**Interfaces:**
- Produces: `readBlobJson<T>(pathname: string): Promise<T>`, `writeBlobJson<T>(pathname: string, data: T): Promise<void>` — used by Tasks 2, 3, 4 to replace `fs`-based `readJsonFile`/`writeJsonFile` in the three write-layer modules.
- Produces: `BLOB_PREFIX = "data/"` constant — the fixed pathname prefix every JSON blob lives under (e.g. `data/quotations.json`).

- [ ] **Step 1: Install the SDK**

Run: `npm install @vercel/blob`
Expected: `package.json` gains `"@vercel/blob": "^..."` under `dependencies`, `package-lock.json` updates.

- [ ] **Step 2: Write `app/lib/blob-store.ts`**

```typescript
import "server-only";
import { put, head } from "@vercel/blob";

// Shared Blob-backed replacement for the old fs.readFile/fs.writeFile JSON
// helpers duplicated across admin-operations.ts, admin-catalog.ts, and
// admin-employees.ts. Vercel's serverless functions run on a read-only
// filesystem outside /tmp, so those fs calls threw in production — every
// JSON file now lives at a fixed pathname in the project's connected Blob
// store instead, addressed the same way on every read/write.

export const BLOB_PREFIX = "data/";

function blobUrl(pathname: string): string {
  return `https://${process.env.BLOB_STORE_ID}.public.blob.vercel-storage.com/${pathname}`;
}

export async function readBlobJson<T>(pathname: string): Promise<T> {
  const url = blobUrl(BLOB_PREFIX + pathname);
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Blob read failed for ${pathname}: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function writeBlobJson<T>(pathname: string, data: T): Promise<void> {
  await put(BLOB_PREFIX + pathname, JSON.stringify(data, null, 2) + "\n", {
    access: "public",
    contentType: "application/json",
    allowOverwrite: true,
  });
}
```

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors (this file has no consumers yet, so it only checks the file itself compiles).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json app/lib/blob-store.ts
git commit -m "Add Vercel Blob-backed JSON read/write helper"
```

---

### Task 2: Seed the Blob store from the current `data/*.json` files and `public/images/**`

This must run before Task 3 changes any read path, so the Blob store already has real
data in it by the time the app tries to read from Blob instead of disk.

**Files:**
- Create: `scripts/seed-blob.mjs`

**Interfaces:**
- Consumes: `@vercel/blob`'s `put()` directly (plain script, not the TS helper from Task 1 — scripts run via plain Node, not through Next's TS pipeline).
- Produces: nothing consumed by later tasks in code — this is a one-time operational script, not part of the runtime app. Its effect (populated Blob store) is what Task 3 onward depends on.

- [ ] **Step 1: Write the seed script**

```javascript
// scripts/seed-blob.mjs
// One-time migration: uploads every data/*.json file and every binary under
// public/images/{products,categories,hero}/ into the connected Vercel Blob
// store, patching image-path fields in the JSON to point at the new Blob
// URLs before uploading the JSON itself. Run once after BLOB_READ_WRITE_TOKEN
// is configured; not part of the app's runtime code path.
import { put } from "@vercel/blob";
import { readFile, readdir } from "fs/promises";
import path from "path";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data");
const IMAGES_DIR = path.join(ROOT, "public", "images");

async function uploadBinaryDir(localSubdir, blobPrefix) {
  const dir = path.join(IMAGES_DIR, localSubdir);
  const urlByLocalPath = new Map();
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true, recursive: true });
  } catch {
    return urlByLocalPath; // directory doesn't exist — nothing to seed
  }
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const relDir = path.relative(dir, entry.parentPath ?? entry.path);
    const relPath = relDir ? `${relDir}/${entry.name}` : entry.name;
    const localFsPath = path.join(dir, relPath);
    const buffer = await readFile(localFsPath);
    const blob = await put(`${blobPrefix}/${relPath}`, buffer, {
      access: "public",
      allowOverwrite: true,
    });
    urlByLocalPath.set(`/images/${localSubdir}/${relPath}`.replace(/\\/g, "/"), blob.url);
  }
  return urlByLocalPath;
}

async function uploadJson(filename, data) {
  await put(`data/${filename}`, JSON.stringify(data, null, 2) + "\n", {
    access: "public",
    contentType: "application/json",
    allowOverwrite: true,
  });
  console.log(`  uploaded data/${filename}`);
}

async function main() {
  console.log("Seeding product images...");
  const productUrls = await uploadBinaryDir("products", "images/products");
  console.log(`  ${productUrls.size} product image(s) uploaded`);

  console.log("Seeding category icons...");
  const categoryUrls = await uploadBinaryDir("categories", "images/categories");
  console.log(`  ${categoryUrls.size} category icon(s) uploaded`);

  console.log("Seeding hero images...");
  const heroUrls = await uploadBinaryDir("hero", "images/hero");
  console.log(`  ${heroUrls.size} hero image(s) uploaded`);

  console.log("Patching and uploading data/products.json...");
  const products = JSON.parse(await readFile(path.join(DATA_DIR, "products.json"), "utf-8"));
  for (const p of products) {
    if (productUrls.has(p.image)) p.image = productUrls.get(p.image);
    p.gallery = (p.gallery ?? []).map((g) => productUrls.get(g) ?? g);
  }
  await uploadJson("products.json", products);

  console.log("Patching and uploading data/categories.json...");
  const categories = JSON.parse(await readFile(path.join(DATA_DIR, "categories.json"), "utf-8"));
  for (const c of categories) {
    if (c.icon && categoryUrls.has(c.icon)) c.icon = categoryUrls.get(c.icon);
  }
  await uploadJson("categories.json", categories);

  console.log("Patching and uploading data/hero-images.json...");
  const heroEntries = JSON.parse(await readFile(path.join(DATA_DIR, "hero-images.json"), "utf-8"));
  for (const h of heroEntries) {
    const withoutQuery = h.path.split("?")[0];
    if (heroUrls.has(withoutQuery)) h.path = heroUrls.get(withoutQuery);
  }
  await uploadJson("hero-images.json", heroEntries);

  const remaining = [
    "orders.json",
    "quotations.json",
    "contact-requests.json",
    "emails.json",
    "employees.json",
    "tasks.json",
    "leave-requests.json",
    "daily-reports.json",
  ];
  for (const filename of remaining) {
    console.log(`Uploading ${filename}...`);
    const data = JSON.parse(await readFile(path.join(DATA_DIR, filename), "utf-8"));
    await uploadJson(filename, data);
  }

  console.log("\nDone. All data/*.json files and public/images binaries are now in Blob.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Check whether `categories.json` actually has an `icon` field**

Run: `node -e "console.log(JSON.parse(require('fs').readFileSync('data/categories.json','utf-8'))[0])"`
Expected: prints the first category object — confirm the field name used for its icon path (the script above assumes `icon`; if the real field is named differently, e.g. `iconPath`, fix the script's `c.icon` references to match before running it).

- [ ] **Step 3: Run the seed script against the real connected Blob store**

Run: `node scripts/seed-blob.mjs`
Expected: console output listing each uploaded file, ending with "Done. All data/*.json files and public/images binaries are now in Blob." If it errors with an auth/token message, confirm `.env.local` is being loaded — Node scripts don't auto-load `.env.local` the way Next does, so run it as: `node --env-file=.env.local scripts/seed-blob.mjs` instead (Node 20.6+ supports `--env-file` natively; this repo is on Node 24).

- [ ] **Step 4: Verify a couple of uploaded blobs are readable**

Run: `node --env-file=.env.local -e "fetch('https://' + process.env.BLOB_STORE_ID + '.public.blob.vercel-storage.com/data/quotations.json').then(r => r.json()).then(d => console.log(Array.isArray(d), d.length))"`
Expected: prints `true` followed by the current quotation count (matches `data/quotations.json`'s current array length).

- [ ] **Step 5: Commit the seed script**

```bash
git add scripts/seed-blob.mjs
git commit -m "Add one-time seed script to populate Vercel Blob from data/*.json and public/images"
```

---

### Task 3: Migrate `admin-operations.ts` to Blob (orders, quotations, contact requests, emails)

**Files:**
- Modify: `app/lib/admin-operations.ts`

**Interfaces:**
- Consumes: `readBlobJson`, `writeBlobJson` from `app/lib/blob-store.ts` (Task 1).
- Produces: no change — `readOrders`, `writeOrders`, `addOrder`, `updateOrderStatus`, `readQuotations`, `writeQuotations`, `addQuotation`, `updateQuotationStatus`, `readQuotation`, `confirmQuotation`, `nextConfirmationSequence`, `readContactRequests`, `writeContactRequests`, `addContactRequest`, `markContactRequestHandled`, `readEmails` all keep their exact existing signatures.

- [ ] **Step 1: Replace the fs-based helpers and imports**

In `app/lib/admin-operations.ts`, replace lines 1-37 (the `import`, `DATA_DIR` const, and `readJsonFile`/`writeJsonFile` helpers) with:

```typescript
import "server-only";
import { readBlobJson, writeBlobJson } from "./blob-store";
import type {
  Order,
  Quotation,
  ContactRequest,
  OrderStatus,
  QuotationStatus,
  MockEmail,
  OrderConfirmation,
} from "./types";

// Server-only read/write layer for Phase 3 (orders, quotations, contact
// requests, mock emails) — mirrors app/lib/admin-catalog.ts's pattern.
//
// Every export here is an async function, calling fresh on every
// request/invocation via Vercel Blob (see app/lib/blob-store.ts) — no
// module-level cache to go stale, same reasoning mock-data.ts's Proxies
// solved differently for its own module.

async function readJsonFile<T>(filename: string): Promise<T> {
  return readBlobJson<T>(filename);
}

async function writeJsonFile<T>(filename: string, data: T): Promise<void> {
  await writeBlobJson(filename, data);
}
```

Leave every function below this block (`readOrders` through `readEmails`) completely
untouched — they only call `readJsonFile`/`writeJsonFile`, whose signatures are
unchanged.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors referencing `admin-operations.ts`.

- [ ] **Step 3: Start the dev server and verify a read path**

Run: `npm run dev` (in background/separate terminal), then:
`curl -s http://localhost:3000/api/admin/quotations -H "Cookie: autolink_admin_session=%7B%22role%22%3A%22super%22%2C%22name%22%3A%22Test%22%2C%22email%22%3A%22t%40t.com%22%7D" | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(JSON.parse(d).quotations.length))"`
Expected: prints the same quotation count as Task 2 Step 4's check — confirms the app now reads quotations from Blob, not disk.

(If there's no existing `GET /api/admin/quotations` route matching this shape, instead
verify via the quotation detail route: `curl -s http://localhost:3000/api/quotations/<a-real-id-from-data/quotations.json>` and confirm it returns that quotation's JSON.)

- [ ] **Step 4: Verify the write path — reproduce and fix the original bug**

Run:
```bash
curl -s -X POST http://localhost:3000/api/quotations \
  -H "Content-Type: application/json" \
  -d '{"items":[{"slug":"test-part","partNumber":"TP-1","name":"Test Part","brand":"Test","image":"/images/products/test.jpg","price":0,"quantity":1}],"total":0,"details":{"fullName":"Test User","email":"test@example.com","phone":"123","jobTitle":"Manager","companyName":"Test Co","country":"Bangladesh","taxId":"","companyWebsite":"","preferredContact":"email","leadTime":"standard","notes":"","submittedAt":"2026-08-17T00:00:00.000Z"}}'
```
Expected: HTTP 201 with a JSON body containing a `quotation` object with a new `id`. This is the exact request the "Send quotation" button makes — this is the original bug, now fixed.

- [ ] **Step 5: Confirm the write actually persisted to Blob (not just returned success)**

Run: `node --env-file=.env.local -e "fetch('https://' + process.env.BLOB_STORE_ID + '.public.blob.vercel-storage.com/data/quotations.json', {cache:'no-store'}).then(r => r.json()).then(d => console.log(d.length, d[d.length-1].details.fullName))"`
Expected: prints a count one higher than Task 2 Step 4's check, with `"Test User"` as the last entry's name — confirms the POST actually wrote through to Blob, not just returned a fake success.

- [ ] **Step 6: Commit**

```bash
git add app/lib/admin-operations.ts
git commit -m "Migrate admin-operations.ts from fs to Vercel Blob"
```

---

### Task 4: Migrate `admin-employees.ts` to Blob (employees, tasks, leave requests, daily reports)

**Files:**
- Modify: `app/lib/admin-employees.ts`

**Interfaces:**
- Consumes: `readBlobJson`, `writeBlobJson` from `app/lib/blob-store.ts` (Task 1).
- Produces: no change — `readEmployees`, `writeEmployees`, `addEmployee`, `readTasks`, `writeTasks`, `addTask`, `updateTaskStatus`, `readLeaveRequests`, `writeLeaveRequests`, `addLeaveRequest`, `updateLeaveStatus`, `readDailyReports`, `writeDailyReports`, `addDailyReport` all keep their exact existing signatures.

- [ ] **Step 1: Replace the fs-based helpers and imports**

In `app/lib/admin-employees.ts`, replace lines 1-26 (the `import`s, `DATA_DIR` const, and `readJsonFile`/`writeJsonFile` helpers) with:

```typescript
import "server-only";
import { readBlobJson, writeBlobJson } from "./blob-store";
import type { Employee, Task, LeaveRequest, DailyReport, TaskStatus, LeaveStatus } from "./types";

// Server-only read/write layer for Phase 4 (employees, tasks, leave requests,
// daily reports) — mirrors app/lib/admin-operations.ts's pattern.
//
// Always reads fresh via Blob per call (no module-level caching), same as
// admin-operations.ts.

async function readJsonFile<T>(filename: string): Promise<T> {
  return readBlobJson<T>(filename);
}

async function writeJsonFile<T>(filename: string, data: T): Promise<void> {
  await writeBlobJson(filename, data);
}
```

Leave every function below this block unchanged.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors referencing `admin-employees.ts`.

- [ ] **Step 3: Verify a read + write path**

With `npm run dev` still running:
`curl -s http://localhost:3000/api/admin/tasks -H "Cookie: autolink_admin_session=%7B%22role%22%3A%22super%22%2C%22name%22%3A%22Test%22%2C%22email%22%3A%22t%40t.com%22%7D"`
Expected: HTTP 200 with the current tasks array (matches `data/tasks.json`'s seeded content via Blob).

- [ ] **Step 4: Commit**

```bash
git add app/lib/admin-employees.ts
git commit -m "Migrate admin-employees.ts from fs to Vercel Blob"
```

---

### Task 5: Migrate `admin-catalog.ts` to Blob (products, categories, hero images, binary uploads)

**Files:**
- Modify: `app/lib/admin-catalog.ts`

**Interfaces:**
- Consumes: `readBlobJson`, `writeBlobJson` from `app/lib/blob-store.ts` (Task 1); `put` from `@vercel/blob` directly (for binary image uploads, which need raw `Buffer` handling `readBlobJson`/`writeBlobJson` don't provide).
- Produces: no change to `readProducts`, `writeProducts`, `addProduct`, `updateProductStock`, `deriveStockStatus`, `defaultStockQtyForStatus`, `readCategories`, `writeCategories`, `addCategory`, `readHeroImages`, `writeHeroImages`, `slugify`, `uniqueSlug` signatures. `saveProductImage`, `saveCategoryIcon`, `saveHeroImage` keep their exact parameter types and `Promise<string>` return type — only what that returned string looks like changes (a Blob URL instead of a local `/images/...` path, matching what Task 2's seed script already patched into the JSON).

- [ ] **Step 1: Replace the module header and JSON read/write calls**

In `app/lib/admin-catalog.ts`, replace lines 1-16 with:

```typescript
import "server-only";
import { put } from "@vercel/blob";
import { readBlobJson, writeBlobJson } from "./blob-store";
import type { Category, Product, StockStatus } from "./types";

// The only module that writes to Blob-backed data/*.json and Blob-backed
// binary images (formerly public/images/{products,categories,hero}/*) — see
// app/lib/blob-store.ts for why fs writes don't work on Vercel.

export type HeroImageEntry = { slot: number; path: string };
```

- [ ] **Step 2: Replace the products read/write functions**

Replace:
```typescript
export async function readProducts(): Promise<Product[]> {
  const raw = await fs.readFile(path.join(DATA_DIR, "products.json"), "utf-8");
  return JSON.parse(raw);
}

export async function writeProducts(products: Product[]): Promise<void> {
  await fs.writeFile(path.join(DATA_DIR, "products.json"), JSON.stringify(products, null, 2) + "\n");
  await syncCategoryProductCounts(products);
}
```
with:
```typescript
export async function readProducts(): Promise<Product[]> {
  return readBlobJson<Product[]>("products.json");
}

export async function writeProducts(products: Product[]): Promise<void> {
  await writeBlobJson("products.json", products);
  await syncCategoryProductCounts(products);
}
```

- [ ] **Step 3: Replace `saveProductImage`**

Replace:
```typescript
export async function saveProductImage(categorySlug: string, filename: string, buffer: Buffer): Promise<string> {
  const dir = path.join(PRODUCTS_IMAGE_DIR, categorySlug);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, filename), buffer);
  return `/images/products/${categorySlug}/${filename}`; // public URL path
}
```
with:
```typescript
export async function saveProductImage(categorySlug: string, filename: string, buffer: Buffer): Promise<string> {
  const blob = await put(`images/products/${categorySlug}/${filename}`, buffer, {
    access: "public",
    allowOverwrite: true,
  });
  return blob.url;
}
```

- [ ] **Step 4: Replace the categories read/write functions**

Replace:
```typescript
export async function readCategories(): Promise<Category[]> {
  const raw = await fs.readFile(path.join(DATA_DIR, "categories.json"), "utf-8");
  return JSON.parse(raw);
}

export async function writeCategories(categories: Category[]): Promise<void> {
  await fs.writeFile(path.join(DATA_DIR, "categories.json"), JSON.stringify(categories, null, 2) + "\n");
}
```
with:
```typescript
export async function readCategories(): Promise<Category[]> {
  return readBlobJson<Category[]>("categories.json");
}

export async function writeCategories(categories: Category[]): Promise<void> {
  await writeBlobJson("categories.json", categories);
}
```

- [ ] **Step 5: Replace `saveCategoryIcon`**

Replace:
```typescript
export async function saveCategoryIcon(slug: string, filename: string, buffer: Buffer): Promise<string> {
  await fs.mkdir(CATEGORIES_IMAGE_DIR, { recursive: true });
  const ext = path.extname(filename) || ".svg";
  const finalName = `${slug}${ext}`;
  await fs.writeFile(path.join(CATEGORIES_IMAGE_DIR, finalName), buffer);
  return `/images/categories/${finalName}`;
}
```
with:
```typescript
export async function saveCategoryIcon(slug: string, filename: string, buffer: Buffer): Promise<string> {
  const ext = path.extname(filename) || ".svg";
  const finalName = `${slug}${ext}`;
  const blob = await put(`images/categories/${finalName}`, buffer, {
    access: "public",
    allowOverwrite: true,
  });
  return blob.url;
}
```

(`path.extname` still comes from the `path` module — keep `import path from "path";` in
the file; only `fs` is being removed. Re-check Step 1's replacement didn't drop the
`path` import — if it did, add `import path from "path";` back alongside the other
imports.)

- [ ] **Step 6: Replace the hero images read/write functions and `saveHeroImage`**

Replace:
```typescript
export async function readHeroImages(): Promise<HeroImageEntry[]> {
  const raw = await fs.readFile(path.join(DATA_DIR, "hero-images.json"), "utf-8");
  return JSON.parse(raw);
}

export async function writeHeroImages(entries: HeroImageEntry[]): Promise<void> {
  await fs.writeFile(path.join(DATA_DIR, "hero-images.json"), JSON.stringify(entries, null, 2) + "\n");
}

export async function saveHeroImage(slot: number, filename: string, buffer: Buffer): Promise<string> {
  await fs.mkdir(HERO_IMAGE_DIR, { recursive: true });
  const ext = path.extname(filename) || ".jpg";
  const finalName = `image${slot}${ext}`;
  await fs.writeFile(path.join(HERO_IMAGE_DIR, finalName), buffer);
  // Cache-bust: the filename is deterministic per slot, so replacing an image
  // with the same extension produces an identical URL — the browser and
  // Next's image optimizer would keep serving the old cached bytes without
  // this query param changing on every upload.
  const publicPath = `/images/hero/${finalName}?v=${Date.now()}`;

  const entries = await readHeroImages();
  const existing = entries.find((e) => e.slot === slot);
  if (existing) {
    existing.path = publicPath;
  } else {
    entries.push({ slot, path: publicPath });
  }
  entries.sort((a, b) => a.slot - b.slot);
  await writeHeroImages(entries);
  return publicPath;
}
```
with:
```typescript
export async function readHeroImages(): Promise<HeroImageEntry[]> {
  return readBlobJson<HeroImageEntry[]>("hero-images.json");
}

export async function writeHeroImages(entries: HeroImageEntry[]): Promise<void> {
  await writeBlobJson("hero-images.json", entries);
}

export async function saveHeroImage(slot: number, filename: string, buffer: Buffer): Promise<string> {
  const ext = path.extname(filename) || ".jpg";
  const finalName = `image${slot}${ext}`;
  // Cache-bust: Blob's allowOverwrite reuses the same pathname per slot, so a
  // replacement upload needs a distinct query param or the browser/Next's
  // image optimizer will keep serving the old cached bytes.
  const blob = await put(`images/hero/${finalName}`, buffer, {
    access: "public",
    allowOverwrite: true,
  });
  const publicPath = `${blob.url}?v=${Date.now()}`;

  const entries = await readHeroImages();
  const existing = entries.find((e) => e.slot === slot);
  if (existing) {
    existing.path = publicPath;
  } else {
    entries.push({ slot, path: publicPath });
  }
  entries.sort((a, b) => a.slot - b.slot);
  await writeHeroImages(entries);
  return publicPath;
}
```

- [ ] **Step 7: Remove the now-unused local directory constants**

Delete these lines (no longer referenced by anything after Steps 2-6):
```typescript
const DATA_DIR = path.join(process.cwd(), "data");
const PRODUCTS_IMAGE_DIR = path.join(process.cwd(), "public", "images", "products");
const CATEGORIES_IMAGE_DIR = path.join(process.cwd(), "public", "images", "categories");
const HERO_IMAGE_DIR = path.join(process.cwd(), "public", "images", "hero");
```

- [ ] **Step 8: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors referencing `admin-catalog.ts`. If `path` is reported unused, confirm Step 5's note — `path.extname` calls in `saveProductImage`... wait, `saveProductImage` in Step 3 no longer uses `path` at all; only `saveCategoryIcon` and `saveHeroImage` still call `path.extname`. Confirm `path` import stays because those two still use it.

- [ ] **Step 9: Verify a product read + stock update round-trip**

With `npm run dev` running:
```bash
curl -s http://localhost:3000/api/products | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{const j=JSON.parse(d);console.log(j.products.length, j.products[0].slug)})"
```
Expected: prints the product count and first slug matching `data/products.json`'s seeded content (now served from Blob).

- [ ] **Step 10: Commit**

```bash
git add app/lib/admin-catalog.ts
git commit -m "Migrate admin-catalog.ts from fs to Vercel Blob, including binary image uploads"
```

---

### Task 6: Convert `mock-data.ts`'s `products`/`categories` to async functions

**Files:**
- Modify: `app/lib/mock-data.ts`

**Interfaces:**
- Consumes: `readBlobJson` from `app/lib/blob-store.ts` (Task 1).
- Produces (renamed from the current plain-array exports): `getAllProducts(): Promise<Product[]>`, `getAllCategories(): Promise<Category[]>`, `getProductBySlug(slug: string): Promise<Product | undefined>`, `getProductsByCategory(slug: string): Promise<Product[]>`, `getTopSelling(period: "week" | "month" | "year"): Promise<Product[]>`, `getRelatedProducts(slug: string): Promise<Product[]>`. `brands` and `reviews` and `faqs` stay as plain synchronous arrays (hardcoded, not Blob-backed).

- [ ] **Step 1: Replace the module header and the Proxy machinery**

Replace lines 1-49 (everything from the top comment through the `freshArray` function) with:

```typescript
// TEMPORARY MOCK DATA — replace with FastAPI backend
//
// products/categories read from Blob-backed data/*.json (written to by the
// admin catalog write layer, app/lib/admin-catalog.ts). Every export that
// touches them is async — Blob reads are HTTP fetches, unlike the local-disk
// fs.readFileSync this module used before the Vercel Blob migration, which
// let it fake synchronous "always fresh" arrays via a Proxy. Callers (all
// Server Components or Route Handlers) await these directly.
import "server-only";
import { readBlobJson } from "./blob-store";
import type { Brand, Category, FaqItem, Product, Review } from "./types";
```

- [ ] **Step 2: Replace the products/categories exports**

Replace:
```typescript
export const products: Product[] = freshArray<Product>("products.json");
export const categories: Category[] = freshArray<Category>("categories.json");
```
with:
```typescript
export async function getAllProducts(): Promise<Product[]> {
  return readBlobJson<Product[]>("products.json");
}

export async function getAllCategories(): Promise<Category[]> {
  return readBlobJson<Category[]>("categories.json");
}
```

- [ ] **Step 3: Replace the helper functions at the bottom of the file**

Replace:
```typescript
export function getProductBySlug(slug: string): Product | undefined {
  return products.find((p) => p.slug === slug);
}

export function getProductsByCategory(slug: string): Product[] {
  return products.filter((p) => p.categorySlug === slug);
}

export function getTopSelling(period: "week" | "month" | "year"): Product[] {
  const rankKey = period === "week" ? "weekRank" : period === "month" ? "monthRank" : "yearRank";
  return products
    .filter((p) => p[rankKey] !== undefined)
    .sort((a, b) => (a[rankKey] as number) - (b[rankKey] as number))
    .slice(0, 6);
}

export function getRelatedProducts(slug: string): Product[] {
  const product = getProductBySlug(slug);
  if (!product) return [];
  return products
    .filter((p) => p.slug !== slug && p.categorySlug === product.categorySlug)
    .slice(0, 4);
}
```
with:
```typescript
export async function getProductBySlug(slug: string): Promise<Product | undefined> {
  const products = await getAllProducts();
  return products.find((p) => p.slug === slug);
}

export async function getProductsByCategory(slug: string): Promise<Product[]> {
  const products = await getAllProducts();
  return products.filter((p) => p.categorySlug === slug);
}

export async function getTopSelling(period: "week" | "month" | "year"): Promise<Product[]> {
  const products = await getAllProducts();
  const rankKey = period === "week" ? "weekRank" : period === "month" ? "monthRank" : "yearRank";
  return products
    .filter((p) => p[rankKey] !== undefined)
    .sort((a, b) => (a[rankKey] as number) - (b[rankKey] as number))
    .slice(0, 6);
}

export async function getRelatedProducts(slug: string): Promise<Product[]> {
  const product = await getProductBySlug(slug);
  if (!product) return [];
  const products = await getAllProducts();
  return products
    .filter((p) => p.slug !== slug && p.categorySlug === product.categorySlug)
    .slice(0, 4);
}
```

- [ ] **Step 4: Confirm `brands`, `reviews`, `faqs` are untouched**

These three exports stay exactly as they are in the current file (plain hardcoded
arrays, no Blob involvement) — no edit needed, just confirm they weren't accidentally
included in the Step 1-3 replacements.

- [ ] **Step 5: Type-check (expect many errors — this is expected and drives Task 7)**

Run: `npx tsc --noEmit`
Expected: errors in every file listed in Task 7 (`products` / `categories` no longer
exist as named exports; `getProductBySlug` etc. now return `Promise<...>` instead of
the bare type). This is the expected, temporary state — Task 7 fixes every one.

- [ ] **Step 6: Commit**

```bash
git add app/lib/mock-data.ts
git commit -m "Convert mock-data.ts products/categories from sync Proxy to async Blob-backed functions"
```

---

### Task 7: Update every `mock-data.ts` consumer to the new async API

**Files:**
- Modify: `app/(site)/products/page.tsx`
- Modify: `app/(site)/products/[slug]/page.tsx`
- Modify: `app/admin/(dashboard)/best-sellers-card.tsx`
- Modify: `app/admin/(dashboard)/products/page.tsx`
- Modify: `app/admin/(dashboard)/stock/page.tsx`
- Modify: `app/api/products/route.ts`
- Modify: `app/api/products/[slug]/route.ts`
- Modify: `app/components/brand-strip.tsx` (no functional change — confirm it only imports `brands`, untouched by Task 6)
- Modify: `app/components/category-grid.tsx`
- Modify: `app/components/footer.tsx`
- Modify: `app/components/header.tsx`
- Modify: `app/sitemap.ts`
- Modify: `app/components/client-reviews.tsx` (no functional change — confirm it only imports `reviews`, untouched by Task 6)

**Interfaces:**
- Consumes: `getAllProducts`, `getAllCategories`, `getProductBySlug`, `getRelatedProducts`, `getTopSelling` from `app/lib/mock-data.ts` (Task 6).

- [ ] **Step 1: `app/(site)/products/page.tsx`**

Change the import and the two usages:
```typescript
import { getAllCategories, getAllProducts } from "@/app/lib/mock-data";
import { brands } from "@/app/lib/mock-data";
```
(or combine into one import line: `import { getAllCategories, getAllProducts, brands } from "@/app/lib/mock-data";`)

Find the function that currently does `let filtered = products;` and `categories.find(...)` — since this file's default export is already an `async` Server Component (confirm via its `export default async function`), add at the top of that function body:
```typescript
const categories = await getAllCategories();
const products = await getAllProducts();
```
before the existing `let filtered = products;` line. Then change `<ProductFilters categories={[...categories]} brands={brands} />` to `<ProductFilters categories={categories} brands={brands} />` (the spread is no longer needed — `categories` is now a plain array, not a Proxy).

- [ ] **Step 2: `app/(site)/products/[slug]/page.tsx`**

Change:
```typescript
import { getProductBySlug, getRelatedProducts } from "@/app/lib/mock-data";
```
stays the same import line (names unchanged). Find every call site of `getProductBySlug(slug)` and `getRelatedProducts(slug)` in this file (in `generateMetadata` and the default export component — both already `async function`s) and prefix each with `await`:
```typescript
const product = await getProductBySlug(slug);
```
```typescript
const related = await getRelatedProducts(slug);
```

- [ ] **Step 3: `app/admin/(dashboard)/best-sellers-card.tsx`**

Replace:
```typescript
import { getTopSelling } from "@/app/lib/mock-data";

// Mock unit-sold figures derived from rank position — replace with real sales
// data before production.
function mockUnitsSold(rank: number): number {
  return Math.max(180 - rank * 22, 24);
}

export function BestSellersCard() {
  const products = getTopSelling("month").slice(0, 4);
```
with:
```typescript
import { getTopSelling } from "@/app/lib/mock-data";

// Mock unit-sold figures derived from rank position — replace with real sales
// data before production.
function mockUnitsSold(rank: number): number {
  return Math.max(180 - rank * 22, 24);
}

export async function BestSellersCard() {
  const products = (await getTopSelling("month")).slice(0, 4);
```
(This makes `BestSellersCard` an async Server Component — confirm its only caller,
`app/admin/(dashboard)/page.tsx`'s `<BestSellersCard />`, is itself inside an async
Server Component tree, which it already is per Task context.)

- [ ] **Step 4: `app/admin/(dashboard)/products/page.tsx`**

Replace:
```typescript
import { products, categories, brands } from "@/app/lib/mock-data";
import { ProductsClient } from "./products-client";

export default function AdminProductsPage() {
  // Spread into plain arrays — products/categories are Proxies (see
  // mock-data.ts) that always re-read their JSON file; RSC prop
  // serialization requires a plain array when crossing into a Client Component.
  return <ProductsClient initialProducts={[...products]} initialCategories={[...categories]} brands={brands} />;
}
```
with:
```typescript
import { getAllProducts, getAllCategories, brands } from "@/app/lib/mock-data";
import { ProductsClient } from "./products-client";

export default async function AdminProductsPage() {
  const products = await getAllProducts();
  const categories = await getAllCategories();
  return <ProductsClient initialProducts={products} initialCategories={categories} brands={brands} />;
}
```

- [ ] **Step 5: `app/admin/(dashboard)/stock/page.tsx`**

Replace:
```typescript
import { products, categories } from "@/app/lib/mock-data";
import { StockClient } from "./stock-client";

export default function AdminStockPage() {
  // Spread into plain arrays — see products/page.tsx for why (Proxy props
  // cannot cross the Server->Client Component boundary).
  return <StockClient initialProducts={[...products]} categories={[...categories]} />;
}
```
with:
```typescript
import { getAllProducts, getAllCategories } from "@/app/lib/mock-data";
import { StockClient } from "./stock-client";

export default async function AdminStockPage() {
  const products = await getAllProducts();
  const categories = await getAllCategories();
  return <StockClient initialProducts={products} categories={categories} />;
}
```

- [ ] **Step 6: `app/api/products/route.ts`**

Replace:
```typescript
import { products } from "@/app/lib/mock-data";
```
with:
```typescript
import { getAllProducts } from "@/app/lib/mock-data";
```
Inside `export async function GET(request: NextRequest) {`, right after the existing
`const sp = ...` line, add:
```typescript
const products = await getAllProducts();
```
Leave the rest of the function (`let filtered = products; ...`) unchanged.

- [ ] **Step 7: `app/api/products/[slug]/route.ts`**

Replace:
```typescript
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = getProductBySlug(slug);
```
with:
```typescript
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
```

- [ ] **Step 8: `app/components/category-grid.tsx`**

Replace:
```typescript
import { categories } from "@/app/lib/mock-data";

export function CategoryGrid() {
```
with:
```typescript
import { getAllCategories } from "@/app/lib/mock-data";

export async function CategoryGrid() {
  const categories = await getAllCategories();
```
Leave the JSX body (`categories.length`, `categories.map(...)`) unchanged — it already
references a local `categories` identifier that now comes from the `await` instead of
the top-level import.

- [ ] **Step 9: `app/components/footer.tsx`**

Replace:
```typescript
import { categories } from "@/app/lib/mock-data";

export function Footer() {
```
with:
```typescript
import { getAllCategories } from "@/app/lib/mock-data";

export async function Footer() {
  const categories = await getAllCategories();
```
Leave the rest of the JSX body unchanged.

- [ ] **Step 10: `app/components/header.tsx`**

Replace:
```typescript
import { categories } from "@/app/lib/mock-data";
import { HeaderClient } from "./header-client";

export function Header() {
  // Spread into a plain array — `categories` is a Proxy (see mock-data.ts)
  // that re-reads categories.json on access; RSC prop serialization cannot
  // pass a Proxy directly to a Client Component, so materialize it here.
  return <HeaderClient categories={[...categories]} />;
}
```
with:
```typescript
import { getAllCategories } from "@/app/lib/mock-data";
import { HeaderClient } from "./header-client";

export async function Header() {
  const categories = await getAllCategories();
  return <HeaderClient categories={categories} />;
}
```

- [ ] **Step 11: `app/sitemap.ts`**

Replace:
```typescript
import type { MetadataRoute } from "next";
import { products } from "@/app/lib/mock-data";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://www.autolink.example";
  const staticRoutes = ["", "/products"].map((path) => ({
    url: `${base}${path}`,
    lastModified: new Date(),
  }));
  const productRoutes = products.map((p) => ({
```
with:
```typescript
import type { MetadataRoute } from "next";
import { getAllProducts } from "@/app/lib/mock-data";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = "https://www.autolink.example";
  const staticRoutes = ["", "/products"].map((path) => ({
    url: `${base}${path}`,
    lastModified: new Date(),
  }));
  const products = await getAllProducts();
  const productRoutes = products.map((p) => ({
```

- [ ] **Step 12: Confirm `brand-strip.tsx` and `client-reviews.tsx` need no changes**

Read both files and confirm they only import `brands` (from `brand-strip.tsx`) or
`reviews` (from `client-reviews.tsx`) — both untouched plain-array exports per Task 6
Step 4. No edit needed; this step is a verification, not a change.

- [ ] **Step 13: Type-check — expect zero errors now**

Run: `npx tsc --noEmit`
Expected: clean, no errors. If any remain, they'll name the exact file/line of a missed
call site — fix by adding the missing `await` or `async`.

- [ ] **Step 14: Lint**

Run: `npm run lint`
Expected: clean.

- [ ] **Step 15: Full production build**

Run: `npm run build`
Expected: clean build — this is the step that catches Suspense-boundary and
server/client-boundary errors `tsc`/`lint` don't (per CLAUDE.md's documented gotcha).
Pay particular attention to any error mentioning `category-grid.tsx`, `footer.tsx`, or
`header.tsx`, since those are now async Server Components rendered on nearly every
page — a mistake here would be highly visible.

- [ ] **Step 16: Manual verification against the dev server**

With `npm run dev` running (restart it if Step 15's build left it stopped):
```bash
curl -s http://localhost:3000/ | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(d.includes('Shop by category'), d.includes('AutoLink')))"
```
Expected: prints `true true` — confirms the homepage (which renders `Header`,
`CategoryGrid`, `Footer`, all now async) still renders successfully end-to-end through
Blob-backed data.

```bash
curl -s http://localhost:3000/products | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(d.includes('All products')))"
```
Expected: prints `true`.

Pick one real product slug from the Blob-seeded data and verify its detail page:
```bash
node --env-file=.env.local -e "fetch('https://' + process.env.BLOB_STORE_ID + '.public.blob.vercel-storage.com/data/products.json').then(r=>r.json()).then(d=>console.log(d[0].slug))"
```
then:
```bash
curl -s http://localhost:3000/products/<that-slug> | node -e "let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>console.log(d.includes('Request') || d.includes('Proceed')))"
```
Expected: prints `true` — the product detail page (with its `QuoteCta` button) renders.

- [ ] **Step 17: Commit**

```bash
git add app/(site)/products/page.tsx "app/(site)/products/[slug]/page.tsx" app/admin/(dashboard)/best-sellers-card.tsx "app/admin/(dashboard)/products/page.tsx" "app/admin/(dashboard)/stock/page.tsx" app/api/products/route.ts "app/api/products/[slug]/route.ts" app/components/category-grid.tsx app/components/footer.tsx app/components/header.tsx app/sitemap.ts
git commit -m "Update mock-data.ts consumers for the async products/categories API"
```

---

### Task 8: End-to-end verification of the original bug fix, and cleanup

**Files:** none (verification only) — plus optional final `git status` review.

**Interfaces:** none — this task consumes everything from Tasks 1-7 as a whole.

- [ ] **Step 1: Restore any test data written during Task 3's verification**

Task 3 Step 4 wrote a real "Test User" quotation into the shared Blob store. Fetch the
current quotations, remove that test entry, and write the array back:
```bash
node --env-file=.env.local -e "
const { readFile } = require('fs/promises');
(async () => {
  const url = 'https://' + process.env.BLOB_STORE_ID + '.public.blob.vercel-storage.com/data/quotations.json';
  const quotations = await (await fetch(url, { cache: 'no-store' })).json();
  const cleaned = quotations.filter(q => q.details.fullName !== 'Test User');
  console.log('before:', quotations.length, 'after:', cleaned.length);
  const { put } = require('@vercel/blob');
  await put('data/quotations.json', JSON.stringify(cleaned, null, 2) + '\n', { access: 'public', contentType: 'application/json', allowOverwrite: true });
  console.log('cleaned up test quotation');
})();
"
```
Expected: prints `before: N after: N-1` then `cleaned up test quotation`.

- [ ] **Step 2: Full verification gate one more time**

Run in order: `npx tsc --noEmit`, then `npm run lint`, then `npm run build`.
Expected: all three clean (per CLAUDE.md's required pre-push gate).

- [ ] **Step 3: Re-run the original failing request from the bug report**

```bash
curl -s -X POST http://localhost:3000/api/quotations \
  -H "Content-Type: application/json" \
  -d '{"items":[{"slug":"test-part-2","partNumber":"TP-2","name":"Test Part 2","brand":"Test","image":"/images/products/test.jpg","price":0,"quantity":1}],"total":0,"details":{"fullName":"Verify Fix","email":"verify@example.com","phone":"123","jobTitle":"Manager","companyName":"Test Co","country":"Bangladesh","taxId":"","companyWebsite":"","preferredContact":"email","leadTime":"standard","notes":"","submittedAt":"2026-08-17T00:00:00.000Z"}}' \
  -w "\nHTTP %{http_code}\n"
```
Expected: `HTTP 201` — this is the exact request that previously threw due to the
read-only-filesystem `fs.writeFile` bug (reproduced locally by the same code path
Vercel runs); it now succeeds via Blob.

- [ ] **Step 4: Clean up this second test entry too**

Repeat Step 1's cleanup script, filtering for `q.details.fullName !== 'Verify Fix'` this
time.

- [ ] **Step 5: Confirm nothing unintended is staged**

Run: `git status`
Expected: working tree clean (everything from Tasks 1-7 already committed), no
unstaged `data/*.json` changes (those live in Blob now, not in git).

- [ ] **Step 6: Report deployment readiness to the user**

No code step — this plan's execution ends with the user (a) confirming
`BLOB_READ_WRITE_TOKEN` is set in the Vercel project's Production environment
variables (not just local `.env.local`), then (b) pushing to `master` and watching the
next Vercel deploy, then (c) re-testing "Send quotation" on the live deployed site to
confirm the original screenshot's error is gone.

---

## Self-Review Notes

**Spec coverage:** Every spec section has a task — Blob helper (Task 1), seeding
(Task 2), `admin-operations.ts` (Task 3), `admin-employees.ts` (Task 4),
`admin-catalog.ts` including binary uploads (Task 5), `mock-data.ts` async conversion
(Task 6) and its consumers (Task 7), end-to-end verification of the original bug plus
cleanup (Task 8). The spec's "known limitation... not addressed" (concurrency) and
"out of scope" items have no task, correctly — they're explicitly deferred, not gaps.

**Placeholder scan:** No TBD/TODO; every step shows exact code or exact commands with
expected output.

**Type consistency:** `readBlobJson<T>`/`writeBlobJson<T>` (Task 1) are the only new
public interface, used identically across Tasks 3, 4, 5, 6 with the same generic
signature. `getAllProducts`/`getAllCategories`/`getProductBySlug`/
`getProductsByCategory`/`getTopSelling`/`getRelatedProducts` names introduced in Task 6
are used with those exact names in every Task 7 step — no drift.
