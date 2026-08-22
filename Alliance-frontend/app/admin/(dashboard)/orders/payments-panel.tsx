"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowDownRight, ArrowUpRight, Clock3, Wallet } from "lucide-react";
import { formatPrice } from "@/app/lib/utils";
import { apiFetch } from "@/app/lib/api-browser";
import type { AnalyticsRange, PaymentAnalytics } from "@/app/lib/admin-data";

const RANGES: { value: AnalyticsRange; label: string }[] = [
  { value: "week", label: "Week" },
  { value: "month", label: "Month" },
  { value: "year", label: "Year" },
];

const CAPTION: Record<AnalyticsRange, string> = {
  week: "Last 7 days",
  month: "Last 30 days",
  year: "Last 12 months",
};

function ChartTooltip({
  active,
  payload,
  label,
  tone,
  name,
}: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
  tone: string;
  name: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-slate-line bg-white px-3 py-2 text-[11.5px] shadow-md">
      <p className="mb-0.5 font-semibold text-ink">{label}</p>
      <p style={{ color: tone }}>
        {formatPrice(payload[0].value)} {name}
      </p>
    </div>
  );
}

/**
 * One money figure with its trend. Received and pending share this shape so
 * the pair reads as a single comparison rather than two unrelated widgets.
 */
function MoneyCard({
  label,
  value,
  note,
  count,
  countLabel,
  tone,
  icon,
  trend,
  seriesName,
  emptyNote,
}: {
  label: string;
  value: number;
  note?: React.ReactNode;
  count: number;
  countLabel: string;
  tone: string;
  icon: React.ReactNode;
  trend: { label: string; value: number }[];
  seriesName: string;
  emptyNote: string;
}) {
  const gradientId = `pay-${label.replace(/\s+/g, "-").toLowerCase()}`;
  const hasData = trend.some((p) => p.value > 0);

  return (
    <div className="rounded-[10px] border border-slate-line bg-white">
      <span className="block h-0.75 rounded-t-[10px]" style={{ background: tone }} />
      <div className="p-4.5">
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="mb-1.5 flex items-center gap-1.5 text-[12px] font-medium text-[#64748b]">
              <span style={{ color: tone }}>{icon}</span>
              {label}
            </p>
            <p className="font-mono text-[22px] font-bold tracking-[-0.02em] text-ink">
              {formatPrice(value)}
            </p>
          </div>
          <span className="shrink-0 rounded-full bg-surface px-2.5 py-1 font-mono text-[11px] font-semibold text-ink-soft">
            {count} {countLabel}
          </span>
        </div>

        {note}

        <div className="mt-3 h-23 w-full">
          {hasData ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trend} margin={{ top: 4, right: 2, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={tone} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={tone} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#eef1f5" vertical={false} />
                <XAxis
                  dataKey="label"
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                  minTickGap={18}
                  tick={{ fill: "#a8b2c1", fontSize: 9.5, fontFamily: "var(--font-mono)" }}
                />
                <YAxis
                  hide
                  domain={[0, (max: number) => (max > 0 ? max * 1.15 : 1)]}
                />
                <Tooltip
                  content={<ChartTooltip tone={tone} name={seriesName} />}
                  cursor={{ stroke: "#dde3ea" }}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke={tone}
                  strokeWidth={1.75}
                  fill={`url(#${gradientId})`}
                />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center rounded-md border border-dashed border-slate-line">
              <p className="px-3 text-center text-[11px] text-[#8a94a6]">{emptyNote}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export function PaymentsPanel({
  initial,
  version,
}: {
  initial: PaymentAnalytics;
  /** Bumped by the Orders screen after any change that moves money. */
  version: number;
}) {
  const [range, setRange] = useState<AnalyticsRange>(initial.range);
  const [data, setData] = useState<PaymentAnalytics>(initial);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (next: AnalyticsRange) => {
    setLoading(true);
    try {
      setData(
        await apiFetch<PaymentAnalytics>(`/api/admin/analytics/payments?range=${next}`)
      );
    } catch {
      // Keeping the figures already on screen beats blanking the panel:
      // they were true, just for a different moment.
    } finally {
      setLoading(false);
    }
  }, []);

  // Refetch when a row records a payment, cancels an order, or otherwise
  // changes what is owed. The server component re-renders on those too, but
  // this panel keeps its own copy in state, so new props alone would not
  // reach it — and the totals must never lag the rows they summarise.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return; // `initial` is already this data; refetching it would only flicker.
    }
    load(range);
  }, [version, range, load]);

  function pick(next: AnalyticsRange) {
    if (next === range) return;
    setRange(next); // The effect above fetches it.
  }

  const delta = data.receivedDeltaPct;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[15px] font-bold text-ink">Payments</p>
          <p className="text-[11.5px] text-[#8a94a6]">
            {CAPTION[range]} &middot; BDT
          </p>
        </div>
        <div className="flex gap-1 rounded-lg bg-surface p-1">
          {RANGES.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => pick(r.value)}
              className={`rounded-md px-3 py-1.5 text-[11.5px] font-semibold transition-colors ${
                range === r.value
                  ? "bg-white text-ink shadow-sm"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Fading rather than blanking: the figures on screen were true a moment
          ago, so dimming them reads as "updating" instead of "gone". */}
      <div
        className={`grid gap-4 transition-opacity duration-200 lg:grid-cols-2 ${
          loading ? "opacity-60" : "opacity-100"
        }`}
      >
        <MoneyCard
          label="Received payments"
          value={data.received}
          count={data.receivedCount}
          countLabel={data.receivedCount === 1 ? "order" : "orders"}
          tone="#12a366"
          icon={<Wallet className="size-3.5" />}
          trend={data.receivedTrend}
          seriesName="received"
          emptyNote={`Nothing recorded as received in this period.`}
          note={
            delta === null ? (
              <p className="text-[11.5px] text-[#8a94a6]">No prior period to compare against.</p>
            ) : (
              <p
                className={`flex items-center gap-1 text-[11.5px] font-medium ${
                  delta >= 0 ? "text-ok" : "text-[#c22]"
                }`}
              >
                {delta >= 0 ? (
                  <ArrowUpRight className="size-3.5" />
                ) : (
                  <ArrowDownRight className="size-3.5" />
                )}
                {Math.abs(delta)}% vs previous {range}
              </p>
            )
          }
        />
        <MoneyCard
          label="Pending payments"
          value={data.pending}
          count={data.pendingCount}
          countLabel={data.pendingCount === 1 ? "order" : "orders"}
          tone="#cc9400"
          icon={<Clock3 className="size-3.5" />}
          trend={data.pendingTrend}
          seriesName="outstanding"
          emptyNote="No unpaid orders issued in this period."
          note={
            <p className="text-[11.5px] text-[#8a94a6]">
              Total still owed across all unpaid orders. The chart shows when they were
              issued.
            </p>
          }
        />
      </div>
    </div>
  );
}
