# Employee, Task & Leave System — Design Spec

**Phase 4 of 4** in the Super Admin / Sub-Admin system — the final phase. Builds on Phases 1-3 (auth/shell/analytics, product/catalog, operations). This phase turns "sub-admin" from a single fixed role into real, individually-tracked employee accounts, and adds task assignment, leave requests, and daily/weekly work reporting on both sides of the dashboard.

## Background & Constraints

- Today there is exactly one hardcoded sub-admin mock account (`subadmin@gmail.com`). This phase makes employee accounts real, admin-created records — while keeping the two original Phase-1 mock accounts (`nurulislam@gmail.com` super, `subadmin@gmail.com` sub) working unchanged for continuity/backward compatibility with earlier verification flows.
- **Confirmed scope boundary**: employee permissions stay uniform — every employee gets the same fixed sub-admin access (Products, Stock, Hero Images) established in Phases 1-2. "Working structure" per employee means their designation and assigned tasks, not per-person permission toggles. No new RBAC tiers are introduced.
- **Confirmed scope boundary**: no real clock-in/session-duration tracking exists or is being built. "DS time" / daily working time is a self-reported daily summary (hours worked + free-text notes), submitted once per day by the employee. This is a manual, honest substitute for hardware/session-based time tracking that doesn't exist in this stack.
- Mock security posture continues: employee passwords are stored in plain JSON, matching this whole app's existing mock-data approach (Phases 1-3 all use plain-JSON, unhashed mock credentials). Flagged as a known limitation for the real backend to fix, not solved here.
- Same filesystem-write pattern as Phases 2-3: `data/*.json` at repo root, read/written via server-only Route Handlers.

## Architecture

### Session identity change

`AdminSession` (in `types.ts`) gains an optional field:
```typescript
export type AdminSession = {
  role: AdminRole;
  name: string;
  email: string;
  employeeId?: string; // present for real employee accounts; absent for the 2 original hardcoded mock accounts
};
```
`admin-auth.ts`'s `verifyAdminCredentials` is extended: it first checks the existing 2 hardcoded `ADMIN_ACCOUNTS` (unchanged), then — if no match — checks `data/employees.json` for a matching email+password, returning a session with `role: "sub"` and the matched `employeeId`. This makes every admin-created employee a genuine, independently-loggable-in sub-admin account, while the two original demo accounts keep working exactly as before.

### Data layer additions

New files under `data/`:
- `data/employees.json` — array of `Employee` records, starts as `[]` (created via admin UI, not pre-seeded — matches Phase 3's orders/quotations pattern of starting empty since these represent real admin actions going forward)
- `data/tasks.json` — array of `Task` records, starts as `[]`
- `data/leave-requests.json` — array of `LeaveRequest` records, starts as `[]`
- `data/daily-reports.json` — array of `DailyReport` records, starts as `[]`

`app/lib/admin-employees.ts` (server-only, mirrors Phase 2/3's established pattern):
```typescript
import "server-only";
import fs from "fs/promises";
import path from "path";
import type { Employee, Task, LeaveRequest, DailyReport, TaskStatus, LeaveStatus } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");

export async function readEmployees(): Promise<Employee[]> { /* ... */ }
export async function addEmployee(employee: Employee): Promise<void> { /* ... */ }
// Note: employee login credential checks happen in admin-auth.ts (server-only, imported
// there too) — this module owns the data, admin-auth.ts owns the auth decision.

export async function readTasks(): Promise<Task[]> { /* ... */ }
export async function addTask(task: Task): Promise<void> { /* ... */ }
export async function updateTaskStatus(id: string, status: TaskStatus): Promise<void> { /* ... */ }

export async function readLeaveRequests(): Promise<LeaveRequest[]> { /* ... */ }
export async function addLeaveRequest(request: LeaveRequest): Promise<void> { /* ... */ }
export async function updateLeaveStatus(id: string, status: LeaveStatus): Promise<void> { /* ... */ }

export async function readDailyReports(): Promise<DailyReport[]> { /* ... */ }
export async function addDailyReport(report: DailyReport): Promise<void> { /* ... */ }
```
Always read fresh from disk per call (async `fs.readFile`, no module-level caching) — Phase 2 found and fixed a real bug from naive module-load caching; this module avoids it from the start by never caching.

### Types (additions to `app/lib/types.ts`)

```typescript
export type Designation = "sales-associate" | "warehouse-staff" | "support-agent" | "catalog-manager";

export type Employee = {
  id: string; // crypto.randomUUID(), also used as AdminSession.employeeId
  employeeIdNumber: string; // human-facing ID like "EMP-0042", admin-assigned, unique
  name: string;
  email: string;
  password: string; // plain text — see mock-security note above
  designation: Designation;
  createdAt: string; // ISO
};

export type TaskStatus = "pending" | "in-progress" | "completed";

export type Task = {
  id: string;
  title: string;
  description: string;
  assigneeEmployeeId: string; // Employee.id
  dueDate: string; // yyyy-mm-dd
  status: TaskStatus; // defaults to "pending"
  createdAt: string; // ISO
};

export type LeaveStatus = "pending" | "approved" | "rejected";

export type LeaveRequest = {
  id: string;
  employeeId: string;
  startDate: string; // yyyy-mm-dd
  endDate: string; // yyyy-mm-dd
  reason: string;
  status: LeaveStatus; // defaults to "pending"
  submittedAt: string; // ISO
};

export type DailyReport = {
  id: string;
  employeeId: string;
  date: string; // yyyy-mm-dd, defaults to submission day
  hoursWorked: number;
  summary: string; // free text, what they worked on
  submittedAt: string; // ISO
};
```

### Route Handlers (new, all under `app/api/admin/`)

- `employees/route.ts` — `POST` (super-admin-only): validates `{ name, email, password, employeeIdNumber, designation }`, checks email uniqueness against both `ADMIN_ACCOUNTS` and existing employees (reject with a clear error if taken), calls `addEmployee`.
- `tasks/route.ts` — `POST` (super-admin-only): validates `{ title, description, assigneeEmployeeId, dueDate }`, calls `addTask` with `status: "pending"`.
- `tasks/[id]/status/route.ts` — `PATCH`: body `{ status: TaskStatus }`. **Both roles can call this** (unlike Phase 3's status routes) — a sub-admin moving their own assigned task from pending→in-progress→completed is a normal sub-admin action, while super-admin can also update any task (e.g. reassign status if needed). Route checks the session is present (either role) and, for sub-admin callers, verifies the task's `assigneeEmployeeId` matches `session.employeeId` (a sub-admin can only update their own tasks, not someone else's) — this is a real per-employee authorization check, not just a role check.
- `leave-requests/route.ts` — `POST` (both roles: sub-admin submits their own request using `session.employeeId`; the route derives `employeeId` from the session, never trusts a client-supplied value, so an employee cannot file a leave request as someone else).
- `leave-requests/[id]/status/route.ts` — `PATCH` (super-admin-only): body `{ status: "approved" | "rejected" }`.
- `daily-reports/route.ts` — `POST` (sub-admin only, submitting their own report; `employeeId` derived from session same as leave requests).

All routes reuse the existing `app/api/admin/_auth.ts` session helper. Role/ownership checks follow the pattern described per-route above — this phase introduces the first "same endpoint, different authorization by role AND by data ownership" routes in the project, since tasks and leave requests are the first data type both roles legitimately touch.

### UI — Super Admin: Employees Page (`app/admin/(dashboard)/employees/page.tsx`, new — activates the currently-inert "Employees" nav link, `roles: ["super"]` only)

Tabbed layout:
- **Roster** tab: table of employees (name, employee ID number, designation, email, created date) + "Add Employee" dialog form (name, email, password, employee ID number, designation dropdown).
- **Tasks** tab: all tasks across all employees — table (title, assignee name, due date, status badge) + "Assign Task" dialog (title, description, assignee picker from the employee roster, due date). Filter by employee and by status.
- **Leave Requests** tab: a calendar view (month grid) showing approved leave spans per employee (color-coded or labeled by employee name), plus a list of pending requests below with Approve/Reject buttons. Matches the spec's "confirm leave or cancel leave with a calendar" literally.
- **Reports** tab: per-employee monthly leave-days-taken bar chart (Recharts, one bar per employee showing approved leave days this month) and a list of recent daily work-report summaries across all employees (date, employee name, hours, summary preview) — this is where "daily working report summaries... can show in the super admin dashboard" surfaces.

### UI — Sub-Admin: Personal Dashboard (`app/admin/(dashboard)/page.tsx` — **role-branching**, replaces the current super-only Overview at the same `/admin` path)

Per the confirmed decision, `/admin` becomes role-branching: super admin sees the existing Phase-1 analytics Overview unchanged; sub-admin now sees a new personal dashboard instead of being redirected away. Implementation: the existing page checks `session.role` (it already redirects non-super sessions away — that redirect is replaced with rendering a different component for `role === "sub"` instead of redirecting). Sub-admin's view shows:
- Task summary stat cards (Pending / In Progress / Completed counts, filtered to their own `employeeId`)
- Weekly work-hours bar chart (Recharts, derived from their own `DailyReport` entries, last 7 days)
- Quick-action cards linking to Task Desk / Leave Requests / Daily Report submission

`landingPathForRole` in `admin-auth.ts` changes: sub-admin's landing path becomes `/admin` (same as super admin) instead of `/admin/products`, since `/admin` is now meaningful for both roles.

### UI — Sub-Admin: Task Desk (`app/admin/(dashboard)/tasks/page.tsx`, new, `roles: ["super", "sub"]`)

Sub-admin sees only their own assigned tasks (filtered server-side by `session.employeeId`); super admin visiting the same URL sees a link/redirect to the Employees→Tasks tab instead (this page is primarily a sub-admin surface — super admin's task view already lives in the Employees page's Tasks tab per the design above, avoiding a duplicate UI). Kanban-style or simple grouped list (Pending / In Progress / Completed columns), each task clickable to advance its status via the `tasks/[id]/status` route. A weekly and monthly task-completion graph (Recharts) beneath the board, per the spec's "weekly graph, monthly graph" for the employee's own task tracking.

### UI — Sub-Admin: Leave Requests (`app/admin/(dashboard)/leave/page.tsx`, new, `roles: ["super", "sub"]`)

Sub-admin: a form (calendar-based date-range picker, reason textarea) to submit a new request, plus a list of their own past requests with status badges. Super admin visiting this URL sees the same calendar+approval view as the Employees→Leave Requests tab (a legitimate shared view, unlike Tasks — approving leave is naturally a cross-employee calendar, so no split needed here).

### UI — Sub-Admin: Daily Report (`app/admin/(dashboard)/daily-report/page.tsx`, new, `roles: ["super", "sub"]`)

Sub-admin: a simple form (date defaulting to today, hours worked number input, summary textarea) + a list of their own past submissions. Super admin visiting this URL sees a redirect to the Employees→Reports tab (avoiding a third duplicate view — this one has no natural "shared" framing the way leave's calendar does, so it stays sub-admin-primary like Tasks).

### Nav & RBAC updates

- `app/admin/nav-config.ts`: flip `enabled: false → true` for "Employees" (`roles: ["super"]`, unchanged). Add three new nav items: "Task Desk" (`/admin/tasks`, `roles: ["super", "sub"]`, enabled), "Leave Requests" (`/admin/leave`, `roles: ["super", "sub"]`, enabled), "Daily Report" (`/admin/daily-report`, `roles: ["super", "sub"]`, enabled) — all visible to both roles now, unlike Phase 3's operations screens which stayed super-only, since these three are genuinely bi-directional (sub-admin uses them directly, super-admin oversees via them).
- `proxy.ts`: `SUB_ADMIN_ALLOWED_PREFIXES` extended to include `/admin/tasks`, `/admin/leave`, `/admin/daily-report`. The bare `/admin` path itself must also be allowed through for sub-admin now (previously it triggered the sub-admin redirect-to-products rule) — since `/admin` is now their real dashboard, not a super-only page they must be bounced from. This requires either adding `/admin` itself to `SUB_ADMIN_ALLOWED_PREFIXES`'s exact-match set, or removing the bare-`/admin` case from the redirect rule entirely now that the page itself role-branches correctly. **Re-verify this carefully against Phase 1's own regression** (the bare-path matcher bug that let sub-admin bypass RBAC) — the fix here must not reopen that hole for any OTHER super-only path; only `/admin` itself should newly become dual-role.

## Error Handling

- Employee email uniqueness (against both hardcoded accounts and existing employees) is checked server-side on creation; a collision returns a 400 with a clear "email already in use" message.
- A sub-admin attempting to update a task that isn't theirs (`assigneeEmployeeId !== session.employeeId`) gets a 403, not a silent no-op — this is a real authorization boundary, not a UI-only restriction (the route itself enforces it, since a determined user could otherwise call the API directly).
- Leave request date validation: `endDate >= startDate`, both required, both real dates — checked client-side (matching existing form patterns) and server-side via zod.
- Daily report: one submission per employee per day is NOT enforced as a hard constraint (an employee correcting an earlier same-day submission by submitting again is treated as adding a new entry, not blocked) — keeping this simple rather than building edit/upsert semantics not asked for in the spec.

## Testing Approach

- `npx tsc --noEmit` and `npm run lint` clean before each commit.
- Live browser verification (Chrome DevTools MCP):
  - Super admin creates a new employee (distinct from the original mock `subadmin@gmail.com`) → log out, log in as that new employee's email/password → confirm it works and lands on the new sub-admin personal dashboard at `/admin`.
  - Super admin assigns a task to that employee → log in as the employee → confirm the task appears in their Task Desk, move it through pending→in-progress→completed → confirm the status updates and their dashboard stat cards reflect it.
  - As the employee, submit a leave request (date range + reason) → log in as super admin → confirm it appears as pending in the Employees→Leave Requests calendar/list → approve it → confirm status updates on both sides.
  - As the employee, submit a daily report → confirm it appears in their own history and in the super admin's Reports tab.
  - Confirm the original two mock accounts (`nurulislam@gmail.com`, `subadmin@gmail.com`) still log in correctly and are unaffected (backward-compatibility regression check) — note the original `subadmin@gmail.com` account has no `employeeId` (it's one of the 2 hardcoded accounts, not a `data/employees.json` record), so verify Task Desk/Leave/Daily Report handle a session with no `employeeId` gracefully (empty states, not crashes) for that specific account.
  - Attempt (via direct API call, not just UI) to update a task assigned to a different employee while logged in as a sub-admin who isn't the assignee → confirm 403.
  - Full regression pass: Phase 1 analytics Overview (super admin), Phase 2 product/stock/hero-image management (both roles), Phase 3 orders/quotations/contact/email screens (super admin) all still work after this phase's changes to shared files (`types.ts`, `nav-config.ts`, `proxy.ts`, `admin-auth.ts`).

## Out of Scope (deferred)

- Real clock-in/session-based time tracking (self-reported daily summaries only, per confirmed decision).
- Per-employee granular permission toggles (uniform sub-admin permission set for all employees, per confirmed decision).
- Employee editing/deletion, task editing/reassignment after creation, leave request editing.
- Password reset / forgot-password flows for employee accounts.
- This is the final phase — no further phases follow.
