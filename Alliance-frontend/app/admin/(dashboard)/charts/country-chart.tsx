"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LabelList } from "recharts";
import { clientsByCountry } from "@/app/lib/mock-analytics";
import { Card, CardHeader, CardTitle, CardContent } from "@/app/components/ui/card";

export function CountryChart() {
  const data = [...clientsByCountry].sort((a, b) => b.orders - a.orders);

  return (
    <Card className="p-6">
      <CardHeader className="px-0">
        <CardTitle className="text-base">Clients by Country</CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 0, bottom: 0 }}>
              <XAxis type="number" hide />
              <YAxis
                type="category"
                dataKey="country"
                tickLine={false}
                axisLine={false}
                width={140}
                tick={{ fill: "var(--color-muted-foreground)", fontSize: 12 }}
              />
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
              <Bar dataKey="orders" fill="var(--color-chart-1)" radius={[0, 4, 4, 0]} maxBarSize={18}>
                <LabelList dataKey="orders" position="right" fill="var(--color-foreground)" fontSize={12} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
