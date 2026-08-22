import Link from "next/link";
import { readOrderRatio, readTopDestinations, readLowStock } from "@/app/lib/admin-data";

const PANEL = "rounded-[10px] border border-slate-line bg-white p-5";
const HEADING = "text-[15px] font-bold text-ink";
const EMPTY = "text-[12px] leading-[1.6] text-[#8a94a6]";

export async function TopDestinationsPanel() {
  const countries = await readTopDestinations();
  const max = Math.max(1, ...countries.map((c) => c.orders));

  return (
    <div className={PANEL}>
      <p className={`mb-4 ${HEADING}`}>Top destinations</p>
      {countries.length === 0 ? (
        <p className={EMPTY}>
          No confirmed orders yet. Countries appear here as orders are confirmed.
        </p>
      ) : (
        <div className="flex flex-col gap-2.5 text-[12.5px] text-ink-soft">
          {countries.map((c, i) => (
            <span
              key={c.country}
              className={`flex items-center justify-between ${
                i < countries.length - 1 ? "border-b border-[#f2f4f7] pb-2.5" : ""
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
      )}
    </div>
  );
}

// Donut + legend + conversion bar. Counts every price request by how it
// resolved, so the conversion figure is the share that became orders.
export async function OrderRatioPanel() {
  const ratio = await readOrderRatio();
  const total = ratio.reduce((sum, s) => sum + s.count, 0);
  const confirmed = ratio.find((s) => s.status === "confirmed")?.count ?? 0;
  const pending = ratio.find((s) => s.status === "pending")?.count ?? 0;
  const cancelled = ratio.find((s) => s.status === "cancelled")?.count ?? 0;

  if (total === 0) {
    return (
      <div className={PANEL}>
        <p className={`mb-1 ${HEADING}`}>Order ratio</p>
        <p className="mb-4.5 text-[11.5px] text-[#8a94a6]">No price requests yet</p>
        <p className={EMPTY}>
          Once customers start requesting quotations, this shows how many convert into
          confirmed orders.
        </p>
      </div>
    );
  }

  const confirmedPct = Math.round((confirmed / total) * 100);
  const pendingEnd = Math.round(((confirmed + pending) / total) * 100);
  const conversion = confirmedPct;

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

// Low-stock rollup, read from real stock quantities. Bar width is stock as a
// share of a 20-unit healthy shelf, so a nearly-empty bin reads as a short
// red bar.
export async function WarehouseAlertsPanel() {
  const lowStock = await readLowStock();

  return (
    <div className={PANEL}>
      <div className="mb-3.5 flex items-center justify-between">
        <p className={HEADING}>Warehouse alerts</p>
        {lowStock.length > 0 && (
          <span className="rounded-[5px] bg-warn-bg px-2 py-1 font-mono text-[10.5px] font-semibold text-warn">
            {lowStock.length} LOW
          </span>
        )}
      </div>
      {lowStock.length === 0 ? (
        <p className={EMPTY}>Every product is above the reorder level.</p>
      ) : (
        <div className="flex flex-col gap-2.5 text-[12.5px] text-ink-soft">
          {lowStock.map((s) => {
            const critical = s.quantity <= 3;
            return (
              <span
                key={s.slug}
                title={s.name}
                className="flex items-center justify-between"
              >
                <span className="truncate font-mono text-xs">{s.partNumber}</span>
                <span className="flex shrink-0 items-center gap-2.5">
                  <span className="h-1.5 w-13 rounded bg-hairline">
                    <span
                      className={`block h-full rounded ${critical ? "bg-[#e04545]" : "bg-accent"}`}
                      style={{ width: `${Math.min(100, (s.quantity / 20) * 100)}%` }}
                    />
                  </span>
                  <strong
                    className={`font-mono text-[11.5px] ${critical ? "text-[#c22]" : "text-warn"}`}
                  >
                    {s.quantity}
                  </strong>
                </span>
              </span>
            );
          })}
        </div>
      )}
      <Link
        href="/admin/stock"
        className="mt-4 flex items-center justify-center rounded-md border border-[#dde3ea] py-2.5 text-[12.5px] font-semibold text-ink-soft transition-colors hover:border-primary hover:text-primary"
      >
        Open stock control
      </Link>
    </div>
  );
}
