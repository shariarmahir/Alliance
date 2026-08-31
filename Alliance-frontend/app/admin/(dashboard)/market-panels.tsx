import Link from "next/link";
import {
  readMarketSeries,
  readStockStatus,
  type MarketSeries,
} from "@/app/lib/admin-data";
import { formatPrice } from "@/app/lib/utils";
import { MarketChart, type MarketPoint } from "./charts/market-chart";

// Matches overview-panels.tsx — see the note there on min-w-0.
const PANEL = "min-w-0 rounded-[10px] border border-slate-line bg-white p-5";
const HEADING = "text-[15px] font-bold text-ink";
const EMPTY = "text-[12px] leading-[1.6] text-[#8a94a6]";

function weekLabel(epochMs: number): string {
  return new Date(epochMs).toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
  });
}

/**
 * Rebases each series to 100 at its first week and merges them onto shared
 * buckets. See MarketChart for why the chart is indexed rather than priced.
 *
 * Series are aligned by position, not by timestamp: every ticker is fetched
 * with the same weekly window, so bar `i` is the same week across all of
 * them. The shortest series sets the length, so a manufacturer with less
 * history shortens the chart rather than leaving gaps mid-line.
 */
function toChartData(series: MarketSeries[]): { data: MarketPoint[]; names: string[] } {
  const usable = series.filter((s) => s.bars.length > 1);
  if (usable.length === 0) return { data: [], names: [] };

  const weeks = Math.min(...usable.map((s) => s.bars.length));
  const names = usable.map((s) => s.label);

  const data: MarketPoint[] = [];
  for (let i = 0; i < weeks; i += 1) {
    // Each series is trimmed from the END, so the newest weeks always line up
    // even when one manufacturer carries more history than another.
    const point: MarketPoint = {
      label: weekLabel(usable[0].bars[usable[0].bars.length - weeks + i].t),
    };
    for (const s of usable) {
      const bars = s.bars.slice(-weeks);
      const base = bars[0].c || 1;
      point[s.label] = Number(((bars[i].c / base) * 100).toFixed(2));
    }
    data.push(point);
  }
  return { data, names };
}

export async function MarketWatchPanel() {
  const series = await readMarketSeries();
  const { data, names } = toChartData(series);

  // Ranked by the week's move, so the panel leads with whatever actually
  // happened rather than a fixed alphabetical order.
  const ranked = [...series]
    .filter((s) => s.bars.length > 0)
    .sort((a, b) => b.changePct - a.changePct);

  const asOf = data.length > 0 ? data[data.length - 1].label : null;

  return (
    <div className={PANEL}>
      <div className="mb-1 flex items-start justify-between gap-3">
        <p className={HEADING}>Manufacturer share prices</p>
        {asOf && (
          <span className="shrink-0 font-mono text-[10.5px] text-[#8a94a6]">
            W/E {asOf}
          </span>
        )}
      </div>
      <p className="mb-3.5 text-[11.5px] text-[#8a94a6]">
        Weekly close, indexed to the first week · US ADRs
      </p>

      {ranked.length === 0 ? (
        <p className={EMPTY}>
          No market data yet. Set MASSIVE_API_KEY on the API to track the
          manufacturers this catalogue carries.
        </p>
      ) : (
        <>
          <MarketChart data={data} series={names} />
          <div className="mt-3.5 flex flex-col gap-2.5 text-[12.5px] text-ink-soft">
            {ranked.map((s) => {
              const up = s.changePct > 0;
              const flat = s.changePct === 0;
              return (
                <span
                  key={s.ticker}
                  className="flex items-center justify-between gap-3 border-b border-[#f2f4f7] pb-2.5 last:border-0 last:pb-0"
                >
                  <span className="min-w-0 truncate">
                    {s.label}
                    <span className="ml-1.5 font-mono text-[10.5px] text-[#8a94a6]">
                      {s.ticker}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2.5">
                    <strong className="font-mono text-[12px] text-ink">
                      ${s.latestClose.toFixed(2)}
                    </strong>
                    <strong
                      className={`font-mono text-[11.5px] ${
                        flat ? "text-[#8a94a6]" : up ? "text-ok" : "text-[#c22]"
                      }`}
                    >
                      {up ? "↑" : flat ? "→" : "↓"} {Math.abs(s.changePct).toFixed(2)}%
                    </strong>
                  </span>
                </span>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export async function StockStatusPanel() {
  const stock = await readStockStatus();
  const total = stock.inStock + stock.lowStock + stock.outOfStock;

  const segments = [
    { label: "In stock", count: stock.inStock, className: "bg-ok-dot", text: "text-ok" },
    { label: "Low", count: stock.lowStock, className: "bg-accent", text: "text-warn" },
    { label: "Out", count: stock.outOfStock, className: "bg-[#c22]", text: "text-[#c22]" },
  ];

  return (
    <div className={PANEL}>
      <div className="mb-3.5 flex items-start justify-between gap-3">
        <p className={HEADING}>Stock position</p>
        <span className="shrink-0 font-mono text-[10.5px] text-[#8a94a6]">
          {total} {total === 1 ? "PRODUCT" : "PRODUCTS"}
        </span>
      </div>

      {total === 0 ? (
        <p className={EMPTY}>No products in the catalogue yet.</p>
      ) : (
        <>
          {/* One bar rather than three: the question is how the catalogue
              splits, and a single stacked bar shows the proportions at a
              glance where three separate bars would not. */}
          <span className="flex h-2 w-full overflow-hidden rounded bg-hairline">
            {segments.map((s) =>
              s.count === 0 ? null : (
                <span
                  key={s.label}
                  className={s.className}
                  style={{ width: `${(s.count / total) * 100}%` }}
                />
              )
            )}
          </span>

          <div className="mt-3.5 grid grid-cols-3 gap-2 text-center">
            {segments.map((s) => (
              <span key={s.label}>
                <strong className={`block font-mono text-[17px] font-bold ${s.text}`}>
                  {s.count}
                </strong>
                <span className="text-[11px] text-[#8a94a6]">{s.label}</span>
              </span>
            ))}
          </div>

          <div className="mt-4 flex items-center justify-between border-t border-[#f2f4f7] pt-3 text-[12px]">
            <span className="text-[#8a94a6]">Units held</span>
            <strong className="font-mono text-ink">
              {stock.totalUnits.toLocaleString("en-GB")}
            </strong>
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[12px]">
            <span className="text-[#8a94a6]">Stock value</span>
            <strong className="font-mono text-ink">{formatPrice(stock.stockValue)}</strong>
          </div>
        </>
      )}

      <Link
        href="/admin/stock"
        className="mt-4 inline-block text-[12px] font-semibold text-primary hover:underline"
      >
        Manage stock →
      </Link>
    </div>
  );
}
