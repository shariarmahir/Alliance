"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/app/components/ui/card";
import type { SafeEmployee, LeaveRequest } from "@/app/lib/types";

function countLeaveDaysThisMonth(requests: LeaveRequest[], employeeId: string): number {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  let days = 0;
  for (const r of requests) {
    if (r.employeeId !== employeeId || r.status !== "approved") continue;
    const start = new Date(r.startDate);
    const end = new Date(r.endDate);
    const from = start < monthStart ? monthStart : start;
    const to = end > monthEnd ? monthEnd : end;
    if (from > to) continue;
    days += Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  }
  return days;
}

// Per-employee monthly approved-leave-days bar chart, one bar per employee.
export function LeaveDaysChart({ requests, employees }: { requests: LeaveRequest[]; employees: SafeEmployee[] }) {
  const data = employees.map((e) => ({
    name: e.name,
    days: countLeaveDaysThisMonth(requests, e.id),
  }));

  return (
    <Card className="p-6">
      <CardHeader className="px-0">
        <CardTitle className="text-base">Leave Days This Month</CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        {data.length === 0 ? (
          <div className="flex h-64 items-center justify-center text-[13px] text-ink-muted">No employees yet.</div>
        ) : (
          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="name" tickLine={false} axisLine={false} tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }} />
                <YAxis
                  allowDecimals={false}
                  tickLine={false}
                  axisLine={false}
                  width={32}
                  tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
                />
                <Tooltip
                  cursor={{ fill: "var(--color-muted)" }}
                  contentStyle={{
                    borderRadius: 8,
                    border: "1px solid var(--color-border)",
                    background: "var(--color-popover)",
                    fontSize: 13,
                  }}
                />
                <Bar
                  dataKey="days"
                  fill="var(--color-chart-4)"
                  radius={[4, 4, 0, 0]}
                  isAnimationActive
                  animationDuration={700}
                  animationEasing="ease-out"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
