"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { trafficSources } from "@/app/lib/mock-analytics";
import { Card, CardHeader, CardTitle, CardContent } from "@/app/components/ui/card";

export function TrafficChart() {
  return (
    <Card className="p-6">
      <CardHeader className="px-0">
        <CardTitle className="text-base">Order Source Performance</CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={trafficSources} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
              <Tooltip
                formatter={(value) => [`${value} orders`, ""]}
                cursor={{ fill: "var(--color-muted)" }}
                contentStyle={{
                  borderRadius: 8,
                  border: "1px solid var(--color-border)",
                  background: "var(--color-popover)",
                  fontSize: 13,
                }}
              />
              <Bar dataKey="orders" fill="var(--color-chart-3)" radius={[4, 4, 0, 0]} maxBarSize={44} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
