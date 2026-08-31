"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { MarketSnapshot } from "@/app/lib/admin-data";
import { MarketChart } from "./charts/market-chart";

const TABS = [
  { key: "gainers", label: "Gainers" },
  { key: "losers", label: "Losers" },
  { key: "volume", label: "Volume" },
  { key: "value", label: "Value" },
] as const;

function formatInt(value: number): string {
  return value.toLocaleString("en-US");
}

// A cell is coloured only in the columns where a sign means something: a
// price change, or a percentage. Colouring an LTP or a share volume by its
// sign would be meaningless, since those are never negative.
function isSignedColumn(column: string): boolean {
  const c = column.toLowerCase();
  return c.startsWith("change");
}

export function MarketSummaryPanel({ snapshot }: { snapshot: MarketSnapshot }) {
  const router = useRouter();
  const params = useSearchParams();
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("gainers");

  const down = snapshot.change < 0;
  const table = snapshot.top?.[tab];
  const stats = snapshot.stats;

  // The index choice is a URL parameter rather than component state: the
  // snapshot is fetched on the server, so switching index has to go back
  // through it. Preserving the existing params keeps the range toggle's
  // selection intact.
  function selectIndex(next: string) {
    const query = new URLSearchParams(params.toString());
    query.set("index", next);
    router.push(`/admin?${query.toString()}`);
  }

  const hasData = snapshot.points.length > 0 || (table?.rows.length ?? 0) > 0;

  return (
    <div className="grid min-w-0 gap-4 xl:grid-cols-[1.6fr_1fr]">
      {/* Index chart and the day's trade summary */}
      <div className="min-w-0 rounded-[10px] border border-slate-line bg-white p-5">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <span className="mono-label text-[10px] tracking-[0.06em] text-ink-muted">
            SELECT
          </span>
          <select
            value={snapshot.index}
            onChange={(e) => selectIndex(e.target.value)}
            className="rounded-md border border-[#dde3ea] bg-white px-2.5 py-1.5 text-[12px] font-semibold text-ink outline-none transition-colors hover:border-primary focus:border-primary"
          >
            {snapshot.indices.map((code) => (
              <option key={code} value={code}>
                {code}
              </option>
            ))}
          </select>

          {hasData && (
            <span className="flex flex-wrap items-baseline gap-2 font-mono text-[13px] font-bold">
              <span className="text-ink">{snapshot.value.toFixed(4)}</span>
              <span className="text-[#c8d0da]">|</span>
              <span className={down ? "text-[#c22]" : "text-ok"}>
                {snapshot.change.toFixed(4)}
              </span>
              <span className="text-[#c8d0da]">|</span>
              <span className={down ? "text-[#c22]" : "text-ok"}>
                {down ? "↓" : "↑"} {snapshot.changePct.toFixed(4)} %
              </span>
            </span>
          )}
        </div>

        {!hasData ? (
          <p className="py-8 text-center text-[12px] leading-[1.6] text-[#8a94a6]">
            Market data is unavailable right now. It is read from the
            Chittagong Stock Exchange and will reappear on the next refresh.
          </p>
        ) : (
          <>
            <MarketChart data={snapshot.points} />

            <div className="mt-4 grid gap-x-8 gap-y-2.5 border-t border-hairline pt-4 text-[12px] sm:grid-cols-2">
              <Stat label="Issues Traded">
                <span className="font-mono font-semibold text-[#8a7a00]">
                  {formatInt(stats.issuesTraded)}
                </span>
                <span className="ml-2 font-mono text-ok">{stats.advanced} ↑</span>
                <span className="ml-2 font-mono text-[#c22]">{stats.declined} ↓</span>
                <span className="ml-2 font-mono text-primary">{stats.unchanged} ↔</span>
              </Stat>
              <Stat label="Value in Taka">{formatInt(stats.valueInTaka)}</Stat>
              <Stat label="Volume">{formatInt(stats.volume)}</Stat>
              <Stat label="Contract Number">{formatInt(stats.contractNumber)}</Stat>
              <Stat label="Issued Cap.">{formatInt(stats.issuedCap)}</Stat>
              <Stat label="Closing Market Cap.">{formatInt(stats.marketCap)}</Stat>
            </div>
          </>
        )}
      </div>

      {/* Today's Top 10 */}
      <div className="min-w-0 overflow-hidden rounded-[10px] border border-slate-line bg-white">
        <p className="bg-[#1f7a44] px-5 py-3 text-center text-[14px] font-bold tracking-[0.02em] text-white">
          TODAY&apos;S TOP 10
        </p>

        <div className="flex gap-1 border-b border-hairline bg-surface px-2 py-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`rounded-[5px] px-2.5 py-1.5 text-[11.5px] font-semibold transition-colors ${
                tab === t.key
                  ? "bg-[#1f7a44] text-white"
                  : "text-ink-soft hover:bg-[#e8f2ea] hover:text-[#1f7a44]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {!table || table.rows.length === 0 ? (
          <p className="p-5 text-[12px] text-[#8a94a6]">Nothing to show for this tab.</p>
        ) : (
          <div className="scrollbar-slim overflow-x-auto">
            <table className="w-full text-[12px]">
              <thead>
                <tr className="bg-surface">
                  {table.columns.map((column, i) => (
                    <th
                      key={column}
                      className={`px-3 py-2 font-semibold text-ink-muted ${
                        i === 0 ? "text-left" : "text-right"
                      }`}
                    >
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {table.rows.map((row) => (
                  <tr key={row[0]} className="border-b border-[#f2f4f7] last:border-0">
                    {row.map((cell, i) => {
                      const signed =
                        isSignedColumn(table.columns[i] ?? "") && cell.startsWith("-");
                      const positive =
                        isSignedColumn(table.columns[i] ?? "") && !cell.startsWith("-");
                      return (
                        <td
                          key={i}
                          className={`px-3 py-2 ${
                            i === 0
                              ? "font-semibold text-ink"
                              : `text-right font-mono ${
                                  signed
                                    ? "text-[#c22]"
                                    : positive
                                      ? "text-ok"
                                      : "text-ink-soft"
                                }`
                          }`}
                        >
                          {cell}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <span className="flex items-baseline justify-between gap-3 sm:justify-start">
      <span className="w-40 shrink-0 font-semibold text-ink-soft">{label}</span>
      <span className="font-mono text-[#8a7a00]">{children}</span>
    </span>
  );
}
