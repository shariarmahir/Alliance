# Vercel Blob persistence migration — design

## Problem

All admin/storefront data lives in JSON files under `data/`, read and written via
`fs`/`fs/promises` in server-only modules (`app/lib/admin-operations.ts`,
`app/lib/admin-catalog.ts`, `app/lib/admin-employees.ts`, `app/lib/mock-data.ts`).
This works in local dev but **fails on Vercel**, whose serverless functions run on a
read-only filesystem outside `/tmp` (and `/tmp` itself is ephemeral per-invocation,
not shared across function instances, so it wouldn't help even if writes succeeded).

Symptom that surfaced this: submitting "Send quotation" on the deployed site fails
with "We couldn't send your request" — `POST /api/quotations` calls `addQuotation()`,
which calls `fs.writeFile` against `data/quotations.json` and throws in production.
Every other admin mutation (orders, employees, tasks, leave, daily reports, contact
requests, hero images, product/category writes and image uploads) has the identical
bug; quotations is just the first one the user hit.

Total data volume today: ~80KB across 11 JSON files (dominated by `products.json` at
64KB). Low write volume, admin-driven, not high-throughput.

## Chosen approach: Vercel Blob

Replace `fs.readFile`/`fs.writeFile` with Vercel Blob's `put()` (write) and a plain
`fetch()` against the blob's URL (read). Each JSON file gets one fixed, well-known
Blob pathname (e.g. `data/quotations.json`, `data/products.json`) so every read/write
targets the same blob without a lookup step.

Rejected alternatives:
- **Vercel KV (Redis)** — comparable migration size to Blob, no clear advantage for
  this data shape (whole-file JSON blobs, not per-key access patterns).
- **Real Postgres schema** — the architecturally "correct" long-term choice, but a
  much larger rewrite (schema design, query layer, migrating every `.find()`/
  `.filter()` consumer) and a reversal of this project's current "no external
  database" convention (CLAUDE.md). Not justified by 80KB of low-traffic data.

## Scope

### Data-access modules (JSON read/write)

- `app/lib/admin-operations.ts` — orders, quotations, contact requests, emails (read-only)
- `app/lib/admin-catalog.ts` — products, categories
- `app/lib/admin-employees.ts` — employees, tasks, leave requests, daily reports
- `app/lib/mock-data.ts` — `products`/`categories` re-exported for storefront reads

All four share the same `readJsonFile`/`writeJsonFile`-style helper internally, which
becomes a `readBlobJson`/`writeBlobJson` pair backed by `@vercel/blob`. **Every
exported function keeps its existing name, parameters, and return type** — `addOrder`,
`updateQuotationStatus`, `readEmployees`, etc. — so none of the ~30+ route handlers and
Server Components calling them need to change.

### Binary image uploads

`admin-catalog.ts`'s `saveProductImage`, `saveCategoryIcon`, `saveHeroImage` currently
write to `public/images/{products,categories,hero}/...` via `fs.writeFile` and return
a local `/images/...` path. These switch to `put()` against Blob and return the blob's
public URL instead. This is not scope creep — it's the same read-only-filesystem bug,
just for binary files instead of JSON.

### The one structural change: `mock-data.ts`'s sync Proxy

`freshArray()` currently wraps `products`/`categories` in a `Proxy` that re-reads
`fs.readFileSync` synchronously on every property access, so consumers can use them as
plain synchronous arrays (`products.filter(...)`) while still seeing fresh data after
an admin write. This only works because local disk reads are synchronous; Blob reads
are HTTP fetches and must be async.

Fix: `products`/`categories` (and the helpers built on them — `getProductBySlug`,
`getProductsByCategory`, `getTopSelling`, `getRelatedProducts`) become real async
functions, matching the pattern already used everywhere in `admin-operations.ts` and
`admin-employees.ts`. Every call site (~10-15, across product listing, product detail,
homepage top-sellers, category grid, related products) is already inside an `async`
Server Component, so each becomes a mechanical `await` addition — no new abstraction,
no `cache()` wrapper (rejected — not justified at this data volume/traffic level).

## Environment / setup

- `npm i @vercel/blob`
- Create a Blob store in the Vercel dashboard for the existing project, copy the
  `BLOB_READ_WRITE_TOKEN` into both the Vercel project's environment variables and
  local `.env.local`.
- **Local dev and production share one Blob store** (no separate dev/staging store) —
  matches today's single-`data/`-directory behavior. Tradeoff accepted explicitly:
  testing quotation/order flows locally writes real data visible in the live admin
  dashboard. No code branches on environment; the same `put()`/`fetch()` calls run in
  both contexts.

## Seeding

One-time script (`scripts/seed-blob.mjs`) that:
1. Uploads each existing binary image under `public/images/{products,categories,hero}/`
   to Blob, collecting the returned public URLs.
2. Patches those URLs into the corresponding JSON (`products.json` image fields,
   `categories.json` icon fields, `hero-images.json` path fields).
3. Uploads all 11 patched `data/*.json` files to their fixed Blob pathnames.

Run once against the real (shared) Blob store after the token is configured. Not part
of the app's runtime code path — a standalone migration script, deleted or left
inert after the one-time run.

## Known limitation carried forward (not solved by this migration)

Blob has no atomic read-modify-write or locking primitive. Every mutation
(`addQuotation`, `updateOrderStatus`, etc.) does a full read → in-memory mutate → full
write; two concurrent writes to the same file can last-write-wins clobber each other.
This is not a new risk introduced by Blob — the current `fs.writeFile`-based code has
the identical race today. Not addressing it here; flagged for awareness given
single-admin/low-traffic usage.

## Out of scope

- Any change to data shapes/types (`Order`, `Quotation`, `Employee`, etc.)
- Any change to RBAC/auth
- Any change to the FastAPI-backend-later plan referenced in existing module comments
  ("KNOWN LIMITATION... real backend replaces this layer later") — Blob is the interim
  fix, not a replacement for that eventual plan
