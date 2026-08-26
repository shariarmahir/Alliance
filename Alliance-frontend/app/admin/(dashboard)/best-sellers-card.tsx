import { getTopSellers } from "@/app/lib/catalog-data";

// Units sold are now real — aggregated from issued order confirmations over
// the last 30 days, not derived from a rank position.
export async function BestSellersCard() {
  const items = await getTopSellers("month", 4);

  return (
    <div className="min-w-0 rounded-[10px] border border-slate-line bg-white p-5">
      <p className="mb-3.5 text-[15px] font-bold text-ink">Best sellers</p>
      {items.length === 0 ? (
        <p className="text-[12.5px] text-[#8a94a6]">No orders issued in the last 30 days.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {items.map(({ product, quantitySold }, idx) => {
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
                    {product.brand} · {quantitySold} {quantitySold === 1 ? "unit" : "units"}
                  </span>
                </span>
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
