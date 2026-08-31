"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

// One line per manufacturer, indexed to 100 at the first week rather than
// plotted in dollars. The ADRs trade at very different prices — Rockwell in
// the hundreds, Omron in the thirties — so a shared dollar axis would flatten
// four of the five lines into the floor and show only that one is expensive,
// which is not the question this panel answers. Indexing puts every
// manufacturer on the same footing: the chart reads as relative movement.
export type MarketPoint = { label: string } & Record<string, number | string>;

const SERIES_COLORS = [
  "#007DCC",
  "#e07b39",
  "#2f9e6e",
  "#8a5cd1",
  "#c2454f",
] as const;

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color: string }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-slate-line bg-white px-3 py-2 text-xs shadow-md">
      <p className="mb-1 font-semibold text-ink">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} style={{ color: entry.color }}>
          {entry.name} {entry.value > 100 ? "+" : ""}
          {(entry.value - 100).toFixed(1)}%
        </p>
      ))}
    </div>
  );
}

export function MarketChart({
  data,
  series,
}: {
  data: MarketPoint[];
  series: string[];
}) {
  if (data.length === 0 || series.length === 0) return null;

  return (
    <div className="h-45 w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -22 }}>
          <CartesianGrid stroke="#f2f4f7" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: "#8a94a6" }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={18}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#8a94a6" }}
            tickLine={false}
            axisLine={false}
            domain={["dataMin - 4", "dataMax + 4"]}
            tickFormatter={(v: number) => `${Math.round(v - 100)}%`}
          />
          <Tooltip content={<ChartTooltip />} />
          {series.map((name, i) => (
            <Line
              key={name}
              type="monotone"
              dataKey={name}
              name={name}
              stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
              strokeWidth={1.75}
              dot={false}
              activeDot={{ r: 3 }}
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
