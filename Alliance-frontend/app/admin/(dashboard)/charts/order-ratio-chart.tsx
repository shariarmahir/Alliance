"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { orderCountWeekly, orderCountMonthly, orderCountYearly } from "@/app/lib/mock-analytics";
import { Card, CardHeader, CardTitle, CardContent, CardAction } from "@/app/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/app/components/ui/chart";

type Range = "weekly" | "monthly" | "yearly";

const DATA: Record<Range, typeof orderCountWeekly> = {
  weekly: orderCountWeekly,
  monthly: orderCountMonthly,
  yearly: orderCountYearly,
};

const chartConfig = {
  value: {
    label: "Orders",
    color: "var(--color-accent)",
  },
} satisfies ChartConfig;

export function OrderRatioChart() {
  const [range, setRange] = useState<Range>("weekly");
  const data = DATA[range];

  return (
    <Card className="p-6">
      <CardHeader className="px-0">
        <CardTitle className="text-base">Order Ratio</CardTitle>
        <CardAction>
          <Tabs value={range} onValueChange={(v) => setRange(v as Range)}>
            <TabsList>
              <TabsTrigger value="weekly">Weekly</TabsTrigger>
              <TabsTrigger value="monthly">Monthly</TabsTrigger>
              <TabsTrigger value="yearly">Yearly</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardAction>
      </CardHeader>
      <CardContent className="px-0">
        <ChartContainer config={chartConfig} className="aspect-auto h-64 w-full">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }} />
            <YAxis tickLine={false} axisLine={false} width={32} tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }} />
            <ChartTooltip cursor={{ fill: "var(--color-accent)", fillOpacity: 0.08 }} content={<ChartTooltipContent />} />
            <Bar
              dataKey="value"
              fill="var(--color-accent)"
              radius={[6, 6, 0, 0]}
              maxBarSize={40}
              isAnimationActive
              animationDuration={700}
              animationEasing="ease-out"
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  );
}
