# Admin Auth, Shell & Analytics Dashboard — Design Spec

**Phase 1 of 4** in the Super Admin / Sub-Admin system. This phase delivers: mock authentication for two roles (Super Admin, Sub-Admin), a protected `/admin` route tree with a premium sidebar shell, role-based navigation, and a fully-built premium analytics overview page for the Super Admin.

Later phases (separately brainstormed, specced, and built):
- **Phase 2** — Product & catalog management (categories, single + bulk product input with filename-matching validation, bulk images, stock control, hero image control) — this is also the Sub-Admin's permitted work area.
- **Phase 3** — Operations (confirm/cancel orders & quotations, contact requests, email inbox tracking).
- **Phase 4** — Employee system: task assignment, leave requests/calendar, time tracking, weekly/monthly work-report graphs, on both the Super Admin and Sub-Admin sides.

## Background & Constraints

- No backend exists yet (`Allaince-backend/` is empty). Per explicit user instruction, this entire admin system is built against **mock data**, clearly marked for removal before production — consistent with how the rest of Alliance (storefront quote/order flow) has been built this session.
- Two mock accounts, given directly by the user:
  - Super Admin: `nurulislam@gmail.com` / `superpassword`
  - Sub-Admin: `subadmin@gmail.com` / `subpassword`
- Sub-admin's permitted access is explicitly scoped by the user to: **inputting/updating products, stock in/out, and hero section image control**. Everything else (analytics, orders, quotations, employees, contact/email) is Super-Admin-only.
- Next.js 16 renamed `middleware.ts` → `proxy.ts` (same functionality, new file/export name). This project uses `proxy.ts`.
- Next.js 16's `cookies()` API is async (`await cookies()`).
- Existing shadcn primitives available: accordion, badge, button, card, input, label, select, separator, sonner (toast), tabs, textarea, switch, radio-group, dropdown-menu. No table, dialog, or calendar component yet — later phases will add these as needed.
- No chart library is installed. This phase adds **Recharts**.

## Architecture

### Routing

```
app/
  admin/
    login/
      page.tsx              # public login page, role-agnostic form
    (dashboard)/
      layout.tsx             # sidebar + topbar shell, role-aware nav
      page.tsx                # Super Admin overview/analytics (redirects sub-admin away)
      products/
        page.tsx               # Phase 1 stub: confirms sub-admin routing works; Phase 2 replaces this
```

`(dashboard)` is a route group so its `layout.tsx` doesn't affect the `/admin/login` URL segment.

### Session & Auth (mock)

- `app/lib/admin-auth.ts` (server-only module): exports `ADMIN_ACCOUNTS` (the two hardcoded mock accounts — **marked for removal before production**), and `verifyAdminCredentials(email, password)` returning the matched account's `{ role, name, email }` or `null`.
- Login form posts to a Route Handler `app/admin/login/actions.ts` (Server Action) that calls `verifyAdminCredentials`, and on success sets a cookie:
  - Name: `alliance_admin_session`
  - Value: JSON `{ role: "super" | "sub", name: string, email: string }`
  - `httpOnly: true`, `sameSite: "lax"`, `path: "/"`, no `secure` flag issue locally (Next handles this in prod via HTTPS detection is out of scope for mock — set `secure: process.env.NODE_ENV === "production"`)
  - No password stored in the cookie.
- Logout: a Server Action that clears the cookie and redirects to `/admin/login`.
- `proxy.ts` (project root): reads `alliance_admin_session` cookie for requests matching `/admin/:path*` (excluding `/admin/login`). No cookie → redirect to `/admin/login`. Cookie present but role is `sub` and path isn't in the sub-admin allowlist (`/admin`, `/admin/products`, `/admin/stock`, `/admin/hero-images` prefixes) → redirect to `/admin/products`. This is an **optimistic check** per Next's own guidance (proxy is not a full session/authorization solution) — acceptable here since there's no real backend to authorize against yet; Phase 2+ pages will also do a server-side role check in their own layout/page for defense in depth.
- Already-logged-in users hitting `/admin/login` get redirected to their role's landing page (`/admin` for super, `/admin/products` for sub) — checked in `admin/login/page.tsx` itself (Server Component reading the cookie), not in proxy.

### Shell (`admin/(dashboard)/layout.tsx`)

- Server Component. Reads the session cookie (redirect to login if missing — defense in depth alongside proxy).
- Fixed left sidebar (collapsible via a client component toggle), icon+label nav items grouped into sections. Nav items filtered by role:
  - **Super Admin sees:** Overview, Products *(stub this phase)*, Employees *(label only, inert — Phase 4)*, Orders *(label only, inert — Phase 3)*, Quotations *(inert)*, Contact Requests *(inert)*, Emails *(inert)*. Inert items are visually present (per "very premium, advanced, professional" direction — the full structure should be visible) but styled disabled/"coming soon" and non-clickable, so the nav doesn't look empty while later phases aren't built yet.
  - **Sub-Admin sees:** Products, Stock *(inert this phase — folds into Phase 2)*, Hero Images *(inert this phase — folds into Phase 2)*.
- Top bar: current user's name + role badge, logout button (dropdown-menu).
- Content area: scrollable, max-width container matching the storefront's premium spacing conventions.

### Overview / Analytics Page (`admin/(dashboard)/page.tsx`, Super Admin only)

Sub-admin hitting `/admin` is redirected to `/admin/products` by proxy, so this page only ever renders for super admin — no in-page role branching needed beyond a defensive check.

Sections, top to bottom:

1. **KPI stat cards** (4-across on desktop): Total Revenue, Orders This Month, Pending Quotations, Active Clients. Each shows the mock current value and a small trend delta (e.g. "+12.4% vs last month") with an up/down indicator.
2. **Revenue chart** — Recharts `AreaChart`, with a Weekly / Monthly / Yearly toggle (tabs component) that swaps the underlying mock dataset and x-axis granularity.
3. **Order ratio chart** — Recharts `PieChart`/donut showing Confirmed vs Pending vs Cancelled order counts, with a legend and center total label.
4. **Best-selling products** — ranked list (top 5), each row: product thumbnail, name, units sold, revenue contribution. Sourced from existing mock `Product` records that already carry `weekRank`/`monthRank`/`yearRank` in `app/lib/types.ts` — reuse, don't duplicate.
5. **Clients by country** — horizontal bar chart, mock country → order-count breakdown.
6. **Traffic / order-source performance** — bar chart, mock breakdown across channels (Direct, Google, Facebook, WhatsApp Referral, Other).

All chart data comes from a new `app/lib/mock-analytics.ts`, clearly commented `// MOCK DATA — replace with real analytics API before production`.

### Types

New types added to `app/lib/types.ts`:

```typescript
export type AdminRole = "super" | "sub";

export type AdminSession = {
  role: AdminRole;
  name: string;
  email: string;
};

export type RevenuePoint = { label: string; value: number };
export type OrderRatioSlice = { status: "confirmed" | "pending" | "cancelled"; count: number };
export type CountryBreakdown = { country: string; orders: number };
export type TrafficSource = { source: string; orders: number };
```

## Error Handling

- Invalid login credentials: inline form error via toast ("Invalid email or password"), no field-level leakage of which field was wrong.
- Missing/malformed session cookie mid-session (e.g. manually deleted): proxy redirect to login handles this on next navigation; no client-side polling needed.

## Testing Approach

- `npx tsc --noEmit` and `npm run lint` clean before each commit.
- Live browser verification (Chrome DevTools MCP):
  - Super admin login → lands on `/admin` → all chart sections render with mock data, weekly/monthly/yearly toggle works, sidebar shows full nav with inert items visibly disabled.
  - Sub-admin login → lands on `/admin/products` (stub) → sidebar shows only Products/Stock/Hero Images, Stock/Hero Images inert.
  - Sub-admin manually navigating to `/admin` (super-only) → redirected to `/admin/products`.
  - Direct navigation to any `/admin/*` URL with no session cookie → redirected to `/admin/login`.
  - Logout clears session and redirects to login; back-navigation to a protected page re-redirects (no stale render).
  - Already-logged-in user visiting `/admin/login` → redirected to their landing page.

## Out of Scope (explicitly deferred to later phases)

- Product/category CRUD, bulk import, stock management, hero image upload (Phase 2).
- Order/quotation confirm-cancel workflows, contact requests, email inbox (Phase 3).
- Employee accounts management, task assignment, leave requests, time tracking, work reports (Phase 4).
- Real backend, real password hashing, real multi-device session persistence.
