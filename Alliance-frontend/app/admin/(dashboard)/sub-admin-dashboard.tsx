import Link from "next/link";
import { readTasks, readDailyReports } from "@/app/lib/admin-employees";
import type { AdminSession, Task } from "@/app/lib/types";
import { WeeklyHoursChart } from "./charts/weekly-hours-chart";

// Sub-admin's personal desk, rendered at the same /admin path as the
// super-admin Overview (role-branched in page.tsx). Shows only this
// employee's own tasks and reports — filtered by session.employeeId.
// Handles the no-employeeId case (the original hardcoded subadmin@gmail.com
// mock account) gracefully with empty states, not crashes.

const STATUS_PILL: Record<Task["status"], { label: string; cls: string }> = {
  pending: { label: "PENDING", cls: "bg-[#f2f4f7] text-ink-muted" },
  "in-progress": { label: "IN PROGRESS", cls: "bg-warn-bg text-warn" },
  completed: { label: "COMPLETED", cls: "bg-ok-bg text-ok" },
};

// What a sub-admin can and cannot reach. Mirrors the roles in nav-config.ts
// and the prefixes enforced in proxy.ts — display only, not the source of
// truth for access.
const ACCESS = [
  { label: "Add & update products", granted: true },
  { label: "Stock in / stock out", granted: true },
  { label: "Hero section images", granted: true },
  { label: "Orders & quotations", granted: false },
  { label: "Revenue & clients", granted: false },
  { label: "Employees & leave approval", granted: false },
];

function greeting() {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Asia/Dhaka" }).format(
      new Date()
    )
  );
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

export async function SubAdminDashboard({ session }: { session: AdminSession }) {
  const employeeId = session.employeeId;

  const [allTasks, allReports] = await Promise.all([readTasks(), readDailyReports()]);
  const myTasks = employeeId ? allTasks.filter((t) => t.assigneeEmployeeId === employeeId) : [];
  const myReports = employeeId ? allReports.filter((r) => r.employeeId === employeeId) : [];

  const pending = myTasks.filter((t) => t.status === "pending").length;
  const completed = myTasks.filter((t) => t.status === "completed").length;
  const open = myTasks.filter((t) => t.status !== "completed");

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);
  const weeklyReports = myReports.filter((r) => new Date(r.date) >= sevenDaysAgo);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="mb-1 text-[23px] font-bold tracking-[-0.02em] text-ink">
            {greeting()}, {session.name.split(" ")[0]}
          </h1>
          <p className="text-[12.5px] text-[#64748b]">
            {open.length} {open.length === 1 ? "task" : "tasks"} open · {completed} completed
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Link
            href="/admin/leave"
            className="inline-flex items-center justify-center rounded-md border border-[#dde3ea] bg-white px-4 py-2.5 text-[12.5px] font-semibold text-ink-soft transition-colors hover:border-primary hover:text-primary"
          >
            Request leave
          </Link>
          <Link
            href="/admin/daily-report"
            className="btn-glass rounded-md px-4.5 py-2.5 text-[12.5px] font-bold shadow-[0_8px_18px_rgba(0,125,204,.22)]"
          >
            Submit daily report
          </Link>
        </div>
      </div>

      {!employeeId && (
        <div className="rounded-[10px] border border-dashed border-slate-line bg-white p-4 text-[13px] text-ink-muted">
          This account isn&apos;t linked to an employee record, so task and report data isn&apos;t
          available. This is expected for the original demo sub-admin account.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            {[
              { label: "Assigned", value: myTasks.length, tone: "text-ink" },
              { label: "Pending", value: pending, tone: "text-warn" },
              { label: "Completed", value: completed, tone: "text-ok" },
            ].map((tile) => (
              <div key={tile.label} className="rounded-[10px] border border-slate-line bg-white p-4">
                <p className="mb-1.5 text-[11.5px] font-medium text-[#64748b]">{tile.label}</p>
                <p className={`font-mono text-[22px] font-bold ${tile.tone}`}>{tile.value}</p>
              </div>
            ))}
          </div>

          <div className="overflow-hidden rounded-[10px] border border-slate-line bg-white">
            <div className="border-b border-slate-line px-4.5 py-3.5">
              <span className="border-b-2 border-accent pb-2.5 text-[12.5px] font-semibold text-ink">
                My tasks
              </span>
            </div>
            {myTasks.length === 0 ? (
              <p className="px-4.5 py-10 text-center text-[13px] text-ink-muted">
                No tasks assigned yet.
              </p>
            ) : (
              myTasks.slice(0, 6).map((task) => {
                const pill = STATUS_PILL[task.status];
                const done = task.status === "completed";
                return (
                  <div
                    key={task.id}
                    className={`flex items-center gap-3.5 border-b border-[#f2f4f7] px-4.5 py-4 last:border-b-0 ${
                      done ? "opacity-60" : ""
                    }`}
                  >
                    <span
                      className={`flex size-4.5 shrink-0 items-center justify-center rounded-[5px] text-[11px] font-bold text-white ${
                        done ? "bg-ok-dot" : "border-[1.5px] border-[#c8d0da]"
                      }`}
                    >
                      {done ? "✓" : ""}
                    </span>
                    <span className="min-w-0 flex-1">
                      <strong
                        className={`block text-[13px] font-semibold text-ink ${done ? "line-through" : ""}`}
                      >
                        {task.title}
                      </strong>
                      <span className="font-mono text-[11.5px] text-[#8a94a6]">
                        DUE {task.dueDate}
                      </span>
                    </span>
                    <span
                      className={`shrink-0 rounded-[5px] px-2.5 py-1 font-mono text-[10.5px] font-semibold ${pill.cls}`}
                    >
                      {pill.label}
                    </span>
                  </div>
                );
              })
            )}
          </div>

          <WeeklyHoursChart reports={[...weeklyReports]} />
        </div>

        <div className="flex flex-col gap-4">
          <div className="rounded-[10px] border border-slate-line bg-white p-4.5">
            <p className="mb-3 text-[14px] font-bold text-ink">Daily report</p>
            <p className="mb-3.5 text-[12px] leading-[1.6] text-ink-muted">
              Log what you closed today, what is blocked, and anything the super admin needs to see.
            </p>
            <Link
              href="/admin/daily-report"
              className="flex items-center justify-center rounded-md border border-[#dde3ea] py-2.5 text-[12.5px] font-semibold text-ink-soft transition-colors hover:border-primary hover:text-primary"
            >
              Open daily report
            </Link>
          </div>

          <div className="rounded-[10px] border border-slate-line bg-white p-4.5">
            <p className="mb-3 text-[14px] font-bold text-ink">My access</p>
            <div className="flex flex-col gap-2.5 text-xs">
              {ACCESS.map((row) => (
                <span
                  key={row.label}
                  className={`flex items-center gap-2.5 ${row.granted ? "text-ink-soft" : "text-[#9aa6b6]"}`}
                >
                  <span
                    className={`flex size-4 shrink-0 items-center justify-center rounded text-[10px] font-bold text-white ${
                      row.granted ? "bg-ok-dot" : "bg-hairline"
                    }`}
                  >
                    {row.granted ? "✓" : ""}
                  </span>
                  {row.label}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
