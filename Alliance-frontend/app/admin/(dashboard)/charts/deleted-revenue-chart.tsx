"use client";

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { formatPrice } from "@/app/lib/utils";

// Orders destroyed by "Remove anyway", and the money that went with them.
//
// Deliberately its own chart rather than a third series on the revenue one.
// Revenue counts live confirmed orders, so a purged order has already left
// that series entirely — drawing the two together would invite reading the
// deletion as a subtraction from what is plotted beside it, when it has in
// fact already been subtracted. Here the number stands alone, which is what
// makes it answerable: this much value was removed from the books.
export type DeletedRevenuePoint = { label: string; deleted: number };

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
  const deleted = payload.find((p) => p.dataKey === "deleted")?.value ?? 0;
  return (
    <div className="rounded-md border border-slate-line bg-white px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-semibold text-ink">{label}</p>
      <p className="text-[#7a2f2f]">{formatPrice(deleted)} deleted</p>
    </div>
  );
}

export function DeletedRevenueChart({
  data,
  total,
  count,
  caption,
}: {
  data?: DeletedRevenuePoint[];
  total: number;
  count: number;
  caption?: string;
}) {
  const points = data ?? [];
  const hasData = points.some((p) => p.deleted > 0);

  return (
    <div className="rounded-[10px] border border-slate-line bg-white p-5">
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <p className="mb-0.5 text-[15px] font-bold text-ink">Deleted order revenue</p>
          <p className="text-[11.5px] text-[#8a94a6]">{caption ?? "BDT"}</p>
        </div>
        <div className="text-right">
          <p className="font-mono text-[15px] font-bold tabular-nums text-[#7a2f2f]">
            {formatPrice(total)}
          </p>
          <p className="text-[11px] text-[#8a94a6]">
            {count} order{count === 1 ? "" : "s"} removed
          </p>
        </div>
      </div>

      {!hasData && (
        <p className="mb-3 rounded-md border border-tint-line bg-[#f4faff] px-3.5 py-2.5 text-[12px] text-[#00618f]">
          No orders have been permanently deleted in this period.
        </p>
      )}

      <div className="h-[250px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={points} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="#eef1f5" vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "#8a94a6", fontSize: 10.5, fontFamily: "var(--font-mono)" }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              width={44}
              tick={{ fill: "#c8d0da", fontSize: 10, fontFamily: "var(--font-mono)" }}
              tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : `${v}`)}
            />
            <Tooltip content={<ChartTooltip />} cursor={{ fill: "rgba(122,47,47,.06)" }} />
            <Bar dataKey="deleted" fill="#7a2f2f" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
