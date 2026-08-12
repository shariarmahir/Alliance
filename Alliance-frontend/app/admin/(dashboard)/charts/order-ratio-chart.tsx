"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { orderRatio } from "@/app/lib/mock-analytics";
import { Card, CardHeader, CardTitle, CardContent } from "@/app/components/ui/card";

const STATUS_META: Record<string, { label: string; color: string }> = {
  confirmed: { label: "Confirmed", color: "var(--color-chart-3)" },
  pending: { label: "Pending", color: "var(--color-chart-1)" },
  cancelled: { label: "Cancelled", color: "var(--color-chart-5)" },
};

export function OrderRatioChart() {
  const total = orderRatio.reduce((sum, s) => sum + s.count, 0);

  return (
    <Card className="p-6">
      <CardHeader className="px-0">
        <CardTitle className="text-base">Order Status Ratio</CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <div className="relative h-64 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={orderRatio}
                dataKey="count"
                nameKey="status"
                innerRadius={64}
                outerRadius={92}
                paddingAngle={3}
                strokeWidth={2}
                stroke="var(--color-card)"
                isAnimationActive
                animationDuration={700}
                animationEasing="ease-out"
              >
                {orderRatio.map((slice) => (
                  <Cell key={slice.status} fill={STATUS_META[slice.status].color} />
                ))}
              </Pie>
              <Tooltip
                formatter={(value, _name, item) => [
                  `${value} orders`,
                  STATUS_META[item.payload.status as string].label,
                ]}
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid var(--color-border)",
                  background: "var(--color-popover)",
                  fontSize: 13,
                }}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-2xl font-bold text-foreground">{total}</span>
            <span className="text-xs text-muted-foreground">Total Orders</span>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap justify-center gap-4">
          {orderRatio.map((slice) => (
            <div key={slice.status} className="flex items-center gap-1.5 text-sm">
              <span
                className="size-2.5 rounded-full"
                style={{ backgroundColor: STATUS_META[slice.status].color }}
              />
              <span className="text-muted-foreground">{STATUS_META[slice.status].label}</span>
              <span className="font-semibold text-foreground">{slice.count}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
