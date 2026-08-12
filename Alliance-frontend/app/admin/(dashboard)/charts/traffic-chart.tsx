"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { trafficSources } from "@/app/lib/mock-analytics";
import { Card, CardHeader, CardTitle, CardContent } from "@/app/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/app/components/ui/chart";

const chartConfig = {
  orders: {
    label: "Orders",
    color: "var(--color-primary)",
  },
} satisfies ChartConfig;

export function TrafficChart() {
  return (
    <Card className="p-6">
      <CardHeader className="px-0">
        <CardTitle className="text-base">Order Source Performance</CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <ChartContainer config={chartConfig} className="aspect-auto h-72 w-full">
          <BarChart data={trafficSources} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="trafficFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={1} />
                <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0.55} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
            <XAxis
              dataKey="source"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--color-muted-foreground)", fontSize: 11 }}
              interval={0}
              angle={-15}
              textAnchor="end"
              height={50}
            />
            <YAxis tickLine={false} axisLine={false} width={32} tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }} />
            <ChartTooltip
              cursor={{ fill: "var(--color-primary)", fillOpacity: 0.08 }}
              content={<ChartTooltipContent formatter={(value) => [`${value} orders`, ""]} />}
            />
            <Bar
              dataKey="orders"
              fill="url(#trafficFill)"
              stroke="var(--color-primary)"
              strokeWidth={1}
              radius={[6, 6, 0, 0]}
              maxBarSize={44}
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
