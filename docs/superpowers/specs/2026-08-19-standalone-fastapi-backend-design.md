# Standalone FastAPI backend — design

## Problem

AutoLink Integrated Technologies (frontend repo folder: `Alliance-frontend`) has no
separate backend. Every API concern — public catalog, quotations, orders, admin
auth/RBAC, employee/task/leave management, analytics, Gmail OAuth inbox, PDF
generation, transactional email — is implemented as Next.js Route Handlers under
`app/api/**`, with persistence as JSON documents in Vercel Blob (see
`2026-08-17-vercel-blob-persistence-design.md`) and PDF rendering done client-side in
the browser via jsPDF.

This works, but it means:
- There is no backend that can be reused by anything other than this one Next.js app.
- PII (customer quotation/order details, employee bcrypt hashes) lives in JSON blobs
  that are world-readable at a guessable URL unless the Blob store is switched to
  private (flagged as a live risk in the current code).
- "Top sellers" on the storefront is fully fabricated mock data
  (`app/lib/top-sellers.ts`, explicitly marked in source as temporary), and the public
  product listing (`GET /api/products`) reads from a separate hardcoded
  `app/lib/mock-data.ts` rather than the admin-managed catalog — so admin product
  edits do not appear on the storefront today.
- The in-memory rate limiter and client-side PDF generation are both acknowledged
  stopgaps in the existing code comments.

The goal of this project: extract all backend concerns into a standalone, production
backend at `Allaince-backend/` (sibling folder to `Alliance-frontend`, matching the
existing — pre-existing, unchanged — folder-name typo), with a real database, and
have the frontend become a pure client of that API over HTTP.

## Chosen approach

**Stack**: FastAPI + SQLAlchemy (async) + PostgreSQL + Alembic migrations + Pydantic v2
schemas. Deployed as a standard, portable Python app (Docker-able; no host-specific
lock-in baked into the architecture — the user's current hosting is Windows/IIS shared
hosting via SmarterASP.NET, which has limited Python/Postgres support, so exact deploy
mechanics are being resolved separately as an infra decision, not designed into the
backend itself).

Rejected alternatives:
- **Node/Express or NestJS (TypeScript)** — would have let business logic and Zod
  schemas port over almost mechanically instead of being rewritten. Not chosen: user
  explicitly wants Python/FastAPI for this service.
- **MongoDB** — closest 1:1 shape match to the existing JSON documents (least schema
  redesign). Not chosen: this domain (orders ↔ quotations ↔ confirmations ↔ employees)
  is genuinely relational, and Postgres was the user's explicit choice.
- **Keep Next.js Route Handlers, add only a database** — smallest-diff option, but
  does not produce a standalone, independently deployable backend, which was the
  stated goal.

### Repository layout

```
Allaince-backend/
├── app/
│   ├── main.py            # FastAPI app instance, router registration, CORS, startup
│   ├── config.py          # pydantic-settings, all config from environment variables
│   ├── db.py               # async engine + session factory
│   ├── models/              # SQLAlchemy ORM models, one module per domain
│   ├── schemas/             # Pydantic request/response models
│   ├── routers/             # one module per resource, mirrors app/api/** structure
│   ├── services/            # business logic (mirrors admin-catalog.ts, admin-operations.ts, admin-employees.ts, admin-analytics.ts, admin-search.ts)
│   ├── core/                 # auth (JWT session), RBAC dependencies, rate limiting, security helpers
│   └── integrations/         # gmail_oauth.py, email_sender.py, pdf.py, object_storage.py
├── alembic/                    # migrations, including the one-time JSON→Postgres data seed
├── tests/
├── pyproject.toml
└── .env.example
```

## Database schema

Relational tables replace the JSON-blob-per-entity model, with real foreign keys where
the JSON only had loose ID references by convention.

| Table | Notes |
|---|---|
| `categories` | slug PK; `product_count` denormalized, recomputed on product writes (matches current behavior) |
| `brands` | slug PK |
| `products` | slug PK; `gallery`, `short_specs`, `description`, `alternate_part_numbers` as JSON arrays; `specifications` as JSONB; **no stored rank columns** (see Top Sellers below) |
| `employees` | UUID PK; `employee_id_number` and `email` unique; `password_hash`; `access_options` as JSON array |
| `quotations` | UUID PK; `items` and `details` as JSONB (immutable snapshot of what the customer requested) |
| `order_confirmations` | UUID PK; **1:1 with `quotations`** via unique FK, split into its own table rather than a nullable JSON field. Has its own lifecycle (issued once by an admin, then only `delivery_stage` mutates), and moving a quotation off `"confirmed"` status becomes a clean row delete instead of field-nulling — matches the existing "retract confirmation" behavior exactly. `lines` stored as JSONB. |
| `orders` | `order_number` PK; `items` and `address` as JSONB |
| `contact_requests` | UUID PK |
| `tasks` | UUID PK; `assignee_employee_id` FK → `employees.id`, **`ON DELETE SET NULL`** (not CASCADE) |
| `leave_requests` | UUID PK; `employee_id` FK → `employees.id`, `ON DELETE SET NULL` |
| `daily_reports` | UUID PK; `employee_id` FK → `employees.id`, `ON DELETE SET NULL` |
| `hero_images` | slot (1-5) PK |
| `gmail_token` | single row; refresh token encrypted at rest (AES-256-GCM, key derived from a backend secret env var, same approach as today) |

**Why JSONB for line items instead of normalized child tables**: quote items,
confirmation lines, and order items are immutable snapshots of a product's price/name/
image *at the time the document was created*, not live references — the existing
`ConfirmedLine` type comment is explicit about this ("the customer's request and the
admin's priced offer are different documents, so confirming must not overwrite what
was asked"). Normalizing them into child rows referencing `products` would let a later
catalog price change retroactively alter historical quotations, which is wrong.

**Why `SET NULL` instead of `CASCADE` on employee deletes**: the existing
`admin-employees.ts` supports hard-deleting an employee (soft-delete via `disabled` is
recommended but not enforced), and tasks/leave-requests/daily-reports render "Unknown
Employee" for orphaned records rather than disappearing. `SET NULL` preserves that
behavior; `CASCADE` would silently destroy historical task/leave/report data.

**Top sellers**: the current `week_rank`/`month_rank`/`year_rank` product fields and
all of `app/lib/top-sellers.ts` are fabricated. These are dropped entirely. Instead,
"top sellers" for a given period is computed at query time — an aggregate over
`order_confirmations.lines` (issued orders are the strongest sales signal available),
grouped by product slug, windowed by the period — with no stored rank column to keep
in sync.

**Catalog unification**: `GET /api/products` and `GET /api/products/[slug]` currently
read from `app/lib/mock-data.ts`, a separate hardcoded dataset from the admin-managed
`data/products.json`. In the new backend there is exactly one `products` table; the
public catalog endpoints and the admin catalog endpoints both read/write it, so admin
edits are finally visible on the storefront.

## API surface

The ~30 existing routes are mirrored 1:1 by resource, method, and RBAC rule:

- **Public, unauthenticated**: catalog listing/detail, quotation submission, contact
  form (rate-limited), quotation status polling by UUID, delivery tracking by tracking
  ID.
- **Admin, three-tier RBAC** (same model as today's `_auth.ts` + `proxy.ts`, reimplemented
  as FastAPI dependencies since a standalone API enforces RBAC at the endpoint level,
  not via frontend middleware):
  - `require_super_admin` — orders, quotations, contact-requests, emails, employees,
    tasks (assign), leave (approve/reject) default to super-only.
  - `require_area(area)` — quotations/orders/emails/contact-requests are delegable to a
    sub-admin who has been individually granted that `AccessArea`, exactly like today's
    `session.accessOptions` check.
  - `require_admin` — products, stock, categories, hero-images, tasks (update own
    status), leave (file own request), daily-reports: open to any authenticated admin.
- Per-resource ownership checks carry over unchanged in spirit (e.g. a sub-admin may
  `PATCH` their own task's status but gets `403` on another employee's task — checked
  by comparing `session.employee_id` against the resource's owning employee ID, not by
  role alone).

Request/response payloads translate from the existing Zod schemas and `types.ts` into
Pydantic models with equivalent field names and validation rules, so the frontend port
is a matter of changing fetch targets and payload plumbing, not redesigning forms.

## Integrations

- **Image storage**: product/category/hero/logo image uploads move to an
  S3-compatible bucket (env-configurable endpoint — works with AWS S3, Cloudflare R2,
  MinIO, or local disk in dev) instead of Vercel Blob. This also resolves the flagged
  PII exposure risk, since the database is not publicly reachable and the bucket only
  ever holds non-sensitive images.
- **PDF generation** (full server-side rewrite): moves from client-side jsPDF to
  **WeasyPrint** (HTML/CSS → PDF) on the backend, covering all three existing document
  types (issued quotation, un-priced customer request, order invoice). HTML/CSS is a
  closer match to the original Word-template layout work than re-deriving jsPDF's
  imperative mm-coordinate drawing calls in Python, and keeps the backend as the single
  place documents are produced instead of trusting a browser.
- **Gmail OAuth + inbox read** (full server-side rewrite): `google-auth-oauthlib` for
  the same one-time super-admin authorization-code consent flow (readonly scope only,
  no send), `google-api-python-client` for thread listing/detail. Refresh token stored
  encrypted at rest in the `gmail_token` table, same AES-256-GCM approach as today
  (decrypt failure — e.g. after a secret rotation — is treated as "not connected," not
  a hard error, matching current behavior).
- **Transactional email**: the `resend` Python SDK sends quotation-issued emails to
  customers and internal notification emails on new price requests/contact
  submissions, same provider as today.
- **Rate limiting**: moves from the current in-memory-per-instance limiter (explicitly
  a "speed bump, not a guarantee" per its own code comment, since serverless instances
  don't share memory) to **Redis-backed** limiting for real cross-worker guarantees.
  Degrades to in-memory in local dev if Redis isn't configured, but is required in
  production config.

## Data migration

Total existing data volume is trivial (~80KB across 11 JSON files, under 80 records
combined — dominated by 48 products at 64KB). A one-time Alembic data migration reads
the current `data/*.json` files and seeds Postgres; no batching or streaming needed at
this volume. This is a non-event from a data-size standpoint — the real migration
effort is entirely in re-architecting the read/write layer and rebuilding PDF/Gmail/
email server-side, not in moving data.

## Frontend changes

Not a rewrite — the frontend keeps its App Router pages/components and switches its
data layer from local Route Handlers to HTTP calls against the new backend:

- Remove `app/api/**` route handlers (logic now lives in the backend).
- Remove the server-only lib modules whose responsibility moved to the backend:
  `admin-catalog.ts`, `admin-operations.ts`, `admin-employees.ts`, `admin-analytics.ts`,
  `admin-search.ts`, `admin-auth.ts`, `session-token.ts`, `blob-store.ts`,
  `gmail-client.ts`, `gmail-token-store.ts`, `quotation-pdf.ts`, `quotation-email.ts`,
  `order-confirmation.ts`'s ID-generation helpers (ID generation moves server-side).
- Delete `mock-data.ts` and `top-sellers.ts` once the corresponding real endpoints
  exist.
- `proxy.ts` simplifies to a thin auth-presence check (redirect to `/admin/login` if no
  session cookie) — the detailed per-route RBAC logic moves to the backend, since it's
  now the backend's job to reject unauthorized requests regardless of which UI called
  it.
- Replace call sites with `fetch()` against the backend's base URL
  (`NEXT_PUBLIC_API_URL` or server-side equivalent), switch to cross-origin cookie
  handling (`credentials: "include"` on the client, backend sets
  `SameSite=None; Secure` on the session cookie since frontend and backend are
  different origins in production).
- `order-confirmation.ts`'s pure display helpers that stay frontend-relevant (e.g.
  `amountInWords` if still needed for any client-side preview) can remain; only the
  ID-generation and persistence-adjacent pieces move.

## Out of scope for this phase

- Exact production deployment target/mechanics (SmarterASP.NET Windows/IIS
  compatibility, or an alternative Linux host) — being resolved separately once the
  user confirms their hosting plan's actual capabilities. The backend architecture
  itself is portable (standard Docker-able FastAPI + Postgres + S3-compatible
  storage + optional Redis) and does not assume any specific host.
- Adding Gmail *send* capability (current scope is read-only inbox viewing; sending
  goes through Resend, not Gmail).
- Any new product/business features not already present in the current frontend.
