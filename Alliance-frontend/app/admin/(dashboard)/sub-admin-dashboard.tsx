import Link from "next/link";
import { readTasks, readDailyReports } from "@/app/lib/admin-employees";
import type { AdminSession } from "@/app/lib/types";
import { WeeklyHoursChart } from "./charts/weekly-hours-chart";
import { MyTasksList } from "./my-tasks-list";
import { DailyReportInline } from "./daily-report-inline";

// Sub-admin's personal desk, rendered at the same /admin path as the
// super-admin Overview (role-branched in page.tsx). Shows only this
// employee's own tasks and reports — filtered by session.employeeId.
// Handles the no-employeeId case (the original hardcoded subadmin@gmail.com
// mock account) gracefully with empty states, not crashes.

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

  const todayIso = new Date().toISOString().slice(0, 10);
  const dueToday = open.filter((t) => t.dueDate <= todayIso).length;

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);
  const weeklyReports = myReports.filter((r) => new Date(r.date) >= sevenDaysAgo);
  const completedThisWeek = myTasks.filter(
    (t) => t.status === "completed" && new Date(t.createdAt) >= sevenDaysAgo
  ).length;
  const lastHours = myReports[myReports.length - 1]?.hoursWorked ?? 8;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="mb-1 text-[23px] font-bold tracking-[-0.02em] text-ink">
            {greeting()}, {session.name.split(" ")[0]}
          </h1>
          <p className="text-[12.5px] text-[#64748b]">
            {open.length} {open.length === 1 ? "task" : "tasks"} open · {dueToday} due today ·{" "}
            {completed} completed
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
              { label: "Completed this week", value: completedThisWeek, tone: "text-ok" },
            ].map((tile) => (
              <div key={tile.label} className="rounded-[10px] border border-slate-line bg-white p-4">
                <p className="mb-1.5 text-[11.5px] font-medium text-[#64748b]">{tile.label}</p>
                <p className={`font-mono text-[22px] font-bold ${tile.tone}`}>{tile.value}</p>
              </div>
            ))}
          </div>

          <MyTasksList tasks={myTasks} />

          <WeeklyHoursChart reports={[...weeklyReports]} />
        </div>

        <div className="flex flex-col gap-4">
          {employeeId ? (
            <DailyReportInline defaultHours={lastHours} />
          ) : (
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
          )}

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
