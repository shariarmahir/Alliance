"use client";

import { useEffect, useState } from "react";
import { clientsByCountry } from "@/app/lib/mock-analytics";
import { Card, CardHeader, CardTitle, CardContent } from "@/app/components/ui/card";
import { cn } from "@/app/lib/utils";

const RANK_TONES = [
  "bg-primary text-white",
  "bg-accent text-slate-900",
  "bg-chart-4/15 text-chart-4",
  "bg-muted text-muted-foreground",
  "bg-muted text-muted-foreground",
  "bg-muted text-muted-foreground",
];

export function CountryChart() {
  const data = [...clientsByCountry].sort((a, b) => b.orders - a.orders);
  const max = Math.max(...data.map((d) => d.orders));
  const total = data.reduce((sum, d) => sum + d.orders, 0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  return (
    <Card className="p-6">
      <CardHeader className="px-0">
        <CardTitle className="text-base">Clients by Country</CardTitle>
      </CardHeader>
      <CardContent className="px-0">
        <div className="flex flex-col gap-4">
          {data.map((d, i) => {
            const pct = (d.orders / max) * 100;
            const share = ((d.orders / total) * 100).toFixed(1);
            return (
              <div key={d.country} className="group flex items-center gap-3">
                <span
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-transform duration-200 group-hover:scale-110",
                    RANK_TONES[i] ?? RANK_TONES[RANK_TONES.length - 1]
                  )}
                >
                  {i + 1}
                </span>

                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-medium text-foreground">{d.country}</span>
                    <span className="flex items-baseline gap-1.5 whitespace-nowrap">
                      <span className="text-sm font-bold text-foreground">{d.orders}</span>
                      <span className="text-[11px] text-muted-foreground">({share}%)</span>
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-linear-to-r from-primary to-primary-dark shadow-[0_0_8px_var(--color-primary)] transition-all duration-700 ease-out"
                      style={{ width: mounted ? `${pct}%` : "0%" }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
