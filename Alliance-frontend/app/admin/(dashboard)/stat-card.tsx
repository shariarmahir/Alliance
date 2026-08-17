"use client";

import { useId } from "react";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import { cn } from "@/app/lib/utils";

export type StatCardTone = "primary" | "accent" | "emerald" | "terracotta";

// Design bundle: a 3px colour rule across the top, the figure in IBM Plex
// Mono, and a status pill underneath. The background sparkline reuses the
// same tone so the trend line reads as part of the card, not a separate chart.
const TONE_TOP: Record<StatCardTone, string> = {
  primary: "bg-primary",
  accent: "bg-accent",
  emerald: "bg-ok-dot",
  terracotta: "bg-[#e04545]",
};

const TONE_HEX: Record<StatCardTone, string> = {
  primary: "#007dcc",
  accent: "#ffb900",
  emerald: "#1f9d63",
  terracotta: "#e04545",
};

export function StatCard({
  label,
  value,
  note,
  negative = false,
  tone = "primary",
  trend,
}: {
  label: string;
  value: string;
  note: string;
  negative?: boolean;
  tone?: StatCardTone;
  // Last 7 days, oldest first — drawn as a filled sparkline behind the
  // figure. Optional so a card can still render without one.
  trend?: number[];
}) {
  const color = TONE_HEX[tone];
  const gradientId = `stat-trend-${useId()}`;

  return (
    <div className="relative overflow-hidden rounded-[10px] border border-slate-line bg-white">
      <span className={cn("block h-[3px]", TONE_TOP[tone])} />

      {trend && trend.length > 1 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-16 opacity-[0.16]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={trend.map((v, i) => ({ i, v }))} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={color} stopOpacity={0.9} />
                  <stop offset="100%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="v"
                stroke={color}
                strokeWidth={1.75}
                fill={`url(#${gradientId})`}
                isAnimationActive
                animationDuration={1200}
                animationEasing="ease-out"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="relative p-4.5">
        <p className="mb-2 text-xs font-medium text-[#64748b]">{label}</p>
        <p className="mb-2.5 font-mono text-[27px] font-bold tracking-[-0.02em] text-ink">{value}</p>
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-[5px] px-2.5 py-1 text-[11.5px] font-semibold",
            negative ? "bg-[#fdecec] text-[#c22]" : "bg-ok-bg text-ok"
          )}
        >
          {note}
        </span>
      </div>
    </div>
  );
}
