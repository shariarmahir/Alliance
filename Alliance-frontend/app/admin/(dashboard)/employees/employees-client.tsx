"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { EditEmployeeDialog } from "./edit-employee-dialog";
import { Button } from "@/app/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/app/components/ui/dialog";
import { apiFetch, ApiError } from "@/app/lib/api-browser";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/app/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import { AddEmployeeDialog } from "./add-employee-dialog";
import { AssignTaskInline } from "./assign-task-inline";
import { LeaveCalendar } from "../leave/leave-calendar";
import { LeavePendingList } from "../leave/leave-pending-list";
import { LeaveDaysChart } from "../charts/leave-days-chart";
import type { SafeEmployee, AccessArea, Task, TaskStatus, LeaveRequest, DailyReport } from "@/app/lib/types";

const DESIGNATION_LABEL: Record<SafeEmployee["designation"], string> = {
  "sales-associate": "Sales associate",
  "warehouse-staff": "Warehouse staff",
  "support-agent": "Support agent",
  "catalog-manager": "Catalog manager",
  other: "Other",
};

function designationLabel(e: SafeEmployee): string {
  if (e.designation === "other") return e.customDesignation || "Other";
  return DESIGNATION_LABEL[e.designation];
}

// Exhaustive by type: a new AccessArea that isn't labelled here fails the
// build rather than rendering an "undefined" pill in the roster.
const ACCESS_LABEL: Record<AccessArea, string> = {
  quotations: "Quotations",
  orders: "Orders",
  invoices: "Invoices",
  challans: "Challans",
  emails: "Emails",
  "contact-requests": "Contact",
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
  employees: SafeEmployee[];
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
            <table className="w-full min-w-220 text-[12.5px]">
              <thead className="bg-surface">
                <tr>
                  <th className={TH}>ID</th>
                  <th className={TH}>NAME</th>
                  <th className={TH}>DESIGNATION</th>
                  <th className={TH}>ACCESS</th>
                  <th className={TH}>OPEN / DONE</th>
                  <th className={TH}>DS TIME</th>
                  <th className={TH}>
                    <span className="sr-only">Actions</span>
                  </th>
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
                      <td className={`${TD} text-ink-muted`}>{designationLabel(e)}</td>
                      <td className={TD}>
                        {e.accessOptions && e.accessOptions.length > 0 ? (
                          <div className="flex flex-wrap gap-1">
                            {e.accessOptions.map((a) => (
                              <span
                                key={a}
                                className="rounded-[4px] bg-tint px-1.5 py-0.5 font-mono text-[10px] font-semibold text-[#00618f]"
                              >
                                {ACCESS_LABEL[a]}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-[#c8d0da]">—</span>
                        )}
                      </td>
                      <td className={`${TD} font-mono text-ink-soft`}>
                        {open} / {done}
                      </td>
                      <td className={`${TD} font-mono ${ds?.low ? "text-warn" : "text-ok"}`}>
                        {ds?.label ?? "—"}
                      </td>
                      <td className={TD}>
                        <div className="flex items-center gap-1.5">
                          <EditEmployeeDialog
                            employee={e}
                            onSaved={() => router.refresh()}
                          />
                          <DeleteEmployeeButton
                            employee={e}
                            openTasks={open}
                            onDeleted={() => router.refresh()}
                          />
                        </div>
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

function DeleteEmployeeButton({
  employee,
  openTasks,
  onDeleted,
}: {
  employee: SafeEmployee;
  openTasks: number;
  onDeleted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    try {
      await apiFetch(`/api/admin/employees/${encodeURIComponent(employee.id)}`, {
        method: "DELETE",
      });
      toast.success(`${employee.name} removed.`);
      setOpen(false);
      onDeleted();
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Could not remove this employee."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        aria-label={`Delete ${employee.name}`}
        onClick={() => setOpen(true)}
        className="flex size-7 items-center justify-center rounded-md border border-[#f0d0d0] bg-white text-[#c22] transition-colors hover:border-[#c22] hover:bg-[#c22] hover:text-white"
      >
        <Trash2 className="size-3.5" />
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove {employee.name}?</DialogTitle>
            <DialogDescription>
              They lose access immediately and cannot sign in again. Their
              tasks, leave requests and daily reports are kept, but stop being
              attributed to anyone — the records remain, the name does not.
              {openTasks > 0 && (
                <>
                  {" "}
                  <strong className="text-ink">
                    {openTasks} open task{openTasks === 1 ? "" : "s"}
                  </strong>{" "}
                  will be left unassigned; reassign {openTasks === 1 ? "it" : "them"} first
                  if someone else should pick {openTasks === 1 ? "it" : "them"} up.
                </>
              )}{" "}
              This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={busy}
            >
              Cancel
            </Button>
            <Button type="button" variant="destructive" onClick={remove} disabled={busy}>
              {busy ? "Removing..." : "Remove employee"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function TasksTab({ tasks, employees }: { tasks: Task[]; employees: SafeEmployee[] }) {
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
          <table className="w-full min-w-160 text-[12.5px]">
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
  employees: SafeEmployee[];
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
          <table className="w-full min-w-160 text-[12.5px]">
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
  employees: SafeEmployee[];
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
