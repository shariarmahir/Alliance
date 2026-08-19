# Security & Production Setup

Everything here is required before the site is exposed to real customers. The
code changes are done; these are the operator steps that only someone with
access to the Vercel and Resend dashboards can complete.

## Required environment variables

Set all of these in **Vercel → Project → Settings → Environment Variables**
(and in `.env.local` for local development). The app refuses to authenticate
anyone if `SESSION_SECRET` is missing — that is deliberate: falling back to an
unsigned session would silently reintroduce the vulnerability it exists to fix.

| Variable | Purpose |
|---|---|
| `SESSION_SECRET` | Signs the admin session JWT. **Required.** Min 32 chars. |
| `SUPER_ADMIN_EMAIL` | Bootstrap owner login. |
| `SUPER_ADMIN_NAME` | Display name for that account. |
| `SUPER_ADMIN_PASSWORD_HASH_B64` | bcrypt hash, **base64-encoded** — see why below. |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob store token. |
| `BLOB_STORE_ID` | Vercel Blob store id. |
| `BLOB_PRIVATE` | `"true"` once the store is private (see below). |
| `RESEND_API_KEY` | Transactional email. |
| `RESEND_DOMAIN_VERIFIED` | `"true"` once auto-bd.com verifies at Resend. |

Generate a session secret:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
```

Generate a password hash (base64-encoded — see the warning below for why):

```bash
node -e "require('bcryptjs').hash('YOUR-NEW-PASSWORD',12).then(h=>console.log(Buffer.from(h).toString('base64')))"
```

### Why the hash is base64, not raw

Next.js's env loader (`@next/env`, which bundles `dotenv-expand`) performs
`$VAR` / `${VAR}` substitution on every value in `.env.local`. A raw bcrypt
hash — `$2b$12$K/c4wbLLKK0...` — contains `$2b`, `$12` and `$K`, each of which
looks like a variable reference. None of those variables exist, so
dotenv-expand silently resolves them to empty strings, quietly truncating the
60-character hash to 52 and making every correct password fail with "Invalid
email or password." This is exactly the bug that shipped once during this
project's setup — it produces no error, no warning, just a hash that looks
plausible and doesn't work.

Backslash-escaping (`\$`) does not reliably survive dotenv-expand's
interpolation order in testing. Storing the hash as base64 sidesteps the
entire class of bug, since base64 output never contains `$`.
`app/lib/admin-auth.ts`'s `decodeBootstrapHash()` decodes it back before
comparing.

**This same trap applies to any other secret containing `$`** — a webhook
signing secret, an API key with a `$` in it, etc. If in doubt, base64-encode
it and decode in code rather than trusting it to survive the env loader raw.

## Outstanding manual steps

### 1. Change the super admin password — do this first

`SUPER_ADMIN_PASSWORD_HASH_B64` currently decodes to a hash of the old
`superpassword`, kept only so the existing login keeps working through the
migration. It is weak and was committed in plaintext in an earlier version of
the source. Generate a new one with the command above and replace it.

### 2. Rotate the Resend API key and Blob token

Both were previously held in plaintext in `.env.local` and shared in
conversation. They are correctly gitignored and never reached git history, but
should be rotated on principle:

- Resend key: <https://resend.com/api-keys>
- Blob token: Vercel → Storage → your store → Tokens

### 3. Make the Blob store private — the last critical item

Business data (`data/*.json`) is currently readable by anyone who knows the
store hostname, with no authentication. That includes `employees.json`,
`quotations.json` and `orders.json` — staff password hashes, customer PII,
addresses and pricing.

Private access is a **store-level** setting in Vercel Blob; an existing public
store cannot be converted, so a new store is required:

1. Vercel → Storage → **Create Database** → Blob → choose **Private**.
2. Connect it to the project; copy the new `BLOB_READ_WRITE_TOKEN` and
   `BLOB_STORE_ID` into the environment.
3. Set `BLOB_PRIVATE="true"`.
4. Run the migration, which copies every record across and deletes the
   world-readable originals:

   ```bash
   node scripts/migrate-secure.mjs
   ```

5. Confirm the old public URLs now return 404.

Note that **images must stay public** — they are rendered by `<img>` tags in
customers' browsers. `app/lib/admin-catalog.ts` writes them with
`access: "public"` separately from the JSON records, so this split is already
handled in code.

### 4. Verify the email domain

Add Resend's DNS records for `auto-bd.com` at **Namecheap** (the domain's
nameservers are `dns1/dns2.registrar-servers.com`, not Cloudflare). Once the
domain shows *Verified* at <https://resend.com/domains>, set
`RESEND_DOMAIN_VERIFIED="true"`. That single flag switches on all three of:
the `info@auto-bd.com` sender, the company CC on issued quotations, and the
new-price-request notice. Until then no email sends at all.

## What was fixed in code

| Issue | Fix |
|---|---|
| Forgeable admin session | Sessions are HS256-signed JWTs with an 8h expiry (`app/lib/session-token.ts`). A hand-written cookie is rejected. |
| Plaintext passwords | bcrypt (cost 12) on create and compare. Hardcoded accounts removed from source. |
| Password hashes sent to the browser | `readSafeEmployees()` / `stripPassword()`; client components take `SafeEmployee`. |
| No rate limiting | `app/lib/rate-limit.ts` on login, contact and quotation endpoints. |
| Unauthenticated order writes | `POST /api/orders` now returns 410; it accepted client-supplied prices. |
| Missing security headers | CSP, HSTS, `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` in `next.config.ts`. |
| SVG stored-XSS path | Image CSP `default-src 'none'; sandbox`. |
| Fake delivery tracking | `/track/[trackingId]` reads real order state; admins advance stages from the Quotations screen. |
| No way to offboard staff | `PATCH`/`DELETE /api/admin/employees` — reset password, change access, disable or delete. |

## Self-hosted third-party assets

The admin login animation (`app/admin/login/login-animation.tsx`) originally
pulled three files from external hosts at runtime: its WebAssembly renderer
from `cdn.jsdelivr.net` with an `unpkg.com` fallback, and the animation itself
from `lottie.host`. The CSP's `connect-src 'self'` blocked all three, which
surfaced as *"Primary WASM URL failed / Backup WASM URL failed / Buffered
fallback failed / WASM loading failed from all sources"* in the browser console.

Rather than allowlisting three CDNs for a decorative animation, both assets are
served from our own origin:

- `public/lottie/dotlottie-player.wasm` — copied from
  `node_modules/@lottiefiles/dotlottie-web/dist/`
- `public/lottie/login.lottie` — the animation file

`DotLottie.setWasmUrl("/lottie/dotlottie-player.wasm")` at module scope points
the library at the local copy, and the CSP carries `'wasm-unsafe-eval'` so the
same-origin module can compile.

**If you upgrade `@lottiefiles/dotlottie-*`, re-copy the WASM file** — a
version mismatch between the bundled loader and the local binary will break the
animation. `@lottiefiles/dotlottie-web` is pinned to `0.79.0` (via both
`dependencies` and `overrides`) to match what `dotlottie-react` bundles
internally; without the pin npm installs two copies, and `setWasmUrl` then
configures a different module instance than the player actually uses, so the
CDN fetches resume.

## Known limitations

- **Rate limiting is per-instance.** It uses module memory, so serverless
  instances don't share counters. It stops casual spam and slows brute-force
  substantially, but is not a hard guarantee. Swap `checkRateLimit` for
  `@upstash/ratelimit` on Redis for a shared limit.
- **CSP allows `unsafe-inline`/`unsafe-eval` on scripts.** Next's hydration
  requires it without a nonce-based setup. Tightening this is worthwhile but
  is a larger change.
- **No automated tests or error monitoring.** Consider Vitest for the auth and
  RBAC paths, and Sentry for runtime visibility.
- **Some admin analytics are still mock data** — the order-ratio, traffic and
  clients-by-country panels read from `app/lib/mock-analytics.ts`. KPI cards and
  the revenue trend are real.
