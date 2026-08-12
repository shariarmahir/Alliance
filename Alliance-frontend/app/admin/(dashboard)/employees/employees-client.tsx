"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/app/components/ui/tabs";
import { Badge } from "@/app/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import { AddEmployeeDialog } from "./add-employee-dialog";
import { AssignTaskDialog } from "./assign-task-dialog";
import { LeaveCalendar } from "../leave/leave-calendar";
import { LeavePendingList } from "../leave/leave-pending-list";
import { LeaveDaysChart } from "../charts/leave-days-chart";
import type { Employee, Task, TaskStatus, LeaveRequest, DailyReport } from "@/app/lib/types";

const DESIGNATION_LABEL: Record<Employee["designation"], string> = {
  "sales-associate": "Sales Associate",
  "warehouse-staff": "Warehouse Staff",
  "support-agent": "Support Agent",
  "catalog-manager": "Catalog Manager",
};

const TASK_STATUS_BADGE: Record<TaskStatus, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  pending: { label: "Pending", variant: "default" },
  "in-progress": { label: "In Progress", variant: "secondary" },
  completed: { label: "Completed", variant: "secondary" },
};

function RosterTab({ employees }: { employees: Employee[] }) {
  const router = useRouter();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{employees.length} employee{employees.length === 1 ? "" : "s"}</p>
        <AddEmployeeDialog onCreated={() => router.refresh()} />
      </div>
      {employees.length === 0 ? (
        <div className="rounded-xl border border-dashed border-foreground/15 p-10 text-center text-sm text-muted-foreground">
          No employees yet. Add one to get started.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Employee ID</th>
                <th className="px-4 py-3 font-medium">Designation</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Added</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {employees.map((e) => (
                <tr key={e.id} className="bg-card transition-colors duration-200 hover:bg-muted/50">
                  <td className="px-4 py-3 font-medium text-foreground">{e.name}</td>
                  <td className="px-4 py-3 text-muted-foreground">{e.employeeIdNumber}</td>
                  <td className="px-4 py-3 text-muted-foreground">{DESIGNATION_LABEL[e.designation]}</td>
                  <td className="px-4 py-3 text-muted-foreground">{e.email}</td>
                  <td className="px-4 py-3 text-muted-foreground">{new Date(e.createdAt).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TasksTab({ tasks, employees }: { tasks: Task[]; employees: Employee[] }) {
  const router = useRouter();
  const [employeeFilter, setEmployeeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  function employeeName(id: string): string {
    return employees.find((e) => e.id === id)?.name ?? "Unknown";
  }

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (employeeFilter !== "all" && t.assigneeEmployeeId !== employeeFilter) return false;
      if (statusFilter !== "all" && t.status !== statusFilter) return false;
      return true;
    });
  }, [tasks, employeeFilter, statusFilter]);

  const sorted = [...filtered].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Select value={employeeFilter} onValueChange={(v) => setEmployeeFilter(v ?? "all")}>
            <SelectTrigger className="w-44"><SelectValue placeholder="Employee" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Employees</SelectItem>
              {employees.map((e) => (
                <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v ?? "all")}>
            <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="in-progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <AssignTaskDialog employees={employees} onCreated={() => router.refresh()} />
      </div>
      {sorted.length === 0 ? (
        <div className="rounded-xl border border-dashed border-foreground/15 p-10 text-center text-sm text-muted-foreground">
          No tasks in this view yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Title</th>
                <th className="px-4 py-3 font-medium">Assignee</th>
                <th className="px-4 py-3 font-medium">Due Date</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sorted.map((t) => (
                <tr key={t.id} className="bg-card transition-colors duration-200 hover:bg-muted/50">
                  <td className="px-4 py-3 font-medium text-foreground">{t.title}</td>
                  <td className="px-4 py-3 text-muted-foreground">{employeeName(t.assigneeEmployeeId)}</td>
                  <td className="px-4 py-3 text-muted-foreground">{new Date(t.dueDate).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <Badge variant={TASK_STATUS_BADGE[t.status].variant} className="transition-colors duration-200">{TASK_STATUS_BADGE[t.status].label}</Badge>
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

function ReportsTab({ reports, requests, employees }: { reports: DailyReport[]; requests: LeaveRequest[]; employees: Employee[] }) {
  function employeeName(id: string): string {
    return employees.find((e) => e.id === id)?.name ?? "Unknown";
  }

  const sorted = [...reports].sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime());

  return (
    <div className="space-y-6">
      <LeaveDaysChart requests={requests} employees={employees} />
      <div className="space-y-3">
        <h2 className="font-heading text-base font-medium text-foreground">Recent Daily Reports</h2>
        {sorted.length === 0 ? (
          <div className="rounded-xl border border-dashed border-foreground/15 p-10 text-center text-sm text-muted-foreground">
            No daily reports submitted yet.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Employee</th>
                  <th className="px-4 py-3 font-medium">Hours</th>
                  <th className="px-4 py-3 font-medium">Summary</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {sorted.map((r) => (
                  <tr key={r.id} className="bg-card transition-colors duration-200 hover:bg-muted/50">
                    <td className="px-4 py-3 text-muted-foreground">{new Date(r.date).toLocaleDateString()}</td>
                    <td className="px-4 py-3 font-medium text-foreground">{employeeName(r.employeeId)}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.hoursWorked}h</td>
                    <td className="px-4 py-3 max-w-md truncate text-muted-foreground">{r.summary}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
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
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Employees</h1>
        <p className="mt-1 text-sm text-muted-foreground">Manage the employee roster, tasks, leave, and daily reports.</p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v ?? "roster")}>
        <TabsList>
          <TabsTrigger value="roster">Roster</TabsTrigger>
          <TabsTrigger value="tasks">Tasks</TabsTrigger>
          <TabsTrigger value="leave">Leave Requests</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>
        <TabsContent value="roster" className="mt-4">
          <RosterTab employees={employees} />
        </TabsContent>
        <TabsContent value="tasks" className="mt-4">
          <TasksTab tasks={tasks} employees={employees} />
        </TabsContent>
        <TabsContent value="leave" className="mt-4 space-y-6">
          <LeaveCalendar requests={leaveRequests} employees={employees} />
          <LeavePendingList requests={leaveRequests} employees={employees} />
        </TabsContent>
        <TabsContent value="reports" className="mt-4">
          <ReportsTab reports={dailyReports} requests={leaveRequests} employees={employees} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
