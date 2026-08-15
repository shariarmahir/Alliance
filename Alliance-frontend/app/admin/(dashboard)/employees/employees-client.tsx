"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/app/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import { AddEmployeeDialog } from "./add-employee-dialog";
import { AssignTaskInline } from "./assign-task-inline";
import { LeaveCalendar } from "../leave/leave-calendar";
import { LeavePendingList } from "../leave/leave-pending-list";
import { LeaveDaysChart } from "../charts/leave-days-chart";
import type { Employee, Task, TaskStatus, LeaveRequest, DailyReport } from "@/app/lib/types";

const DESIGNATION_LABEL: Record<Employee["designation"], string> = {
  "sales-associate": "Sales associate",
  "warehouse-staff": "Warehouse staff",
  "support-agent": "Support agent",
  "catalog-manager": "Catalog manager",
};

const TASK_STATUS_PILL: Record<TaskStatus, { label: string; cls: string }> = {
  pending: { label: "PENDING", cls: "bg-[#f2f4f7] text-ink-muted" },
  "in-progress": { label: "IN PROGRESS", cls: "bg-warn-bg text-warn" },
  completed: { label: "COMPLETED", cls: "bg-ok-bg text-ok" },
};

const TH = "mono-label px-4 py-2.5 text-left text-[10px] tracking-[0.07em] text-[#8a94a6]";
const TD = "border-b border-[#f2f4f7] px-4 py-3";

// "DS TIME" in the design is the average hours logged per daily report — the
// closest real signal we have to the bundle's mock desk-time figure. Green at
// or above a full day, amber below it.
function avgHours(reports: DailyReport[]): { label: string; low: boolean } | null {
  if (reports.length === 0) return null;
  const mean = reports.reduce((s, r) => s + r.hoursWorked, 0) / reports.length;
  const h = Math.floor(mean);
  const m = Math.round((mean - h) * 60);
  return { label: `${h} h ${String(m).padStart(2, "0")} m`, low: mean < 7 };
}

function RosterTab({
  employees,
  tasks,
  reports,
}: {
  employees: Employee[];
  tasks: Task[];
  reports: DailyReport[];
}) {
  const router = useRouter();

  return (
    <div className="space-y-4">
      <div className="overflow-hidden rounded-[10px] border border-slate-line bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-line px-4.5 py-3.5">
          <p className="text-[14px] font-bold text-ink">Sub-admin accounts</p>
          <AddEmployeeDialog onCreated={() => router.refresh()} />
        </div>

        {employees.length === 0 ? (
          <p className="px-4.5 py-10 text-center text-[13px] text-ink-muted">
            No employees yet. Add one to get started.
          </p>
        ) : (
          <div className="scrollbar-slim overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead className="bg-surface">
                <tr>
                  <th className={TH}>ID</th>
                  <th className={TH}>NAME</th>
                  <th className={TH}>DESIGNATION</th>
                  <th className={TH}>OPEN / DONE</th>
                  <th className={TH}>DS TIME</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((e) => {
                  const mine = tasks.filter((t) => t.assigneeEmployeeId === e.id);
                  const open = mine.filter((t) => t.status !== "completed").length;
                  const done = mine.filter((t) => t.status === "completed").length;
                  const ds = avgHours(reports.filter((r) => r.employeeId === e.id));
                  return (
                    <tr key={e.id} className="transition-colors hover:bg-surface">
                      <td className={`${TD} font-mono text-[11.5px] font-semibold text-primary`}>
                        {e.employeeIdNumber}
                      </td>
                      <td className={`${TD} text-ink`}>
                        {e.name}
                        <span className="block font-mono text-[11px] text-[#8a94a6]">{e.email}</span>
                      </td>
                      <td className={`${TD} text-ink-muted`}>{DESIGNATION_LABEL[e.designation]}</td>
                      <td className={`${TD} font-mono text-ink-soft`}>
                        {open} / {done}
                      </td>
                      <td className={`${TD} font-mono ${ds?.low ? "text-warn" : "text-ok"}`}>
                        {ds?.label ?? "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <AssignTaskInline employees={employees} />
    </div>
  );
}

function TasksTab({ tasks, employees }: { tasks: Task[]; employees: Employee[] }) {
  const [employeeFilter, setEmployeeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  function employeeName(id: string): string {
    return employees.find((e) => e.id === id)?.name ?? "Unknown";
  }

  const sorted = useMemo(() => {
    return tasks
      .filter((t) => {
        if (employeeFilter !== "all" && t.assigneeEmployeeId !== employeeFilter) return false;
        if (statusFilter !== "all" && t.status !== statusFilter) return false;
        return true;
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }, [tasks, employeeFilter, statusFilter]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Select value={employeeFilter} onValueChange={(v) => setEmployeeFilter(v ?? "all")}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Employee" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All employees</SelectItem>
            {employees.map((e) => (
              <SelectItem key={e.id} value={e.id}>
                {e.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "all")}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
            <SelectItem value="in-progress">In progress</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {sorted.length === 0 ? (
        <div className="rounded-[10px] border border-dashed border-slate-line bg-white p-10 text-center text-[13px] text-ink-muted">
          No tasks in this view yet.
        </div>
      ) : (
        <div className="scrollbar-slim overflow-x-auto rounded-[10px] border border-slate-line bg-white">
          <table className="w-full text-[12.5px]">
            <thead className="bg-surface">
              <tr>
                <th className={TH}>TASK</th>
                <th className={TH}>ASSIGNEE</th>
                <th className={TH}>DUE</th>
                <th className={TH}>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((t) => (
                <tr key={t.id} className="transition-colors hover:bg-surface">
                  <td className={`${TD} font-semibold text-ink`}>{t.title}</td>
                  <td className={`${TD} text-ink-muted`}>{employeeName(t.assigneeEmployeeId)}</td>
                  <td className={`${TD} font-mono text-ink-soft`}>{t.dueDate}</td>
                  <td className={TD}>
                    <span
                      className={`rounded-[5px] px-2.5 py-1 font-mono text-[10.5px] font-semibold ${TASK_STATUS_PILL[t.status].cls}`}
                    >
                      {TASK_STATUS_PILL[t.status].label}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function ReportsTab({
  reports,
  requests,
  employees,
}: {
  reports: DailyReport[];
  requests: LeaveRequest[];
  employees: Employee[];
}) {
  function employeeName(id: string): string {
    return employees.find((e) => e.id === id)?.name ?? "Unknown";
  }

  const sorted = [...reports].sort(
    (a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
  );

  return (
    <div className="space-y-4">
      <LeaveDaysChart requests={requests} employees={employees} />
      {sorted.length === 0 ? (
        <div className="rounded-[10px] border border-dashed border-slate-line bg-white p-10 text-center text-[13px] text-ink-muted">
          No daily reports submitted yet.
        </div>
      ) : (
        <div className="scrollbar-slim overflow-x-auto rounded-[10px] border border-slate-line bg-white">
          <table className="w-full text-[12.5px]">
            <thead className="bg-surface">
              <tr>
                <th className={TH}>DATE</th>
                <th className={TH}>EMPLOYEE</th>
                <th className={TH}>HOURS</th>
                <th className={TH}>SUMMARY</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((r) => (
                <tr key={r.id} className="transition-colors hover:bg-surface">
                  <td className={`${TD} font-mono text-ink-soft`}>{r.date}</td>
                  <td className={`${TD} font-semibold text-ink`}>{employeeName(r.employeeId)}</td>
                  <td className={`${TD} font-mono text-ink-soft`}>{r.hoursWorked}h</td>
                  <td className={`${TD} max-w-md truncate text-ink-muted`}>{r.summary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function EmployeesClient({
  employees,
  tasks,
  leaveRequests,
  dailyReports,
  initialTab,
}: {
  employees: Employee[];
  tasks: Task[];
  leaveRequests: LeaveRequest[];
  dailyReports: DailyReport[];
  initialTab: string;
}) {
  const [tab, setTab] = useState(initialTab);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="mb-1 text-[23px] font-bold tracking-[-0.02em] text-ink">Employees &amp; leave</h1>
        <p className="text-[13px] text-ink-muted">
          Create sub-admin accounts, assign the working structure, and approve leave against the roster.
        </p>
      </div>

      {/* Design bundle screen 2c: roster + assignment on the left, leave calendar
          and request queue always visible on the right. Tasks and reports stay
          as tabs on the left column — they are deeper views, not the daily one. */}
      <div className="grid gap-4.5 xl:grid-cols-[1fr_320px]">
        <div className="min-w-0">
          <Tabs value={tab} onValueChange={(v) => setTab(v ?? "roster")}>
            <TabsList>
              <TabsTrigger value="roster">Roster</TabsTrigger>
              <TabsTrigger value="tasks">Tasks</TabsTrigger>
              <TabsTrigger value="reports">Reports</TabsTrigger>
            </TabsList>
            <TabsContent value="roster" className="mt-4">
              <RosterTab employees={employees} tasks={tasks} reports={dailyReports} />
            </TabsContent>
            <TabsContent value="tasks" className="mt-4">
              <TasksTab tasks={tasks} employees={employees} />
            </TabsContent>
            <TabsContent value="reports" className="mt-4">
              <ReportsTab reports={dailyReports} requests={leaveRequests} employees={employees} />
            </TabsContent>
          </Tabs>
        </div>

        <div className="flex flex-col gap-4">
          <LeaveCalendar requests={leaveRequests} employees={employees} />
          <LeavePendingList requests={leaveRequests} employees={employees} />
        </div>
      </div>
    </div>
  );
}
