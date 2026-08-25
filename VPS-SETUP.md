# Moving the AutoLink backend to your Namecheap VPS

Written for someone who has never used a Linux command line. Follow it from top
to bottom. Every command is given in full — you copy it, paste it, press Enter.

**What you are moving:** the backend (API) and the database, from Render to your
own VPS.

**What you are NOT moving:** the website itself (`www.auto-bd.com`). It stays on
Vercel, which is faster and free. Nothing about it changes.

---

## Before you start: what is already true

Your site is **already live and working**:

- `www.auto-bd.com` → Vercel → the website customers see
- `api.auto-bd.com` → Render → the backend
- Render PostgreSQL → your database (52 products, 15 price requests)

This guide changes **one** of those three: `api.auto-bd.com` will stop pointing
at Render and start pointing at your VPS.

**Your live site keeps working the entire time.** Nothing breaks until the very
last step, and that step is reversible in two minutes.

### Why bother, if it already works?

One concrete reason: **uploaded product images keep disappearing.** Render's free
tier erases uploaded files every time the backend restarts. Your VPS has a real
40 GB disk that keeps files permanently. That bug is the main thing this fixes.

You also stop depending on a free tier that can be withdrawn.

### The honest cost

Render currently handles security updates, backups, restarts-on-crash and
certificates for you. After this, **that is your job.** Section 10 covers it. It
is roughly ten minutes of attention per month. If that sounds like too much,
staying on Render is a legitimate choice — the image bug can also be fixed by
adding a Render persistent disk.

---

## Words you will see

| Word | What it means |
|---|---|
| **VPS** | Your rented computer in a data centre. Always on. No screen — you type commands to it. |
| **SSH** | The way you type commands to that computer from your own PC. |
| **root** | The all-powerful admin user. Can delete anything, no "are you sure". |
| **Docker** | Runs your app in a sealed box, so it behaves identically everywhere. |
| **DNS** | The phone book turning `api.auto-bd.com` into your server's number. |
| **Nginx** | The doorman: takes web traffic, adds HTTPS, passes it to your app. |
| **`$`** | Shown at the start of a line to mean "this is a command". **Don't type the `$`.** |

---

## What you need in front of you

1. **Your VPS IP address** — Namecheap emailed it, and it's in your Namecheap
   dashboard under the VPS product. It looks like `192.0.2.45`.
2. **Your VPS root password** — from that same email.
3. **Your Namecheap domain login** — to change DNS at the end.
4. **Your Render dashboard login** — to copy your existing data and settings.

---

# STEP 1 — Connect to your VPS

## 1.1 Open a terminal on your own PC

You are on Windows. Press `Start`, type `powershell`, press Enter. A blue window
opens. This is your terminal.

## 1.2 Connect

Type this, replacing `YOUR_VPS_IP` with your real IP address:

```
ssh root@YOUR_VPS_IP
```

The first time, it warns about authenticity and asks a yes/no question. Type
`yes` and press Enter. That warning is normal on a first connection.

Then it asks for a password. Type your root password and press Enter.

**Nothing appears as you type the password. No dots, no stars.** That is
deliberate, not a fault. Type it and press Enter.

When you're in, the line starts with something like `[root@vps ~]#`.

**You are now typing commands to your server, not your PC.**

## 1.3 Update the system

```
dnf update -y
```

Downloads and installs the latest security patches. Takes 2–5 minutes. Lots of
text scrolls past — that's expected. Wait for the `#` prompt to come back.

---

# STEP 2 — Make the server secure

Your server is exposed to the entire internet. Automated attacks will start
within hours. This step takes ten minutes and prevents the overwhelming majority
of them.

## 2.1 Create a normal user

Running everything as `root` means one mistyped command can destroy the server.
Create a normal account for daily use. Replace `autolink` with any name you like:

```
adduser autolink
passwd autolink
```

It asks for a new password twice (invisible again). **Use a long, unique
password** and save it in a password manager.

Give that user permission to perform admin tasks when needed:

```
usermod -aG wheel autolink
```

## 2.2 Set up a key instead of a password

A password can be guessed. A key cannot, in any practical sense.

**On your own PC** — open a *second* PowerShell window (leave the VPS one open):

```
ssh-keygen -t ed25519 -C "autolink-vps"
```

Press Enter three times to accept the defaults. Then display your new key:

```
type $env:USERPROFILE\.ssh\id_ed25519.pub
```

It prints one long line starting `ssh-ed25519 AAAA...`. **Select it and copy it.**

**Back in the VPS window**, run these one at a time:

```
mkdir -p /home/autolink/.ssh
nano /home/autolink/.ssh/authorized_keys
```

`nano` is a simple text editor. Paste your key (right-click pastes in
PowerShell). Then:

- Press `Ctrl` + `O`, then Enter — saves
- Press `Ctrl` + `X` — exits

Set the permissions (SSH refuses to use a key file others can read):

```
chown -R autolink:autolink /home/autolink/.ssh
chmod 700 /home/autolink/.ssh
chmod 600 /home/autolink/.ssh/authorized_keys
```

### Test it before going further

In your **second PowerShell window**:

```
ssh autolink@YOUR_VPS_IP
```

**It should log in without asking for a password.**

> ⚠️ **Do not continue until this works.** The next step disables password
> logins. If your key isn't working and you disable passwords, you are locked
> out of your own server permanently.

## 2.3 Turn off password logins

Only once the key login works. In the **root** window:

```
nano /etc/ssh/sshd_config
```

Use the arrow keys to find these lines. They may start with a `#` — delete the
`#` too. Change them to read exactly:

```
PermitRootLogin no
PasswordAuthentication no
```

Save with `Ctrl+O`, Enter, then `Ctrl+X`. Apply it:

```
systemctl restart sshd
```

Now only your key opens this server.

## 2.4 Close every port except the ones you need

```
dnf install -y firewalld
systemctl enable --now firewalld
firewall-cmd --permanent --add-service=ssh
firewall-cmd --permanent --add-service=http
firewall-cmd --permanent --add-service=https
firewall-cmd --reload
```

This allows SSH (you), HTTP and HTTPS (visitors) — and blocks everything else.
Importantly, **your database is now unreachable from the internet.**

## 2.5 Block repeat attackers

```
dnf install -y epel-release
dnf install -y fail2ban
systemctl enable --now fail2ban
```

Anyone failing SSH repeatedly gets banned automatically.

---

# STEP 3 — Install Docker

Docker runs your backend, database and Redis as three sealed boxes. This is far
more reliable than installing each by hand, and your project already includes a
file describing exactly how they fit together.

```
dnf install -y dnf-plugins-core
dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
dnf install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
systemctl enable --now docker
```

Let your normal user run Docker:

```
usermod -aG docker autolink
```

Check it worked:

```
docker --version
docker compose version
```

Both should print a version number.

---

# STEP 4 — Put your code on the server

Switch to your normal user:

```
su - autolink
```

Install git and download your code:

```
sudo dnf install -y git
git clone https://github.com/shariarmahir/Alliance.git
cd Alliance/Allaince-backend
```

If your repository is private, git asks for your GitHub username and a **personal
access token** (not your password — GitHub stopped accepting passwords). Create
one at GitHub → Settings → Developer settings → Personal access tokens, with
`repo` permission.

---

# STEP 5 — Set up your secrets

Your backend needs passwords and keys. They live in a file called `.env`.

## 5.1 Generate three new secrets

```
python3 -c "import secrets; print('SESSION_SECRET=' + secrets.token_urlsafe(32))"
python3 -c "import secrets; print('GMAIL_TOKEN_ENCRYPTION_SECRET=' + secrets.token_urlsafe(32))"
python3 -c "import secrets; print('POSTGRES_PASSWORD=' + secrets.token_urlsafe(24))"
```

**Copy all three lines into a text file on your PC.** You need them shortly.

> ⚠️ **`SESSION_SECRET` must be identical on the VPS and on Vercel.** If they
> differ, every admin login silently fails and the whole dashboard bounces back
> to the login page with no error anywhere. This is the single most common cause
> of a broken deployment.
>
> **You are changing it here, so you must also update it on Vercel in Step 9.**

## 5.2 Create your admin password

Replace `PUT_YOUR_PASSWORD_HERE` with the admin password you want, then run:

```
docker run --rm python:3.12-slim sh -c "pip install -q bcrypt && python -c \"import bcrypt,base64;print(base64.b64encode(bcrypt.hashpw(b'PUT_YOUR_PASSWORD_HERE',bcrypt.gensalt(12))).decode())\""
```

Copy the long output line — that is your `SUPER_ADMIN_PASSWORD_HASH_B64`.

This runs inside a temporary Docker container because `bcrypt` is one of your
project's libraries and is not installed on the bare server; running it directly
with `python3` fails with `ModuleNotFoundError`. The `--rm` deletes the container
the moment it finishes.

> **Pick a genuinely strong password.** Your admin login is reachable by anyone
> on the internet, and it controls your entire business. Your current password
> `superpassword` appears in every password-cracking dictionary in existence and
> would be found in under a second. Use a password manager to generate one.

## 5.3 Write the file

```
nano .env
```

Paste this, substituting your real values where marked:

```
POSTGRES_PASSWORD=YOUR_GENERATED_POSTGRES_PASSWORD
ENVIRONMENT=production

SESSION_SECRET=YOUR_GENERATED_SESSION_SECRET
GMAIL_TOKEN_ENCRYPTION_SECRET=YOUR_GENERATED_GMAIL_SECRET

CORS_ALLOWED_ORIGINS=https://www.auto-bd.com,https://auto-bd.com
COOKIE_SECURE=true
COOKIE_SAMESITE=none
COOKIE_DOMAIN=.auto-bd.com

SUPER_ADMIN_EMAIL=nurulislam@gmail.com
SUPER_ADMIN_PASSWORD_HASH_B64=YOUR_GENERATED_HASH
SUPER_ADMIN_NAME=Nurul Islam

RESEND_API_KEY=YOUR_NEW_RESEND_KEY
RESEND_FROM_EMAIL=info@auto-bd.com
NOTIFY_INTERNAL_EMAIL=info@auto-bd.com

PUBLIC_API_URL=https://api.auto-bd.com
PUBLIC_SITE_URL=https://www.auto-bd.com

WEB_CONCURRENCY=2
```

Save: `Ctrl+O`, Enter, `Ctrl+X`.

Lock the file so only you can read it:

```
chmod 600 .env
```

There is deliberately no `DATABASE_URL` or `REDIS_URL` line. `docker-compose.yml`
builds both automatically from `POSTGRES_PASSWORD`, so setting them here would
be ignored at best and contradictory at worst.

### Notes on three of those values

- **`RESEND_API_KEY`** — your current key was pasted into a chat window twice, so
  treat it as public. Go to [resend.com](https://resend.com) → API Keys → delete
  the old one, create a new one, and put the new one here.
- **`WEB_CONCURRENCY=2`** — how many copies of the backend run at once. On 2 GB
  RAM, 2 is right. The default of 4 will run you out of memory.
- **`COOKIE_DOMAIN=.auto-bd.com`** — the leading dot matters. It lets a login
  cookie set by `api.auto-bd.com` be accepted by `www.auto-bd.com`.

---

# STEP 6 — Start everything

Your project already contains `docker-compose.yml` describing the whole stack.
One command builds and starts all three pieces:

```
docker compose up -d --build
```

The first run takes 5–10 minutes — it downloads Python, PostgreSQL, Redis and
the PDF libraries. Later runs take seconds.

Check all three are running:

```
docker compose ps
```

You want three services (`api`, `db`, `redis`) showing `running` or `healthy`.

Test the backend directly:

```
curl http://localhost:8000/health
```

You should see a small success response. **If you do, your backend is alive.**

If something says `exited`, read the logs:

```
docker compose logs api
```

The error is almost always a typo in `.env`.

---

# STEP 7 — Copy your existing data across

Your live database on Render holds 52 products and 15 price requests. Move them.

## 7.1 Export from Render

In your **Render dashboard**, open your PostgreSQL database and copy the
**External Database URL**. It starts `postgres://`.

**On your own PC** (a PowerShell window, not the VPS), run — with your real URL
in quotes:

```
docker run --rm postgres:16-alpine pg_dump "PASTE_RENDER_EXTERNAL_URL_HERE" > backup.sql
```

This creates `backup.sql` in your current folder. Check it isn't empty:

```
dir backup.sql
```

It should be well over a few kilobytes.

## 7.2 Upload it to the VPS

```
scp backup.sql autolink@YOUR_VPS_IP:~/backup.sql
```

## 7.3 Load it in

**On the VPS:**

```
cd ~/Alliance/Allaince-backend
docker compose exec -T db psql -U postgres -d allaince < ~/backup.sql
```

Some red "already exists" warnings are normal — the tables were created by the
migrations, and this is filling them with data.

Confirm your products arrived:

```
docker compose exec db psql -U postgres -d allaince -c "SELECT COUNT(*) FROM products;"
```

**It should print 52.**

---

# STEP 8 — Add HTTPS

Right now your backend only answers locally. Nginx will expose it to the world
with a proper certificate.

## 8.1 Install

```
sudo dnf install -y nginx certbot python3-certbot-nginx
sudo systemctl enable --now nginx
```

## 8.2 Configure

```
sudo nano /etc/nginx/conf.d/api.conf
```

Paste exactly:

```nginx
server {
    listen 80;
    server_name api.auto-bd.com;

    # Product images and PDFs can be large; the default 1 MB rejects uploads.
    client_max_body_size 20M;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Save and exit. Check for typos, then load it:

```
sudo nginx -t
sudo systemctl reload nginx
```

`nginx -t` must say `syntax is ok` and `test is successful`. If not, re-check the
file — a missing `;` or `}` is the usual culprit.

## 8.3 Let Nginx talk to Docker

AlmaLinux blocks this by default, and the error message is not obvious:

```
sudo setsebool -P httpd_can_network_connect 1
```

---

# STEP 9 — Switch the domain over

**This is the only step that touches your live site.** Everything up to now has
been invisible to customers.

## 9.1 Point the DNS at your VPS

1. Log in to **Namecheap** → **Domain List** → **Manage** next to `auto-bd.com`
2. Open the **Advanced DNS** tab
3. Find the existing record for `api` — it currently points to Render
4. **Change its value to your VPS IP address**, and set:
   - Type: `A Record`
   - Host: `api`
   - Value: `YOUR_VPS_IP`
   - TTL: `Automatic`
5. Save

Wait 10–30 minutes. Check whether it has taken effect — **on your own PC**:

```
nslookup api.auto-bd.com
```

**Do not continue until this shows your VPS IP.** Certbot in the next step
verifies your domain by connecting to it, so it fails if DNS still points at
Render.

## 9.2 Get the certificate

**On the VPS:**

```
sudo certbot --nginx -d api.auto-bd.com
```

It asks for an email (for expiry warnings) and to accept the terms. When it
offers to redirect HTTP to HTTPS, **choose redirect**.

Certbot installs the certificate and sets up automatic renewal. Confirm renewal
is scheduled:

```
sudo systemctl list-timers | grep certbot
```

## 9.3 Update Vercel

Your `SESSION_SECRET` changed in Step 5, so Vercel must be told.

1. Go to [vercel.com](https://vercel.com) → your `autolink` project
2. **Settings** → **Environment Variables**
3. Edit **`SESSION_SECRET`** → paste the new value from Step 5.1 → save
4. Confirm `API_URL` and `NEXT_PUBLIC_API_URL` are both `https://api.auto-bd.com`
5. Go to **Deployments**, open the newest one, and click **Redeploy**

**A redeploy is required.** Environment variables are baked in at build time;
saving them alone changes nothing.

---

# STEP 10 — Check it works

From your own PC:

```
curl https://api.auto-bd.com/health
```

Then in a browser:

1. Open `https://www.auto-bd.com` — products should display
2. Open `https://www.auto-bd.com/admin` — log in with your new password
3. Click **Products**, **Orders**, **Quotations** — each should load
4. **Upload a product image**, then prove it survives a rebuild:

```
cd ~/Alliance/Allaince-backend
docker compose up -d --build
```

Reload the product page. **The image should still be there.**

This is the real test, and a plain `docker compose restart` does not perform it —
a restart keeps the container's filesystem, so images survive it whether or not
the storage is set up correctly. Only a rebuild replaces the filesystem, which is
exactly what erased your images on Render. Passing this means the fix holds.

> **Use `www.auto-bd.com`, not the `vercel.app` preview link.** Only
> `www.auto-bd.com` and `auto-bd.com` are in `CORS_ALLOWED_ORIGINS`. A
> `.vercel.app` address will bounce you back to the login screen — that is the
> exact problem you hit before, and it is a configuration boundary, not a bug.

## If something is wrong

```
cd ~/Alliance/Allaince-backend
docker compose logs api --tail 50
```

| Symptom | Cause |
|---|---|
| Admin bounces to login | `SESSION_SECRET` differs between VPS and Vercel, or you didn't redeploy |
| 502 Bad Gateway | Backend not running (`docker compose ps`) or SELinux (Step 8.3) |
| Certbot fails | DNS hasn't propagated — wait, re-check `nslookup` |
| Products list empty | Import didn't work — re-run the count in Step 7.3 |

## Rolling back

If it goes badly, put the `api` DNS record in Namecheap back to the Render value.
Your Render service is still running untouched. You're back within minutes.

**Keep Render running for at least a week** before deleting anything.

---

# STEP 11 — Keeping it alive

This is now your responsibility rather than Render's. It is not much, but it is
not zero.

## Automatic database backups

**A server without backups will eventually lose your business data.** Set this up
today, not later.

```
mkdir -p ~/backups
nano ~/backup-db.sh
```

Paste:

```bash
#!/bin/bash
cd /home/autolink/Alliance/Allaince-backend
STAMP=$(date +%Y%m%d-%H%M)
docker compose exec -T db pg_dump -U postgres allaince | gzip > /home/autolink/backups/db-$STAMP.sql.gz
# Keep 14 days of history
find /home/autolink/backups -name "db-*.sql.gz" -mtime +14 -delete
```

Save, make it runnable, and schedule it for 2am nightly:

```
chmod +x ~/backup-db.sh
crontab -e
```

Press `i`, then add this line:

```
0 2 * * * /home/autolink/backup-db.sh
```

Press `Esc`, then type `:wq` and press Enter.

Test it immediately — don't assume it works:

```
~/backup-db.sh
ls -lh ~/backups/
```

You should see a `.sql.gz` file with a real size.

> **Backups on the same server are only half a backup.** If the VPS itself fails,
> they die with it. Once a month, copy one to your PC:
> ```
> scp autolink@YOUR_VPS_IP:~/backups/db-*.sql.gz .
> ```

## Deploying new code

When your site is updated:

```
cd ~/Alliance/Allaince-backend
git pull
docker compose up -d --build
```

Database migrations run automatically on startup.

## Monthly maintenance

```
sudo dnf update -y
sudo reboot
```

Takes two minutes. Docker restarts everything by itself.

## Watching resources

2 GB RAM is not generous. Check occasionally:

```
free -h
docker stats --no-stream
df -h
```

If memory runs short, lower `WEB_CONCURRENCY` to `1` in `.env` and run
`docker compose up -d`.

---

# The security items still outstanding

These are separate from this migration and still need doing:

1. **Rotate the Resend API key** — pasted in chat twice, treat as public
   (handled in Step 5.3 if you did it there)
2. **Change the admin password** from `superpassword` (Step 5.2)
3. **Rotate `SESSION_SECRET`** — the old one was exposed (Step 5.1)
4. **Rotate the Vercel Blob token** — also exposed; regenerate in Vercel storage settings
5. **Turn on 2FA** for Namecheap, Vercel, GitHub and Render

Steps 1–3 happen naturally as you follow this guide. Items 4 and 5 you must do
separately.
