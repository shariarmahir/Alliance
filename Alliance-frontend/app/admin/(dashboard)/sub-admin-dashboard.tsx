import Link from "next/link";
import { ListChecks, CalendarDays, NotebookPen, Clock, CircleDot, CheckCircle2 } from "lucide-react";
import { readTasks, readDailyReports } from "@/app/lib/admin-employees";
import { Card } from "@/app/components/ui/card";
import type { AdminSession } from "@/app/lib/types";
import { WeeklyHoursChart } from "./charts/weekly-hours-chart";

// Sub-admin's personal dashboard, rendered at the same /admin path as the
// super-admin Overview (role-branched in page.tsx). Shows only this
// employee's own tasks and daily reports — filtered by session.employeeId.
// Handles the no-employeeId case (the original hardcoded subadmin@gmail.com
// mock account) gracefully with empty states, not crashes.
export async function SubAdminDashboard({ session }: { session: AdminSession }) {
  const employeeId = session.employeeId;

  const [allTasks, allReports] = await Promise.all([readTasks(), readDailyReports()]);
  const myTasks = employeeId ? allTasks.filter((t) => t.assigneeEmployeeId === employeeId) : [];
  const myReports = employeeId ? allReports.filter((r) => r.employeeId === employeeId) : [];

  const pending = myTasks.filter((t) => t.status === "pending").length;
  const inProgress = myTasks.filter((t) => t.status === "in-progress").length;
  const completed = myTasks.filter((t) => t.status === "completed").length;

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
  sevenDaysAgo.setHours(0, 0, 0, 0);
  const weeklyReports = myReports.filter((r) => new Date(r.date) >= sevenDaysAgo);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Welcome, {session.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">Your tasks, hours, and quick links at a glance.</p>
      </div>

      {!employeeId && (
        <div className="rounded-xl border border-dashed border-foreground/15 p-4 text-sm text-muted-foreground">
          This account isn&apos;t linked to an employee record, so task and report data isn&apos;t available. This is
          expected for the original demo sub-admin account.
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <TaskStatTile label="Pending" value={pending} icon={Clock} tone="amber" />
        <TaskStatTile label="In Progress" value={inProgress} icon={CircleDot} tone="blue" />
        <TaskStatTile label="Completed" value={completed} icon={CheckCircle2} tone="emerald" />
      </div>

      <WeeklyHoursChart reports={[...weeklyReports]} />

      <div className="grid gap-4 sm:grid-cols-3">
        <QuickLinkCard href="/admin/tasks" icon={ListChecks} title="Task Desk" description="View and update your assigned tasks." />
        <QuickLinkCard href="/admin/leave" icon={CalendarDays} title="Leave Requests" description="Request time off and track approvals." />
        <QuickLinkCard
          href="/admin/daily-report"
          icon={NotebookPen}
          title="Daily Report"
          description="Submit today's work summary and hours."
        />
      </div>
    </div>
  );
}

function TaskStatTile({
  label,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  value: number;
  icon: typeof Clock;
  tone: "amber" | "blue" | "emerald";
}) {
  const toneClasses = {
    amber: "bg-amber-500/10 text-amber-600",
    blue: "bg-blue-500/10 text-blue-600",
    emerald: "bg-emerald-500/10 text-emerald-600",
  }[tone];

  return (
    <Card className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1.5 text-2xl font-bold tracking-tight text-foreground">{value}</p>
        </div>
        <div className={`flex size-10 items-center justify-center rounded-xl ${toneClasses}`}>
          <Icon className="size-5" />
        </div>
      </div>
    </Card>
  );
}

function QuickLinkCard({
  href,
  icon: Icon,
  title,
  description,
}: {
  href: string;
  icon: typeof ListChecks;
  title: string;
  description: string;
}) {
  return (
    <Link href={href}>
      <Card className="p-5 transition-colors hover:bg-muted/50">
        <div className="flex size-10 items-center justify-center rounded-xl bg-primary/10">
          <Icon className="size-5 text-primary" />
        </div>
        <p className="mt-3 font-medium text-foreground">{title}</p>
        <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      </Card>
    </Link>
  );
}
