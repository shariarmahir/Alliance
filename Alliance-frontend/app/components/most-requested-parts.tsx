"use client";

import { useState } from "react";
import Link from "next/link";
import { TopSellerCard } from "@/app/components/top-seller-card";
import { topSellersFor, type TopSellerPeriod } from "@/app/lib/top-sellers";

const PERIODS: { id: TopSellerPeriod; label: string }[] = [
  { id: "week", label: "This week" },
  { id: "month", label: "This month" },
  { id: "year", label: "This year" },
];

export function MostRequestedParts() {
  const [period, setPeriod] = useState<TopSellerPeriod>("week");
  const items = topSellersFor(period, 4);

  return (
    <section className="mx-auto max-w-[1360px] px-7 py-13 md:px-[68px]">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="mb-1 text-2xl font-bold tracking-[-0.02em] text-ink sm:text-[27px]">
            Most requested parts
          </h2>
          <p className="text-[13.5px] text-[#64748b]">Ranked by price requests received</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Link
            href="/products"
            className="btn-glass-accent rounded-md px-5 py-2 text-[13px] font-bold shadow-[0_8px_18px_rgba(255,185,0,.24)]"
          >
            Want more?
          </Link>
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
      </div>
      {/* Two per row from the base breakpoint up, not one — the same fix as
          the category grid: grid-cols-1 stuck phones with a single
          full-width card at a time. */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4.5 lg:grid-cols-4">
        {items.map((p, i) => (
          <TopSellerCard key={p.id} product={p} rank={i === 0 ? 1 : undefined} periodLabel={PERIODS.find((x) => x.id === period)?.label} />
        ))}
      </div>
    </section>
  );
}
