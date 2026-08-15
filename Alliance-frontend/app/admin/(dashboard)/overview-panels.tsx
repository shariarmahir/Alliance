import Link from "next/link";
import { clientsByCountry, trafficSources, orderRatio } from "@/app/lib/mock-analytics";

const PANEL = "rounded-[10px] border border-slate-line bg-white p-5";
const HEADING = "text-[15px] font-bold text-ink";

// "Where orders come from" — share-of-total bars, colour-ranked by position.
const SOURCE_COLORS = ["bg-primary", "bg-[#3ea5e8]", "bg-accent", "bg-ok-dot", "bg-[#9aa6b6]"];

export function OrderSourcesPanel() {
  const total = trafficSources.reduce((sum, s) => sum + s.orders, 0);

  return (
    <div className={PANEL}>
      <p className={`mb-4 ${HEADING}`}>Where orders come from</p>
      <div className="flex flex-col gap-3.5 text-[12.5px] text-ink-soft">
        {trafficSources.map((s, i) => {
          const pct = Math.round((s.orders / total) * 100);
          return (
            <span key={s.source}>
              <span className="mb-1.5 flex justify-between">
                <span>{s.source}</span>
                <strong className="font-mono">{pct}%</strong>
              </span>
              <span className="block h-[7px] rounded bg-hairline">
                <span
                  className={`block h-full rounded ${SOURCE_COLORS[i % SOURCE_COLORS.length]}`}
                  style={{ width: `${pct}%` }}
                />
              </span>
            </span>
          );
        })}
      </div>
      <p className="mt-4 rounded-md border border-tint-line bg-[#f4faff] p-3 text-[11.5px] leading-[1.6] text-[#00618f]">
        Best return per dollar: WhatsApp enquiries — 41% of them convert.
      </p>
    </div>
  );
}

export function TopDestinationsPanel() {
  const max = Math.max(...clientsByCountry.map((c) => c.orders));

  return (
    <div className={PANEL}>
      <p className={`mb-4 ${HEADING}`}>Top destinations</p>
      <div className="flex flex-col gap-2.5 text-[12.5px] text-ink-soft">
        {clientsByCountry.map((c, i) => (
          <span
            key={c.country}
            className={`flex items-center justify-between ${
              i < clientsByCountry.length - 1 ? "border-b border-[#f2f4f7] pb-2.5" : ""
            }`}
          >
            <span>{c.country}</span>
            <span className="flex items-center gap-2.5">
              <span className="h-1.5 w-16 rounded bg-hairline">
                <span
                  className="block h-full rounded bg-primary"
                  style={{ width: `${Math.round((c.orders / max) * 100)}%` }}
                />
              </span>
              <strong className="w-6 text-right font-mono text-xs">{c.orders}</strong>
            </span>
          </span>
        ))}
      </div>
    </div>
  );
}

// Donut + legend + conversion bar, matching the design's "Order ratio" card.
export function OrderRatioPanel() {
  const total = orderRatio.reduce((sum, s) => sum + s.count, 0);
  const confirmed = orderRatio.find((s) => s.status === "confirmed")?.count ?? 0;
  const pending = orderRatio.find((s) => s.status === "pending")?.count ?? 0;
  const cancelled = orderRatio.find((s) => s.status === "cancelled")?.count ?? 0;

  const confirmedPct = Math.round((confirmed / total) * 100);
  const pendingEnd = Math.round(((confirmed + pending) / total) * 100);
  const conversion = Math.round((confirmed / total) * 100);

  return (
    <div className={PANEL}>
      <p className={`mb-1 ${HEADING}`}>Order ratio</p>
      <p className="mb-4.5 text-[11.5px] text-[#8a94a6]">This month · {total} orders</p>

      <div className="flex items-center gap-5.5">
        <span
          className="relative size-[132px] shrink-0 rounded-full"
          style={{
            background: `conic-gradient(#12a366 0 ${confirmedPct}%, #ffb900 ${confirmedPct}% ${pendingEnd}%, #e04545 ${pendingEnd}% 100%)`,
          }}
        >
          <span className="absolute inset-[17px] flex flex-col items-center justify-center rounded-full bg-white">
            <span className="font-mono text-[21px] font-bold text-ink">{confirmedPct}%</span>
            <span className="mono-label text-[9.5px] tracking-[0.06em] text-[#8a94a6]">CONFIRMED</span>
          </span>
        </span>
        <div className="flex flex-1 flex-col gap-3 text-[12.5px] text-ink-soft">
          {[
            { label: "Confirmed", value: confirmed, dot: "bg-ok-dot" },
            { label: "Pending", value: pending, dot: "bg-accent" },
            { label: "Cancelled", value: cancelled, dot: "bg-[#e04545]" },
          ].map((row) => (
            <span key={row.label} className="flex items-center justify-between">
              <span className="flex items-center gap-2">
                <span className={`size-2.5 rounded-sm ${row.dot}`} />
                {row.label}
              </span>
              <strong className="font-mono text-ink">{row.value}</strong>
            </span>
          ))}
        </div>
      </div>

      <div className="mt-5 border-t border-hairline pt-3.5">
        <p className="mono-label mb-3 text-[11px] tracking-[0.07em] text-[#8a94a6]">
          QUOTATION CONVERSION
        </p>
        <div className="mb-1.5 flex items-center gap-2.5">
          <span className="h-2 flex-1 overflow-hidden rounded bg-hairline">
            <span
              className="block h-full bg-linear-to-r from-primary to-[#3ea5e8]"
              style={{ width: `${conversion}%` }}
            />
          </span>
          <strong className="font-mono text-[13px] text-ink">{conversion}%</strong>
        </div>
        <p className="text-[11.5px] text-[#8a94a6]">
          {confirmed} of {total} quotations became orders
        </p>
      </div>
    </div>
  );
}

// Low-stock rollup. Bar width is stock as a share of a 20-unit healthy shelf,
// so a nearly-empty bin reads as a short red bar.
const LOW_STOCK: { part: string; qty: number }[] = [
  { part: "1756-L83E", qty: 3 },
  { part: "2711C-T6C", qty: 4 },
  { part: "ATV320U15N4C", qty: 5 },
  { part: "FC-302P7K5", qty: 1 },
];

export function WarehouseAlertsPanel() {
  return (
    <div className={PANEL}>
      <div className="mb-3.5 flex items-center justify-between">
        <p className={HEADING}>Warehouse alerts</p>
        <span className="rounded-[5px] bg-warn-bg px-2 py-1 font-mono text-[10.5px] font-semibold text-warn">
          {LOW_STOCK.length} LOW
        </span>
      </div>
      <div className="flex flex-col gap-2.5 text-[12.5px] text-ink-soft">
        {LOW_STOCK.map((s) => {
          const critical = s.qty <= 3;
          return (
            <span key={s.part} className="flex items-center justify-between">
              <span className="font-mono text-xs">{s.part}</span>
              <span className="flex items-center gap-2.5">
                <span className="h-1.5 w-13 rounded bg-hairline">
                  <span
                    className={`block h-full rounded ${critical ? "bg-[#e04545]" : "bg-accent"}`}
                    style={{ width: `${Math.min(100, (s.qty / 20) * 100)}%` }}
                  />
                </span>
                <strong
                  className={`font-mono text-[11.5px] ${critical ? "text-[#c22]" : "text-warn"}`}
                >
                  {s.qty}
                </strong>
              </span>
            </span>
          );
        })}
      </div>
      <Link
        href="/admin/stock"
        className="mt-4 flex items-center justify-center rounded-md border border-[#dde3ea] py-2.5 text-[12.5px] font-semibold text-ink-soft transition-colors hover:border-primary hover:text-primary"
      >
        Open stock control
      </Link>
    </div>
  );
}
