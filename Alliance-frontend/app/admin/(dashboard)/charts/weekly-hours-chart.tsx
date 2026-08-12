"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardHeader, CardTitle, CardContent } from "@/app/components/ui/card";
import type { DailyReport } from "@/app/lib/types";

// Weekly work-hours bar chart, derived from the employee's own DailyReport
// entries over the last 7 days. Days with no submission show 0 hours.
function buildLastSevenDays(reports: DailyReport[]): { label: string; hours: number }[] {
  const byDate = new Map<string, number>();
  for (const r of reports) {
    byDate.set(r.date, (byDate.get(r.date) ?? 0) + r.hoursWorked);
  }

  const days: { label: string; hours: number }[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = 6; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const iso = d.toISOString().slice(0, 10);
    days.push({ label: d.toLocaleDateString(undefined, { weekday: "short" }), hours: byDate.get(iso) ?? 0 });
  }
  return days;
}

function HoursTooltip({ active, payload }: { active?: boolean; payload?: { value: number; payload: { label: string } }[] }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-sm shadow-md">
      <p className="font-medium text-foreground">{payload[0].payload.label}</p>
      <p className="text-primary">{payload[0].value}h</p>
    </div>
  );
}

export function WeeklyHoursChart({ reports }: { reports: DailyReport[] }) {
  const data = buildLastSevenDays(reports);

  return (
    <Card className="p-6">
      <CardHeader className="px-0">
        <CardTitle className="text-base">Hours Worked — Last 7 Days</CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }} />
              <YAxis tickLine={false} axisLine={false} width={32} tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }} />
              <Tooltip content={<HoursTooltip />} cursor={{ fill: "var(--color-muted)" }} />
              <Bar
                dataKey="hours"
                fill="var(--color-chart-1)"
                radius={[4, 4, 0, 0]}
                isAnimationActive
                animationDuration={700}
                animationEasing="ease-out"
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
