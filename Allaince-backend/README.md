# AutoLink Integrated Technologies — Backend

Standalone FastAPI + PostgreSQL backend for the AutoLink storefront and admin
dashboard. Replaces the Next.js Route Handlers and JSON-blob persistence the
frontend previously used.

- **Design spec:** `../docs/superpowers/specs/2026-08-19-standalone-fastapi-backend-design.md`
- **Implementation plan:** `../docs/superpowers/plans/2026-08-19-standalone-fastapi-backend.md`

> The folder name `Allaince-backend` is a pre-existing typo that is deliberately
> kept — renaming it would break paths and tooling that already point at it.

## Stack

FastAPI · SQLAlchemy 2 (async, asyncpg) · PostgreSQL 16 · Alembic · Pydantic v2
· bcrypt · PyJWT · WeasyPrint · Resend · Gmail API (read-only) · Redis · boto3

## Quick start

```bash
python -m venv .venv
.venv/Scripts/pip install -e ".[dev]"      # Linux/macOS: .venv/bin/pip

cp .env.example .env                        # then fill in the secrets below
.venv/Scripts/alembic upgrade head
.venv/Scripts/uvicorn app.main:app --reload
```

API docs at http://localhost:8000/docs (disabled when `ENVIRONMENT=production`).

Generate the two required secrets:

```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

Create the bootstrap super admin (base64 of a bcrypt hash — see `.env.example`
for why it is base64):

```bash
python -c "import bcrypt,base64;print(base64.b64encode(bcrypt.hashpw(b'your-password',bcrypt.gensalt(12))).decode())"
```

### Docker

```bash
docker compose up --build      # API + Postgres + Redis
```

## Seeding from the old JSON files

```bash
python -m scripts.migrate_json --dry-run     # validate first
python -m scripts.migrate_json
```

Reads `../Alliance-frontend/data/*.json`. Derivation runs on the way in: legacy
plaintext passwords are hashed, stock status is re-derived, category counts are
recomputed, confirmations attached to non-confirmed quotations are dropped, and
task assignees that no longer exist become `NULL`. It refuses to run against a
database that already holds products.

## Tests

```bash
.venv/Scripts/pytest -q            # 186 tests, SQLite-backed, no services needed
```

## Configuration

Every value comes from the environment (see `.env.example`). Required:
`DATABASE_URL`, `SESSION_SECRET` (≥32 chars), `GMAIL_TOKEN_ENCRYPTION_SECRET`
(≥32 chars), `CORS_ALLOWED_ORIGINS`.

Optional integrations degrade cleanly when unset — Resend (email is skipped),
S3 (falls back to local `./media`), Redis (falls back to per-worker in-memory
rate limiting), Gmail (the inbox reports "not connected").

### Production checklist

- `ENVIRONMENT=production` — disables `/docs` and enables strict startup checks.
- `COOKIE_SECURE=true` and `COOKIE_SAMESITE=none` — the session cookie is
  cross-origin, so both are required for it to be sent at all.
- `CORS_ALLOWED_ORIGINS` set to the exact storefront origin(s). Never `*`:
  credentialed CORS and a wildcard origin are mutually exclusive.
- `REDIS_URL` set — without it, rate limiting is per-worker and a request
  landing on another worker starts with a fresh counter.
- Run behind TLS with a proxy that overwrites `X-Forwarded-For`; the rate
  limiter trusts that header for client identity.

## Layout

```
app/
├── main.py           FastAPI app, CORS, error handling, router registration
├── config.py         pydantic-settings; all configuration
├── db.py             async engine, session dependency
├── models/           SQLAlchemy ORM (catalog, employee, operations)
├── schemas/          Pydantic request/response models (camelCase on the wire)
├── services/         business logic (catalog, operations, employees, analytics, search, bulk_import)
├── routers/          HTTP layer, one module per surface
├── core/             session tokens, password hashing, RBAC dependencies, rate limiting
└── integrations/     object storage, PDF, email, Gmail, crypto
alembic/              migrations
scripts/              one-time JSON -> Postgres seed
tests/                pytest suite
```

## Auth and RBAC

Sessions are HS256 JWTs in an httpOnly cookie named `autolink_admin_session`,
8-hour TTL. Three tiers, enforced as FastAPI dependencies at the endpoint (a
standalone API cannot rely on frontend middleware):

| Dependency | Grants |
|---|---|
| `require_admin` | any authenticated admin — products, stock, categories, hero images, own tasks/leave/reports |
| `require_area(area)` | super admin, or a sub-admin individually granted that area — quotations, orders, emails, contact-requests |
| `require_super_admin` | super admin only — employees, analytics, task assignment, leave approval |

Role is not sufficient on its own for employee-scoped data: `owns_or_super()`
additionally compares the session's employee id against the resource owner, so
a sub-admin can progress their own task but gets `403` on a colleague's.

## API surface

**Public:** `GET /api/products`, `/api/products/{slug}`, `/api/categories`,
`/api/brands`, `/api/hero-images`, `/api/top-sellers`; `POST /api/quotations`,
`/api/orders`, `/api/contact`; `GET /api/quotations/{id}`, `/api/track/{trackingId}`.

**Admin:** `POST /api/admin/login`, `/logout`, `GET /me`; catalog CRUD, image
upload and bulk import; quotations (status, confirm, delivery, email, PDF);
orders (status, invoice); contact requests; employees, tasks, leave requests,
daily reports; analytics and search; Gmail inbox.

Responses serialise camelCase to match the frontend's existing TypeScript types.

## Notes

- **Top sellers** is computed from issued order confirmations, not a stored rank
  column — the frontend's `weekRank`/`monthRank`/`yearRank` fields were
  fabricated and are gone.
- **Line items** are JSONB snapshots, deliberately not foreign keys to
  `products`: a later catalog price change must not retroactively rewrite a
  historical quotation.
- **Employee deletes** use `ON DELETE SET NULL`, so tasks, leave requests and
  daily reports survive as "Unknown Employee" rather than disappearing.
- **PDF rendering** raises `PdfUnavailable` when WeasyPrint's native libraries
  are missing (common on Windows without GTK). The Docker image includes them;
  locally, PDF endpoints return 503 and quotation emails send unattached.
