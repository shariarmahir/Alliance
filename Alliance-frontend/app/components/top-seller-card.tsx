import Link from "next/link";
import Image from "next/image";
import type { Product } from "@/app/lib/types";

// Stock badge mirrors the design bundle's three states: green in-stock,
// amber low-stock, neutral sourced-to-order when the shelf is empty. Sized
// down below sm to fit a two-up mobile card.
function StockBadge({ stock }: { stock: number }) {
  const base =
    "absolute right-1.5 top-1.5 rounded px-1.5 py-0.5 font-mono text-[8.5px] font-semibold sm:right-2.5 sm:top-2.5 sm:px-2.5 sm:py-1 sm:text-[10px]";
  if (stock === 0) {
    return <span className={`${base} border-0 bg-[#f2f4f7] text-ink-muted`}>5–7 DAYS</span>;
  }
  if (stock <= 5) {
    return <span className={`${base} bg-warn-bg text-warn`}>LOW STOCK {stock}</span>;
  }
  return <span className={`${base} bg-ok-bg text-ok`}>IN STOCK {stock}</span>;
}

export function TopSellerCard({
  product,
  quantitySold,
  rank,
  periodLabel = "This week",
}: {
  product: Product;
  // Units actually sold in the period, from issued order confirmations. The
  // card previously showed a fabricated star rating and review count; neither
  // exists as real data, so this replaces them with a figure that does.
  quantitySold: number;
  rank?: number;
  periodLabel?: string;
}) {
  const browseHref = `/products/${product.slug}`;

  return (
    <div className="group overflow-hidden rounded-[10px] border border-slate-line bg-white transition-all duration-300 hover:-translate-y-[3px] hover:border-primary hover:shadow-[0_12px_28px_rgba(16,25,45,.1)]">
      <Link href={browseHref} className="block">
        <div className="relative flex h-28 items-center justify-center border-b border-hairline bg-surface sm:h-[158px]">
          <Image
            src={product.image}
            alt={product.name}
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 50vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
          {rank != null && (
            <span className="absolute left-1.5 top-1.5 rounded bg-ink px-1.5 py-0.5 font-mono text-[8px] font-bold tracking-[0.06em] text-accent sm:left-2.5 sm:top-2.5 sm:px-2.5 sm:py-1 sm:text-[9.5px]">
              #{rank}
              <span className="hidden sm:inline"> {periodLabel.toUpperCase()}</span>
            </span>
          )}
          <StockBadge stock={product.stockQty} />
        </div>
      </Link>

      <div className="p-2.5 sm:p-4">
        <p className="mb-1 truncate font-mono text-[9px] font-semibold uppercase tracking-[0.08em] text-primary sm:mb-1.5 sm:text-[10.5px]">
          {product.brand}
        </p>
        <Link href={browseHref}>
          <p className="mb-1 truncate font-mono text-[12.5px] font-semibold text-ink transition-colors group-hover:text-primary sm:text-base">
            {product.partNumber}
          </p>
        </Link>
        <p className="mb-2 line-clamp-2 text-[11px] leading-[1.45] text-[#64748b] sm:mb-2.5 sm:text-[12.5px] sm:leading-[1.5]">
          {product.name}
        </p>

        {/* Hidden below sm for the same reason the rating row was: a two-up
            card has no width for a second metadata line. */}
        <div className="mb-3.5 hidden items-center gap-1.5 sm:flex">
          <span className="font-mono text-xs font-semibold tracking-[0.06em] text-accent">
            {quantitySold}
          </span>
          <span className="text-[11.5px] text-[#8a94a6]">
            {quantitySold === 1 ? "unit" : "units"} ordered {periodLabel.toLowerCase()}
          </span>
        </div>

        <Link
          href={browseHref}
          className="btn-glass w-full rounded-md py-2 text-center text-[11.5px] font-bold shadow-[0_8px_18px_rgba(0,125,204,.24)] sm:py-2.5 sm:text-[13px]"
        >
          View details
        </Link>
      </div>
    </div>
  );
}
