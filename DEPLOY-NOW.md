# Deploy AutoLink — Step by Step

Your first deployment, written to be followed literally from top to bottom.
Every value you need is already filled in. Where you must paste something,
it says exactly what and where.

**Time:** about 60 minutes of clicking, plus DNS waiting time (which you can
ignore — your site is live on a free URL long before DNS finishes).

**Cost today:** nothing.

---

## What you are building

```
Customer's browser
      │
      ├── www.auto-bd.com ──→ Vercel      (the website people see)
      │                          │
      │                          ↓ asks for data
      └── api.auto-bd.com ──→ Render      (the backend/API)
                                 │
                                 ↓
                            Render PostgreSQL  (the database)
```

Three services, all free to start. Your domain from Namecheap points at them.

---

## STEP 0 — Two things before you begin

### 0.1 Change your passwords

You posted your Namecheap and SmarterASP passwords in a chat. Treat them as
public knowledge now.

- **Namecheap** — change the password and turn on 2FA. Do this one first.
  Whoever controls your registrar controls where your domain points and where
  your email goes, including password-reset emails for every other account.
- **SmarterASP.NET** — change the password.

This takes two minutes and protects everything else you are about to build.

### 0.2 Have your GitHub login ready

Your code is already on GitHub at `github.com/shariarmahir/Alliance` — I
verified this. Both hosts will pull directly from it. You do not need to run
any git commands.

---

## STEP 1 — Create your admin password

Before touching any website, generate the login for your own admin dashboard.

Open **PowerShell**, and run these two lines. Replace `YourRealPassword123`
with the password you actually want to use to log in.

```powershell
cd "M:\Private projects\Alliance\Allaince-backend"
.venv\Scripts\python -c "import bcrypt,base64;print(base64.b64encode(bcrypt.hashpw(b'YourRealPassword123',bcrypt.gensalt(12))).decode())"
```

You will get one long line of random-looking text, something like:

```
JDJiJDEyJDhLbVhxV3ZQLi4uLg==
```

**Copy that whole line into Notepad and keep it open.** You will paste it in
Step 3. This is called `SUPER_ADMIN_PASSWORD_HASH_B64` below.

> Why the strange encoding? A password hash contains `$` characters, which
> hosting platforms mangle into an empty value. Base64 wrapping survives that.

### Also keep these in Notepad

I generated these for you just now — they are fresh and used nowhere else:

```
SESSION_SECRET
EPWbAhSG48tlCa8uZAu-TfmQLy1NbfUcYRXs8alpktU

GMAIL_TOKEN_ENCRYPTION_SECRET
OT-perhIqahg3x6K4psBc6KgRToYmTPpCNsjcvwg4sE
```

You will paste `SESSION_SECRET` **twice** — once into Render, once into
Vercel. It must be identical in both places. Copy-paste it, never retype it.

---

## STEP 2 — The database (Render PostgreSQL)

1. Go to **render.com** → **Get Started** → **Sign in with GitHub** → authorise.
2. In the dashboard, click **New +** (top right) → **Postgres**.
3. Fill in:

   | Field | Value |
   |---|---|
   | Name | `autolink-db` |
   | Database | leave as generated |
   | Region | **Singapore** |
   | Plan | **Free** |

4. Click **Create Database**. Wait about a minute until status is *Available*.

5. Scroll down to the **Connections** section. You will see several URLs.
   Copy the **Internal Database URL**.

   It looks like:
   ```
   postgresql://autolink_db_user:AbC123xyz@dpg-abcd1234-a/autolink_db
   ```

6. **Paste it into Notepad, then change the beginning:**

   ```
   postgresql://...
   ```
   becomes
   ```
   postgresql+asyncpg://...
   ```

   Just insert `+asyncpg` after `postgresql`. Change nothing else.

> **This edit is not optional.** The app picks its database driver from that
> prefix. Without `+asyncpg` the backend cannot connect at all, and the error
> message you'd get does not obviously point at this.

> **Free database note:** Render deletes free databases after 90 days.
> Set a phone reminder for 80 days from today, right now. Upgrading to the
> $7/month plan before then keeps all your data.

---

## STEP 3 — The backend (Render Web Service)

1. **New +** → **Web Service**.
2. Choose **Build and deploy from a Git repository** → **Next**.
3. Find `shariarmahir/Alliance` → **Connect**.
   (If you don't see it, click *Configure account* and grant Render access.)
4. Fill in:

   | Field | Value |
   |---|---|
   | Name | `autolink-api` |
   | Region | **Singapore** — must match the database |
   | Root Directory | `Allaince-backend` |
   | Runtime | **Docker** |
   | Plan | **Free** |

   > Note the spelling `Allaince-backend` — that is the real folder name in
   > your repo. Typing `Alliance-backend` will fail to find it.

   > Render should auto-detect Docker. If it offers "Python 3" instead,
   > change it to Docker manually — the Dockerfile installs the graphics
   > libraries that PDF generation needs.

5. Scroll to **Environment Variables**. Click **Add Environment Variable**
   once per row below. This is the longest part; take it slowly.

   | Key | Value |
   |---|---|
   | `DATABASE_URL` | your edited URL from Step 2.6 (the one with `+asyncpg`) |
   | `SESSION_SECRET` | `EPWbAhSG48tlCa8uZAu-TfmQLy1NbfUcYRXs8alpktU` |
   | `GMAIL_TOKEN_ENCRYPTION_SECRET` | `OT-perhIqahg3x6K4psBc6KgRToYmTPpCNsjcvwg4sE` |
   | `ENVIRONMENT` | `production` |
   | `COOKIE_SECURE` | `true` |
   | `COOKIE_SAMESITE` | `none` |
   | `COOKIE_DOMAIN` | `.auto-bd.com` |
   | `CORS_ALLOWED_ORIGINS` | `https://www.auto-bd.com,https://auto-bd.com` |
   | `PUBLIC_SITE_URL` | `https://www.auto-bd.com` |
   | `PUBLIC_API_URL` | `https://api.auto-bd.com` |
   | `SUPER_ADMIN_EMAIL` | your admin email address |
   | `SUPER_ADMIN_NAME` | your name |
   | `SUPER_ADMIN_PASSWORD_HASH_B64` | the long line from Step 1 |
   | `WEB_CONCURRENCY` | `2` |

   > `CORS_ALLOWED_ORIGINS` has **no space** after the comma.

   > `COOKIE_DOMAIN` starts with a **dot**. That dot is what lets the login
   > cookie work across `www.` and `api.` on the same domain.

   > `WEB_CONCURRENCY=2` matters on the free plan. The default of 4 workers
   > each open their own database connections and exhaust the 512 MB limit.

6. Click **Create Web Service**. The first build takes about 5 minutes —
   it is installing the PDF graphics libraries. Watch the log scroll.

7. When the status turns **Live**, open in your browser:

   ```
   https://autolink-api.onrender.com/health
   ```

   (Render shows your exact URL at the top of the page — use that if it differs.)

   You want to see: `{"status":"ok"}`

**If it does not say Live, stop here and paste me the last 20 lines of the
log.** Do not continue to Step 4 — the next step needs a working backend.

> **Free tier behaviour:** after 15 minutes with no visitors, this service
> sleeps. The next visitor waits ~50 seconds while it wakes up. This is normal,
> not a bug. Before you show real customers, upgrade to Starter ($7/mo) so it
> stays awake.

---

## STEP 4 — Load your 48 products into the database

Your product catalogue currently lives in JSON files on your computer. This
step copies it into the live database. You run this from your own machine.

1. In Render, open **autolink-db** → **Connections** → copy the
   **External Database URL** this time. (External, because you are connecting
   from home rather than from inside Render.)

2. Add `+asyncpg` to it exactly as you did in Step 2.6.

3. In PowerShell:

```powershell
cd "M:\Private projects\Alliance\Allaince-backend"
$env:DATABASE_URL="postgresql+asyncpg://...paste your external URL here..."
.venv\Scripts\python -m scripts.migrate_json --dry-run
```

The `--dry-run` shows what it *would* do without changing anything. Read the
output. If it lists your products and categories and reports no errors, run it
for real:

```powershell
.venv\Scripts\python -m scripts.migrate_json
```

The script hashes any plaintext passwords, recalculates stock status, and
recomputes category counts on the way in. It refuses to run a second time, so
you cannot accidentally create duplicates.

---

## STEP 5 — The website (Vercel)

1. Go to **vercel.com** → **Sign Up** → **Continue with GitHub**.
2. **Add New...** → **Project**.
3. Find `Alliance` → **Import**.
4. **Root Directory** — click **Edit** next to it and select
   **`Alliance-frontend`**.

   > This is the single most-missed step in the whole guide. Your repo has two
   > projects in it, and Vercel looks at the root by default, finds no
   > `package.json`, and fails the build with a confusing error.

   > Note this folder is spelled `Alliance-frontend` (correctly), while the
   > backend folder is `Allaince-backend`. They genuinely differ.

5. Framework Preset should auto-fill as **Next.js**. Leave the build commands alone.

6. Expand **Environment Variables** and add three:

   | Key | Value |
   |---|---|
   | `API_URL` | `https://api.auto-bd.com` |
   | `NEXT_PUBLIC_API_URL` | `https://api.auto-bd.com` |
   | `SESSION_SECRET` | `EPWbAhSG48tlCa8uZAu-TfmQLy1NbfUcYRXs8alpktU` |

   > **`SESSION_SECRET` must be byte-identical to Render's.** The website
   > verifies your login token itself rather than asking the backend. If the
   > two values differ by even one character, every login is silently rejected
   > and the admin area bounces you back to the login page — with no error
   > shown, and nothing written to any log. Copy-paste it; never retype it.

7. Click **Deploy**. Takes about 3 minutes.

8. When it finishes, Vercel gives you a URL like `alliance-xyz.vercel.app`.
   **Open it. Your website is now live.**

### Send this URL to your client right now

It is fully working with real HTTPS. There is no reason to make them wait for
DNS. Do the rest while they are looking at it.

At this point, test:
- Products appear on the homepage
- Clicking a product opens its page
- Go to `/admin/login` and log in with your email and the password from Step 1

**If the products don't appear**, that's `CORS_ALLOWED_ORIGINS` on Render —
tell me and I'll fix it. Everything else can proceed regardless.

---

## STEP 6 — Point auto-bd.com at your site

Order matters here: tell the hosts about your domain **first**, then set up
DNS at Namecheap. Each host will show you the exact record values it wants.

### 6.1 In Vercel

Project → **Settings** → **Domains** → type `www.auto-bd.com` → **Add**.
Then add `auto-bd.com` too (Vercel will offer to redirect it to `www` — accept).

Vercel now displays the DNS records it needs. Leave this tab open.

### 6.2 In Render

`autolink-api` → **Settings** → scroll to **Custom Domains** → **Add Custom
Domain** → `api.auto-bd.com`.

Render shows you a CNAME target like `autolink-api.onrender.com`. Leave this
tab open too.

### 6.3 In Namecheap

Log in → **Domain List** → **Manage** next to `auto-bd.com` → **Advanced DNS** tab.

**First, delete the existing parking records.** Namecheap ships new domains
with a `CNAME www → parkingpage.namecheap.com` and an A record. Delete both,
or they will fight with yours.

Then **Add New Record** three times:

| Type | Host | Value | TTL |
|---|---|---|---|
| A Record | `@` | `76.76.21.21` | Automatic |
| CNAME Record | `www` | `cname.vercel-dns.com.` | Automatic |
| CNAME Record | `api` | the target Render showed you | Automatic |

**Use whatever values your two dashboards actually display.** They occasionally
differ per account, and the dashboards are the source of truth — not this table.

Namecheap's Host field wants only the subdomain part. Type `www`, not
`www.auto-bd.com` — Namecheap appends the domain itself.

Save (the green checkmark on each row).

### 6.4 Wait

Usually 30 minutes. Occasionally up to 24 hours. Both hosts issue free HTTPS
certificates automatically once they can see the records — you don't do
anything for HTTPS.

Check progress at **dnschecker.org** — paste `www.auto-bd.com` and watch it
turn green across the world map.

---

## STEP 7 — Final checks

Once `www.auto-bd.com` loads, verify each of these:

- [ ] `https://www.auto-bd.com` shows the site with products
- [ ] `https://auto-bd.com` (no www) redirects to the www version
- [ ] A product page opens and **Request Quotation** submits successfully
- [ ] `https://api.auto-bd.com/health` returns `{"status":"ok"}`
- [ ] `https://api.auto-bd.com/docs` returns **404** — this is correct.
      API docs are deliberately disabled in production.
- [ ] `https://www.auto-bd.com/admin/login` accepts your login
- [ ] The admin dashboard lists real orders and quotations
- [ ] Submitting the contact form creates a row in admin → Contact Requests
- [ ] Downloading a quotation PDF from admin works

### If something fails

| Symptom | Cause |
|---|---|
| Admin login loops back to the login page | `SESSION_SECRET` differs between Render and Vercel |
| No products appear on the site | `CORS_ALLOWED_ORIGINS` on Render doesn't exactly match your domain |
| First visit takes ~50 seconds | Normal on the free plan — the backend was asleep |
| Vercel build fails immediately | Root Directory isn't set to `Alliance-frontend` |
| Render build succeeds but never goes Live | Check `DATABASE_URL` has `+asyncpg` |
| Login works but logs out on next page | `COOKIE_DOMAIN` missing its leading dot |

Paste me the error and I'll tell you the fix.

---

## After launch

### Upgrade before real customers arrive

| | Now | Recommended |
|---|---|---|
| Vercel | Free | Free — genuinely fine |
| Render API | Free (sleeps 15 min) | **$7/mo — do this one** |
| Render Postgres | Free, **deleted at 90 days** | **$7/mo before day 90** |
| Domain | paid | ~$15/yr |

About **$14/month** total for a site that's always awake with a database that
doesn't disappear.

### Optional features, once live

Everything below is off right now and the site works fine without it. Each
degrades gracefully — nothing is broken, the feature is just skipped.

- **Product image uploads** need object storage (Cloudflare R2 has a generous
  free tier). Without it, uploaded images vanish on the next redeploy.
- **Customer emails** need a Resend account with `auto-bd.com` verified.
  Quotation emails are currently skipped, not failed.
- **Gmail inbox in admin** needs Google OAuth credentials.

Tell me when you want any of these and I'll walk you through it.

### Updating the site later

Push to `master` and both hosts redeploy automatically. No manual steps.

### Back up before risky changes

```powershell
pg_dump "your-external-database-url" > backup.sql
```
