# Environment variables — complete reference

Every variable the two applications read, where it goes, and what breaks when it
is wrong.

Generated from `Allaince-backend/app/config.py` and every `process.env.*` in
`Alliance-frontend/`. If you add a variable to either, add it here too.

---

## The four that must match across both apps

Get these wrong and the symptom is almost never an error message — it is a
silent failure that looks like a different bug entirely. Check these first
whenever "logged in, then bounced to the login page" happens.

| Variable | Backend | Frontend | Must be |
|---|---|---|---|
| `SESSION_SECRET` | `SESSION_SECRET` | `SESSION_SECRET` | **Byte-identical** |
| API address | `PUBLIC_API_URL` | `API_URL` + `NEXT_PUBLIC_API_URL` | Same URL |
| Site address | `PUBLIC_SITE_URL` | `NEXT_PUBLIC_SITE_URL` | Same URL |
| Allowed origins | `CORS_ALLOWED_ORIGINS` | *(n/a)* | Must list the frontend's exact origin |

### Why `SESSION_SECRET` is the dangerous one

The backend signs your login token with it. `proxy.ts` verifies that signature
locally before letting an admin page render. If the two differ, every valid
token is judged forged, and **every `/admin/*` page 307-redirects to
`/admin/login` with nothing logged anywhere**.

It is 30 seconds to check and it is the single most common broken deployment.

---

# Backend (`Allaince-backend/.env`)

## Required — the app refuses to start without these

### `DATABASE_URL`
Where the database lives.

```
postgresql+asyncpg://USER:PASSWORD@HOST:5432/allaince
```

The `+asyncpg` matters — the app uses an async driver, and a plain
`postgresql://` URL fails at startup. **In production, a `sqlite://` URL is
rejected outright** by the startup check in `app/main.py`.

> With Docker Compose you do **not** set this. Compose builds it from
> `POSTGRES_PASSWORD`. Setting it in `.env` is ignored and only causes confusion.

### `SESSION_SECRET`
Signing key for admin login tokens. **Minimum 32 characters, enforced.**

```
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

Changing it logs every admin out immediately. Must match the frontend exactly.

### `GMAIL_TOKEN_ENCRYPTION_SECRET`
Encrypts stored Gmail OAuth tokens at rest. **Minimum 32 characters, enforced.**
Generate the same way, but use a *different* value — one key, one purpose.

---

## Production settings

### `ENVIRONMENT`
`development` | `production` | `test`. Default `development`.

Setting `production` turns on a startup check that **refuses to boot** on an
unsafe configuration, and disables `/docs`, `/redoc` and `/openapi.json` — which
would otherwise list every admin route to anyone who asked.

It refuses to start if:
- `CORS_ALLOWED_ORIGINS` contains `*` (a wildcard plus credentials lets any
  website call your API with the admin's cookie attached)
- `COOKIE_SECURE` is not `true`
- `DATABASE_URL` points at SQLite

It warns but continues if `COOKIE_SAMESITE` is not `none`, or if `REDIS_URL` is
unset.

### `CORS_ALLOWED_ORIGINS`
Comma-separated list of **exact** origins allowed to send logged-in requests.

```
CORS_ALLOWED_ORIGINS=https://www.auto-bd.com,https://auto-bd.com
```

No trailing slashes. No wildcards. Scheme included.

> **This is what broke your preview URL.** A `*.vercel.app` address is not in
> this list, so the browser blocks its API calls and the admin bounces to login.
> That is the list doing its job, not a bug. Add a preview origin only if you
> accept that it can then make credentialed calls to your live API.

### `COOKIE_SECURE`
`true` in production. The session cookie is then refused over plain HTTP.

### `COOKIE_SAMESITE`
`none` in production, `lax` in local development.

`www.auto-bd.com` and `api.auto-bd.com` are different origins, so anything
stricter than `none` means the browser never sends the cookie and **login
silently fails with no error.** `none` also requires `COOKIE_SECURE=true`.

### `COOKIE_DOMAIN`
```
COOKIE_DOMAIN=.auto-bd.com
```

**The leading dot is required.** It lets a cookie set by `api.auto-bd.com` be
sent to `www.auto-bd.com`. Leave blank for local development.

---

## Admin account

These create the one login that is not stored in the database — your way in
before any employee exists.

| Variable | Notes |
|---|---|
| `SUPER_ADMIN_EMAIL` | The login email |
| `SUPER_ADMIN_PASSWORD_HASH_B64` | base64 of a bcrypt hash — never the password |
| `SUPER_ADMIN_NAME` | Display name |

Generate the hash (needs `bcrypt`, so run it in Docker if the server lacks it):

```
docker run --rm python:3.12-slim sh -c "pip install -q bcrypt && python -c \"import bcrypt,base64;print(base64.b64encode(bcrypt.hashpw(b'YOUR_PASSWORD',bcrypt.gensalt(12))).decode())\""
```

> Your admin login is reachable by anyone on the internet and controls the whole
> business. `superpassword` is in every cracking dictionary and falls instantly.
> Use a password manager.

---

## Optional integrations

Each one degrades gracefully when unset — the feature switches off, the app
still runs.

### Email (Resend)

| Variable | Default | Purpose |
|---|---|---|
| `RESEND_API_KEY` | *(unset)* | Without it, no email is sent |
| `RESEND_FROM_EMAIL` | `info@auto-bd.com` | Sender; domain must be verified in Resend |
| `NOTIFY_INTERNAL_EMAIL` | `info@auto-bd.com` | Gets notified of new price requests |

### Gmail inbox (OAuth)

`GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`,
`GOOGLE_OAUTH_REDIRECT_URI`. **All three** must be set or the Gmail screen stays
disabled. The redirect URI must match Google Cloud Console character for
character.

### Image storage (S3 / Cloudflare R2)

| Variable | Default |
|---|---|
| `S3_ENDPOINT_URL` | *(unset — uses local disk)* |
| `S3_ACCESS_KEY_ID` | *(unset)* |
| `S3_SECRET_ACCESS_KEY` | *(unset)* |
| `S3_REGION` | `auto` |
| `S3_BUCKET_NAME` | `allaince-images` |
| `S3_PUBLIC_BASE_URL` | *(unset)* |

Leave all unset to store uploads on local disk under `./media`, served by the
app at `/media/...`.

> **Local disk is only safe if that directory persists.** On a host with an
> ephemeral filesystem, every deploy silently deletes every uploaded image —
> which is exactly the bug you hit. On the VPS the `media` Docker volume solves
> it; verify with a rebuild, not a restart (a restart preserves the filesystem
> either way and proves nothing).

### Rate limiting (Redis)

`REDIS_URL` — e.g. `redis://redis:6379/0`.

Unset, rate limiting falls back to per-worker in-memory counters. With
`WEB_CONCURRENCY=2` that means an attacker gets **twice** the intended login
attempts, because each worker counts separately. Compose provides Redis, so on
the VPS this is handled.

### `WEB_CONCURRENCY`

How many copies of the backend run at once. Default `4`.

Read by the Dockerfile's start command rather than `app/config.py`, so it will
not appear in `.env.example` — but it belongs in your `.env` all the same.

**Set `2` on a 2 GB VPS.** Each worker holds its own database connection pool,
and the default of 4 will exhaust memory on a small box. Drop to `1` if `free -h`
shows memory running short.

### Public URLs

| Variable | Default | Used for |
|---|---|---|
| `PUBLIC_API_URL` | `http://localhost:8000` | Absolute image/PDF links in emails |
| `PUBLIC_SITE_URL` | `http://localhost:3000` | Order-tracking links in emails |

Wrong values here produce emails whose links point at `localhost` — broken for
every recipient.

---

# Frontend (Vercel)

Set these in **Vercel → Settings → Environment Variables**.

> **Environment variables are baked in at build time.** Saving a change does
> nothing to the running site. You must **Deployments → Redeploy** afterwards.
> Forgetting this is the second most common broken deployment.

| Variable | Example | Notes |
|---|---|---|
| `SESSION_SECRET` | *(32+ chars)* | **Must equal the backend's exactly** |
| `API_URL` | `https://api.auto-bd.com` | Server-side calls |
| `NEXT_PUBLIC_API_URL` | `https://api.auto-bd.com` | Browser calls — **public** |
| `NEXT_PUBLIC_SITE_URL` | `https://www.auto-bd.com` | Canonical URLs, sitemap |
| `GOOGLE_SITE_VERIFICATION` | *(from Search Console)* | Optional |

## `API_URL` vs `NEXT_PUBLIC_API_URL`

Both point at the same backend. They exist separately because:

- `API_URL` is read by **server components**, which run on Vercel's servers
- `NEXT_PUBLIC_API_URL` is read by **browser code** — and anything prefixed
  `NEXT_PUBLIC_` is **embedded in the JavaScript sent to every visitor**

**Never put a secret in a `NEXT_PUBLIC_` variable.** It is public by definition.

They differ only when the backend is reachable at a private address from
Vercel's network. Yours are the same.

---

# Local development

**`Allaince-backend/.env`:**

```
DATABASE_URL=sqlite+aiosqlite:///./dev.db
SESSION_SECRET=dev-secret-at-least-32-characters-long-ok
GMAIL_TOKEN_ENCRYPTION_SECRET=dev-gmail-secret-at-least-32-chars-ok
ENVIRONMENT=development
CORS_ALLOWED_ORIGINS=http://localhost:3000
COOKIE_SECURE=false
COOKIE_SAMESITE=lax
PUBLIC_API_URL=http://localhost:8000
PUBLIC_SITE_URL=http://localhost:3000
```

**`Alliance-frontend/.env.local`:**

```
SESSION_SECRET=dev-secret-at-least-32-characters-long-ok
API_URL=http://localhost:8000
NEXT_PUBLIC_API_URL=http://localhost:8000
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Note `SESSION_SECRET` is identical in both — the same rule as production.

Run:

```
cd Allaince-backend && uvicorn app.main:app --reload
cd Alliance-frontend && npm run dev
```

---

# Diagnosing by symptom

| What you see | Cause |
|---|---|
| Admin logs in, immediately bounces to login | `SESSION_SECRET` mismatch, **or** you changed it on Vercel without redeploying |
| Login works on `www`, fails on a `vercel.app` URL | That origin is not in `CORS_ALLOWED_ORIGINS` — expected |
| Login appears to work but no cookie is stored | `COOKIE_SAMESITE` not `none`, or `COOKIE_SECURE` false over HTTPS |
| Backend won't start, "Unsafe production configuration" | Read the message — it names each failed check |
| Backend won't start, "at least 32 characters" | A secret is too short |
| Product images 404 after a deploy | Uploads on an ephemeral disk — needs the volume or S3 |
| Emails contain `localhost` links | `PUBLIC_API_URL` / `PUBLIC_SITE_URL` still at defaults |
| Admin pages all 307 to login | Same as row 1 — check `SESSION_SECRET` first |

---

# Rotating a leaked secret

Any value pasted into a chat, screenshot, or committed file is public. Assume
it is being used.

| Leaked | What to do |
|---|---|
| `SESSION_SECRET` | Generate new → set on backend **and** Vercel → redeploy both. Logs everyone out. |
| `RESEND_API_KEY` | Delete in the Resend dashboard, create new, update backend. |
| `SUPER_ADMIN_PASSWORD_HASH_B64` | Generate a hash from a **new** password. |
| Database password | Change in Postgres, update `POSTGRES_PASSWORD`, restart. |
| Vercel Blob token | Regenerate in Vercel → Storage. |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Reset in Google Cloud Console → Credentials. |

Rotating `SESSION_SECRET` on only one side breaks all admin login — change both,
then redeploy both.

## Currently outstanding for this project

These were exposed in chat and are **not yet rotated**:

1. **`RESEND_API_KEY`** — appeared twice
2. **`SESSION_SECRET`** — the current production value
3. **Vercel Blob token**
4. **Admin password** — `superpassword`, a top-tier dictionary entry

Items 1–3 are handled naturally by following `VPS-SETUP.md`. Item 4 is Step 5.2
of that guide. Turn on 2FA for Namecheap, Vercel, GitHub and Render while you
are there.
