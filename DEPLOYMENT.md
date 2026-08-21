# Deployment Guide — AutoLink Integrated Technologies

First-time deployment, written to be followed top to bottom. Budget about
90 minutes. Nothing here costs money on day one.

---

## 0. Before you start (do this first)

- [ ] **Change your Namecheap password and turn on 2FA.** Whoever controls the
      registrar controls where the domain points, and can redirect mail to
      intercept password resets everywhere else.
- [ ] **Change your SmarterASP.NET password.**
- [ ] Have your GitHub login ready — both hosts deploy straight from the repo.

### Why not SmarterASP.NET

The app needs Node.js (Next.js renders every page on the server), Python 3.11+
(FastAPI) and PostgreSQL. SmarterASP is Windows/IIS shared hosting for
ASP.NET: it offers MSSQL rather than Postgres and no supported way to keep a
Python ASGI process running. Porting the database would not fix the Python
side, which is the harder blocker.

If you are inside a refund window, take it. Otherwise SmarterASP can still
serve company email or a placeholder page — just not this site.

### What you are building

```
Customer browser
      │
      ├── www.yourdomain.com ──→ Vercel (Next.js frontend)
      │                              │  server-side calls
      │                              ↓
      └── api.yourdomain.com ──→ Render (FastAPI backend) ──→ Render PostgreSQL
```

Two hosts, one domain, two subdomains. Free to start.

---

## 1. Push your code to GitHub

From `M:\Private projects\Alliance`:

```bash
git push origin master
```

If it asks for a password, GitHub needs a Personal Access Token, not your
account password: GitHub → Settings → Developer settings → Personal access
tokens → Tokens (classic) → Generate new token, tick `repo`, and paste the
token as the password.

---

## 2. Database — Render PostgreSQL

1. Sign up at **render.com** with GitHub.
2. **New → Postgres**.
   - Name: `autolink-db`
   - Region: **Singapore** (closest to Bangladesh)
   - Plan: **Free**
3. Create, wait ~1 minute.
4. Open the database → **Connect** → copy the **Internal Database URL**.
   It looks like `postgresql://user:pass@host/autolink_db`.

> The free database expires after 90 days. Upgrade to the ~$7/mo plan before
> then or you lose the data. Set a calendar reminder now.

**Keep this URL.** You will edit it in the next step.

---

## 3. Backend — Render Web Service

1. **New → Web Service** → connect your `Alliance` repo.
2. Settings:
   - Name: `autolink-api`
   - Region: **Singapore** (must match the database)
   - Root Directory: `Allaince-backend`
   - Runtime: **Docker** (the repo has a Dockerfile; it already includes the
     native libraries WeasyPrint needs for PDFs)
   - Plan: **Free** to start
3. **Environment variables** — add each one (Advanced → Add Environment Variable):

| Key | Value |
|---|---|
| `DATABASE_URL` | The internal URL from step 2, **with `postgresql://` changed to `postgresql+asyncpg://`** |
| `SESSION_SECRET` | `o-NFa7AeafsRz-Wqn10gF38Kt8WL9HThLGoHbdJ9lUE` |
| `GMAIL_TOKEN_ENCRYPTION_SECRET` | `HQTxhsHD_nAygQN7sy4q_F9BWsf4eN_Z5qCyVkJqzbk` |
| `ENVIRONMENT` | `production` |
| `COOKIE_SECURE` | `true` |
| `COOKIE_SAMESITE` | `none` |
| `CORS_ALLOWED_ORIGINS` | `https://www.yourdomain.com,https://yourdomain.com` |
| `PUBLIC_SITE_URL` | `https://www.yourdomain.com` |
| `PUBLIC_API_URL` | `https://api.yourdomain.com` |
| `SUPER_ADMIN_EMAIL` | your admin email |
| `SUPER_ADMIN_NAME` | your name |
| `SUPER_ADMIN_PASSWORD_HASH_B64` | see below |

> **The `+asyncpg` edit matters.** Without it the app cannot talk to Postgres
> at all — the driver is chosen from that prefix.

> **Those two secrets are printed in a chat transcript**, so treat them as
> starter values. To generate your own:
> `python -c "import secrets; print(secrets.token_urlsafe(32))"`

Generate your admin password hash locally (in `Allaince-backend`):

```bash
.venv/Scripts/python -c "import bcrypt,base64;print(base64.b64encode(bcrypt.hashpw(b'YOUR-REAL-PASSWORD',bcrypt.gensalt(12))).decode())"
```

Paste the output as `SUPER_ADMIN_PASSWORD_HASH_B64`. It is base64 because a
raw bcrypt hash contains `$`, which env loaders mangle into an empty variable.

4. **Create Web Service.** First build takes ~5 minutes.
5. When it says *Live*, open `https://autolink-api.onrender.com/health` —
   you want `{"status":"ok"}`.

The container runs `alembic upgrade head` on every start, so your tables are
created automatically. Nothing to run by hand.

> **Free tier caveat:** the service sleeps after 15 minutes idle, and the next
> request takes ~50 seconds to wake it. Fine for testing, poor for customers.
> The $7/mo Starter plan stays awake — worth it before you advertise the site.

---

## 4. Load your product data

Your 48 products currently live in `Alliance-frontend/data/*.json`. Move them
into the live database from your own machine:

1. In Render, open the database → **Connect** → copy the **External Database URL**
   (external, because you are connecting from home).
2. Locally, in `Allaince-backend`:

```bash
# PowerShell
$env:DATABASE_URL="postgresql+asyncpg://...paste external URL..."
.venv\Scripts\python -m scripts.migrate_json --dry-run   # check first
.venv\Scripts\python -m scripts.migrate_json             # then load
```

The dry run reports what it would write without touching anything. The real
run hashes any plaintext password, re-derives stock status and recomputes
category counts on the way in. It refuses to run twice.

---

## 5. Frontend — Vercel

1. Sign up at **vercel.com** with GitHub.
2. **Add New → Project** → import `Alliance`.
3. Settings:
   - **Root Directory: `Alliance-frontend`** ← easy to miss, and the build
     fails without it because `package.json` is not at the repo root
   - Framework: Next.js (auto-detected)
4. **Environment variables:**

| Key | Value |
|---|---|
| `API_URL` | `https://api.yourdomain.com` |
| `NEXT_PUBLIC_API_URL` | `https://api.yourdomain.com` |
| `SESSION_SECRET` | **exactly the same value as the backend's** |

> **`SESSION_SECRET` must match byte for byte.** `proxy.ts` verifies the login
> token itself, so a mismatch rejects every valid session and sends the whole
> admin area back to the login page — with nothing written to any log. If admin
> login "succeeds" but bounces you straight back, this is why.

5. **Deploy.** ~3 minutes.

---

## 6. Point your domain (Namecheap)

### In Vercel
Project → Settings → Domains → add `www.yourdomain.com` and `yourdomain.com`.
Vercel shows the DNS records it wants.

### In Render
`autolink-api` → Settings → Custom Domain → add `api.yourdomain.com`.
Render shows a CNAME target.

### In Namecheap
Domain List → **Manage** → **Advanced DNS**. Delete the parking/default records,
then add:

| Type | Host | Value |
|---|---|---|
| A | `@` | `76.76.21.21` |
| CNAME | `www` | `cname.vercel-dns.com.` |
| CNAME | `api` | the target Render gave you |

Use whatever values the two dashboards actually display — they are the source
of truth, not this table.

DNS usually propagates in 30 minutes (can take 24 hours). Both hosts issue
HTTPS certificates automatically once they see the records.

---

## 7. Final checks

Once the domain resolves, confirm each of these:

- [ ] `https://www.yourdomain.com` loads with products visible
- [ ] A product page opens and "Request Quotation" works
- [ ] `https://api.yourdomain.com/health` returns `{"status":"ok"}`
- [ ] `https://api.yourdomain.com/docs` returns **404** (docs are disabled in
      production by design — a 404 here is correct)
- [ ] `/admin/login` accepts your super-admin email and password
- [ ] The admin dashboard shows real orders and quotations
- [ ] Submitting the contact form creates a row in admin → Contact Requests
- [ ] Downloading a quotation PDF from admin works

If admin login loops back to the login page → `SESSION_SECRET` differs between
the two hosts.

If products do not appear → check `CORS_ALLOWED_ORIGINS` on the backend lists
your exact frontend domain, including `https://`.

---

## 8. Optional, once the site is live

Everything below degrades gracefully when unset — the site works without them.

- **Product image uploads** need S3-compatible storage. Cloudflare R2 has a
  generous free tier. Set `S3_ENDPOINT_URL`, `S3_ACCESS_KEY_ID`,
  `S3_SECRET_ACCESS_KEY`, `S3_BUCKET_NAME`, `S3_PUBLIC_BASE_URL` on the
  backend, and `NEXT_PUBLIC_MEDIA_URL` on the frontend so the CSP and image
  optimiser allow that origin. Without it, uploads write to the container's
  disk and vanish on redeploy.
- **Customer emails** need a Resend account and a verified `auto-bd.com`
  domain: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`, `NOTIFY_INTERNAL_EMAIL`.
  Until then, quotation emails are skipped, not failed.
- **Rate limiting across workers** needs `REDIS_URL`. Without it limiting is
  per-worker — a speed bump, not a guarantee.
- **Gmail inbox** needs Google OAuth credentials.

---

## Costs

| | Now | Realistic |
|---|---|---|
| Vercel | Free | Free |
| Render API | Free (sleeps) | $7/mo |
| Render Postgres | Free 90 days | $7/mo |
| Domain | already paid | ~$15/yr |

Roughly **$14/month** once you want the site always awake and the database
kept past 90 days.

---

## Keeping it running

- Pushing to `master` redeploys both hosts automatically.
- Render free databases are deleted after 90 days. **Set a reminder now.**
- Back up before risky changes:
  `pg_dump "external-url" > backup.sql`
