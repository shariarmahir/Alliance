# Deployment documents — start here

Four documents cover deployment. This page says which one you want.

---

## Current live setup

```
Customer's browser
      │
      ├── www.auto-bd.com ──→ Vercel   (the website)
      │                          │
      │                          ↓ asks for data
      └── api.auto-bd.com ──→ Render   (the backend API)
                                 │
                                 ↓
                            Render PostgreSQL
```

Verified live on 2026-08-26: `api.auto-bd.com` answers `/health` in 0.25s,
serving from `autolink-api-sx5t.onrender.com` behind Cloudflare.
`www.auto-bd.com` resolves to Vercel. Your Namecheap domain already points at
both correctly.

**This is already deployed and working.** Deployment is not something still
ahead of you.

---

## Which document do I open?

| I want to… | Open |
|---|---|
| Look up an environment variable | **[ENVIRONMENT.md](ENVIRONMENT.md)** |
| Fix a broken deploy | **[ENVIRONMENT.md](ENVIRONMENT.md)** → "Diagnosing by symptom" |
| Move the backend to my Namecheap VPS | **[VPS-SETUP.md](VPS-SETUP.md)** |
| See how the current Render setup was built | [DEPLOY-NOW.md](DEPLOY-NOW.md) *(historical)* |
| Read the background on host choices | [DEPLOYMENT.md](DEPLOYMENT.md) *(historical)* |

### [ENVIRONMENT.md](ENVIRONMENT.md) — the reference

Every variable both apps read, what breaks when it is wrong, and a
symptom-to-cause table. **Check here first when something is broken** — most
deployment failures are one wrong variable, and they rarely produce a useful
error message.

### [VPS-SETUP.md](VPS-SETUP.md) — the migration

Moves the backend and database from Render to your Namecheap VPS. The frontend
stays on Vercel.

Written for someone who has never used a Linux command line. Your live site
keeps serving customers throughout; only the final step touches it, and it
reverts in two minutes.

**The reason to do it:** Render's free tier erases uploaded files on every
restart, so product images keep vanishing. The VPS has a real disk that keeps
them.

**The cost:** patches, backups, certificates and restarts become your job —
about ten minutes a month. Staying on Render is a legitimate choice; a Render
persistent disk fixes the image bug too.

### DEPLOY-NOW.md and DEPLOYMENT.md — historical

These describe building the Render + Vercel setup that is **already running**.
Keep them for reference, but do not follow them as instructions — you would be
rebuilding what you have. Note they still mention SmarterASP.NET, which was
evaluated and rejected.

---

## Things that are true regardless of host

**`SESSION_SECRET` must be byte-identical** on the backend and on Vercel. When
it isn't, every admin page silently redirects to login with nothing in any log.
This is the most common broken deployment by a wide margin.

**Vercel bakes environment variables in at build time.** Changing one and
saving does nothing until you **Deployments → Redeploy**. Second most common.

**Use `www.auto-bd.com`, never a `*.vercel.app` preview URL, for admin work.**
Only the real domains are in `CORS_ALLOWED_ORIGINS`, so a preview URL bounces
you to login. That is the allow-list working as intended.

**Uploaded images need somewhere permanent to live.** Either a persistent disk
or S3/R2. Verify with a rebuild, not a restart — a restart keeps the filesystem
and proves nothing.

---

## Security items still outstanding

Exposed in chat, **not yet rotated**:

1. **`RESEND_API_KEY`** — appeared twice
2. **`SESSION_SECRET`** — the current production value
3. **Vercel Blob token**
4. **Admin password** — `superpassword`, found instantly by any cracker
5. **Database backups** — no automated backup is running today

Items 1–4 are handled by following [VPS-SETUP.md](VPS-SETUP.md). Item 5 is
Step 11 of it. If you stay on Render instead, do them there directly.
