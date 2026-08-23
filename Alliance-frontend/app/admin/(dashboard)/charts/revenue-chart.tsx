"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { formatPrice } from "@/app/lib/utils";

// Twin bars per bucket: what was sold, and what of it is still unpaid. Both
// series are BDT, so they share one axis — a second scale would let a small
// pending figure draw taller than a large revenue one.
export type RevenuePoint = { label: string; revenue: number; pending: number };

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { dataKey: string; value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const revenue = payload.find((p) => p.dataKey === "revenue")?.value ?? 0;
  const pending = payload.find((p) => p.dataKey === "pending")?.value ?? 0;
  return (
    <div className="rounded-md border border-slate-line bg-white px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-semibold text-ink">{label}</p>
      <p className="text-primary">{formatPrice(revenue)} revenue</p>
      <p className="text-warn">{formatPrice(pending)} pending</p>
    </div>
  );
}

export function RevenueChart({
  data,
  caption,
}: {
  data?: RevenuePoint[];
  caption?: string;
}) {
  const points = data ?? [];
  const hasData = points.some((p) => p.revenue > 0 || p.pending > 0);

  return (
    <div className="rounded-[10px] border border-slate-line bg-white p-5">
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="mb-0.5 text-[15px] font-bold text-ink">Revenue &amp; pending payment</p>
          <p className="text-[11.5px] text-[#8a94a6]">{caption ?? "Last 12 months · BDT"}</p>
        </div>
        <div className="flex gap-3.5 text-[11.5px] font-medium text-ink-muted">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-primary" />
            Revenue
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-accent" />
            Pending
          </span>
        </div>
      </div>

      {!hasData && (
        <p className="mb-3 rounded-md border border-tint-line bg-[#f4faff] px-3.5 py-2.5 text-[12px] text-[#00618f]">
          No confirmed orders in this period yet.
        </p>
      )}

      <div className="h-[250px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={points} margin={{ top: 4, right: 4, left: 0, bottom: 0 }} barGap={3}>
            <CartesianGrid stroke="#eef1f5" vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#8a94a6", fontSize: 10.5, fontFamily: "var(--font-mono)" }}
            />
            {/* One axis for both: they are the same unit, so a shared scale
                is what makes the bar heights comparable. */}
            <YAxis
              tickLine={false}
              axisLine={false}
              width={44}
              tick={{ fill: "#c8d0da", fontSize: 10, fontFamily: "var(--font-mono)" }}
              tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`)}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(0,125,204,.06)" }} />
            <Bar dataKey="revenue" fill="#007dcc" radius={[3, 3, 0, 0]} />
            <Bar dataKey="pending" fill="#ffd15c" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
