"use client";

import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Card, CardHeader, CardTitle, CardContent, CardAction } from "@/app/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import type { Task } from "@/app/lib/types";

type Range = "weekly" | "monthly";

function isCompletedWithin(task: Task, days: number): boolean {
  if (task.status !== "completed") return false;
  const created = new Date(task.createdAt);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return created >= cutoff;
}

// Weekly (last 7 days) and monthly (last 30 days) task-completion graph for
// an employee's own tasks — grouped by day-of-week (weekly) or week-of-month
// (monthly) buckets, counting tasks created in that window and now completed.
function buildBuckets(tasks: Task[], range: Range): { label: string; completed: number }[] {
  const days = range === "weekly" ? 7 : 30;
  const bucketCount = range === "weekly" ? 7 : 5;
  const bucketSizeDays = days / bucketCount;

  const buckets = Array.from({ length: bucketCount }, (_, i) => ({
    label: range === "weekly" ? `Day ${i + 1}` : `Week ${i + 1}`,
    completed: 0,
  }));

  const now = new Date();
  const relevant = tasks.filter((t) => isCompletedWithin(t, days));
  for (const task of relevant) {
    const created = new Date(task.createdAt);
    const ageDays = (now.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
    const bucketIndex = Math.min(bucketCount - 1, Math.max(0, Math.floor((days - ageDays) / bucketSizeDays)));
    buckets[bucketIndex].completed += 1;
  }
  return buckets;
}

export function TaskCompletionChart({ tasks }: { tasks: Task[] }) {
  const [range, setRange] = useState<Range>("weekly");
  const data = buildBuckets(tasks, range);

  return (
    <Card className="p-6">
      <CardHeader className="px-0">
        <CardTitle className="text-base">Task Completion</CardTitle>
        <CardAction>
          <Tabs value={range} onValueChange={(v) => setRange(v as Range)}>
            <TabsList>
              <TabsTrigger value="weekly">Weekly</TabsTrigger>
              <TabsTrigger value="monthly">Monthly</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardAction>
      </CardHeader>
      <CardContent className="px-0">
        <div className="h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }} />
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
                dataKey="completed"
                fill="var(--color-chart-2)"
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
