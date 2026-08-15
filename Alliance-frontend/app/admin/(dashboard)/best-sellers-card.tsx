import { getTopSelling } from "@/app/lib/mock-data";

// Mock unit-sold figures derived from rank position — replace with real sales
// data before production.
function mockUnitsSold(rank: number): number {
  return Math.max(180 - rank * 22, 24);
}

export function BestSellersCard() {
  const products = getTopSelling("month").slice(0, 4);

  return (
    <div className="rounded-[10px] border border-slate-line bg-white p-5">
      <p className="mb-3.5 text-[15px] font-bold text-ink">Best sellers</p>
      <div className="flex flex-col gap-3">
        {products.map((product, idx) => {
          const units = mockUnitsSold(product.monthRank ?? idx + 1);
          const lead = idx === 0;
          return (
            <span key={product.slug} className="flex items-center gap-3">
              <span
                className={`flex size-5.5 shrink-0 items-center justify-center rounded-[5px] font-mono text-[10px] font-bold ${
                  lead ? "bg-ink text-accent" : "bg-[#f2f4f7] text-ink-muted"
                }`}
              >
                {idx + 1}
              </span>
              <span className="min-w-0 flex-1">
                <strong className="block truncate font-mono text-[12.5px] font-semibold text-ink">
                  {product.partNumber}
                </strong>
                <span className="text-[11px] text-[#8a94a6]">
                  {product.brand} · {units} units
                </span>
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
