"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

export type MarketPoint = { label: string; value: number };

function ChartTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-slate-line bg-white px-3 py-2 text-xs shadow-md">
      <p className="font-semibold text-ink">{label}</p>
      <p className="font-mono text-ok">{payload[0].value.toFixed(4)}</p>
    </div>
  );
}

export function MarketChart({ data }: { data: MarketPoint[] }) {
  if (data.length === 0) return null;

  return (
    <div className="h-52 w-full min-w-0">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 6, right: 6, bottom: 0, left: -14 }}>
          <defs>
            <linearGradient id="cseFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4caf50" stopOpacity={0.45} />
              <stop offset="100%" stopColor="#4caf50" stopOpacity={0.06} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#e8edf2" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: "#8a94a6" }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
            minTickGap={26}
          />
          <YAxis
            tick={{ fontSize: 10, fill: "#8a94a6" }}
            tickLine={false}
            axisLine={false}
            width={52}
            // The index moves within a fraction of a percent across a session,
            // so a domain anchored at zero would render the day as a flat
            // line. Fitted to the data, with a little air either side.
            domain={["dataMin - 1", "dataMax + 1"]}
            tickFormatter={(v: number) => v.toFixed(0)}
          />
          <Tooltip content={<ChartTooltip />} />
          <Area
            type="linear"
            dataKey="value"
            stroke="#4caf50"
            strokeWidth={1.5}
            fill="url(#cseFill)"
            dot={false}
            activeDot={{ r: 3 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
