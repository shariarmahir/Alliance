"use client";

import { useState } from "react";
import { TopSellerCard } from "@/app/components/top-seller-card";
import type { TopSeller } from "@/app/lib/catalog-data";

type Period = "week" | "month" | "year";

const PERIODS: { id: Period; label: string }[] = [
  { id: "week", label: "This week" },
  { id: "month", label: "This month" },
  { id: "year", label: "This year" },
];

// Client half of the section: the data for all three periods arrives as props
// from the server component, so switching tabs needs no round trip.
export function MostRequestedPartsTabs({
  week,
  month,
  year,
}: {
  week: TopSeller[];
  month: TopSeller[];
  year: TopSeller[];
}) {
  const byPeriod: Record<Period, TopSeller[]> = { week, month, year };
  // Open on the widest window that actually has sales, so a quiet week does
  // not greet visitors with an empty grid.
  const [period, setPeriod] = useState<Period>(
    week.length ? "week" : month.length ? "month" : "year"
  );
  const items = byPeriod[period];
  const periodLabel = PERIODS.find((p) => p.id === period)?.label ?? "This week";

  return (
    <>
      <div className="mb-6 flex justify-end">
        <div className="flex rounded-[9px] border border-slate-line bg-[#f2f4f7] p-1">
          {PERIODS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setPeriod(p.id)}
              aria-pressed={period === p.id}
              className={`rounded-md px-5 py-2 text-[13px] font-semibold transition-colors ${
                period === p.id
                  ? "bg-white text-ink shadow-[0_1px_3px_rgba(16,25,45,.12)]"
                  : "font-medium text-[#64748b] hover:text-primary"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {items.length === 0 ? (
        <p className="rounded-[10px] border border-dashed border-slate-line bg-surface px-6 py-10 text-center text-[13.5px] text-[#64748b]">
          No orders recorded for {periodLabel.toLowerCase()} yet.
        </p>
      ) : (
        /* Two per row from the base breakpoint up, not one — the same fix as
           the category grid: grid-cols-1 stuck phones with a single
           full-width card at a time. */
        <div className="grid grid-cols-2 gap-3 sm:gap-4.5 lg:grid-cols-4">
          {items.map((item, i) => (
            <TopSellerCard
              key={item.product.slug}
              product={item.product}
              quantitySold={item.quantitySold}
              rank={i === 0 ? 1 : undefined}
              periodLabel={periodLabel}
            />
          ))}
        </div>
      )}
    </>
  );
}
