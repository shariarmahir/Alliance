"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Card } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { cn } from "@/app/lib/utils";
import type { Employee, LeaveRequest } from "@/app/lib/types";

const EMPLOYEE_COLORS = [
  "bg-blue-500/15 text-blue-700 dark:text-blue-300",
  "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  "bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300",
  "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300",
  "bg-orange-500/15 text-orange-700 dark:text-orange-300",
];

function colorForEmployee(employeeId: string, employees: Employee[]): string {
  const idx = employees.findIndex((e) => e.id === employeeId);
  return EMPLOYEE_COLORS[idx >= 0 ? idx % EMPLOYEE_COLORS.length : 0];
}

function toIso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Month-grid calendar showing approved leave spans per employee, color-coded
// by employee. Read-only view — approve/reject actions live in the list
// below it, matching the spec's "confirm leave or cancel leave with a
// calendar" requirement.
export function LeaveCalendar({ requests, employees }: { requests: LeaveRequest[]; employees: Employee[] }) {
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const approved = useMemo(() => requests.filter((r) => r.status === "approved"), [requests]);

  const year = cursor.getFullYear();
  const month = cursor.getMonth();
  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const cells: (Date | null)[] = [
    ...Array.from({ length: startOffset }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => new Date(year, month, i + 1)),
  ];

  function employeeName(id: string): string {
    return employees.find((e) => e.id === id)?.name ?? "Unknown";
  }

  function leaveOnDay(date: Date): LeaveRequest[] {
    const iso = toIso(date);
    return approved.filter((r) => iso >= r.startDate && iso <= r.endDate);
  }

  return (
    <Card className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-heading text-base font-medium text-foreground">
          {cursor.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
        </h2>
        <div className="flex items-center gap-1">
          <Button type="button" variant="outline" size="icon-sm" onClick={() => setCursor(new Date(year, month - 1, 1))}>
            <ChevronLeft className="size-4" />
          </Button>
          <Button type="button" variant="outline" size="icon-sm" onClick={() => setCursor(new Date(year, month + 1, 1))}>
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1">
        {cells.map((date, idx) => {
          if (!date) return <div key={idx} className="min-h-20 rounded-lg" />;
          const dayLeave = leaveOnDay(date);
          return (
            <div key={idx} className="min-h-20 rounded-lg border border-border/60 p-1 text-left">
              <p className="text-xs text-muted-foreground">{date.getDate()}</p>
              <div className="mt-1 space-y-0.5">
                {dayLeave.slice(0, 2).map((r) => (
                  <div
                    key={r.id}
                    title={employeeName(r.employeeId)}
                    className={cn("truncate rounded px-1 py-0.5 text-[10px] font-medium", colorForEmployee(r.employeeId, employees))}
                  >
                    {employeeName(r.employeeId)}
                  </div>
                ))}
                {dayLeave.length > 2 && <p className="text-[10px] text-muted-foreground">+{dayLeave.length - 2} more</p>}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
