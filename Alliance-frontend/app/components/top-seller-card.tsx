import Link from "next/link";
import Image from "next/image";
import type { TopSeller } from "@/app/lib/top-sellers";

// Stock badge mirrors the design bundle's three states: green in-stock,
// amber low-stock, neutral sourced-to-order when the shelf is empty.
function StockBadge({ stock }: { stock: number }) {
  if (stock === 0) {
    return (
      <span className="absolute right-2.5 top-2.5 rounded border-0 bg-[#f2f4f7] px-2.5 py-1 font-mono text-[10px] font-semibold text-ink-muted">
        5–7 DAYS
      </span>
    );
  }
  if (stock <= 5) {
    return (
      <span className="absolute right-2.5 top-2.5 rounded bg-warn-bg px-2.5 py-1 font-mono text-[10px] font-semibold text-warn">
        LOW STOCK {stock}
      </span>
    );
  }
  return (
    <span className="absolute right-2.5 top-2.5 rounded bg-ok-bg px-2.5 py-1 font-mono text-[10px] font-semibold text-ok">
      IN STOCK {stock}
    </span>
  );
}

export function TopSellerCard({ product, rank }: { product: TopSeller; rank?: number }) {
  const browseHref = `/products?q=${encodeURIComponent(product.partNumber)}`;
  const filled = Math.round(product.rating);

  return (
    <div className="group overflow-hidden rounded-[10px] border border-slate-line bg-white transition-all duration-300 hover:-translate-y-[3px] hover:border-primary hover:shadow-[0_12px_28px_rgba(16,25,45,.1)]">
      <Link href={browseHref} className="block">
        <div className="relative flex h-[158px] items-center justify-center border-b border-hairline bg-surface">
          <Image
            src={product.image}
            alt={product.name}
            fill
            sizes="(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
          />
          {rank != null && (
            <span className="absolute left-2.5 top-2.5 rounded bg-ink px-2.5 py-1 font-mono text-[9.5px] font-bold tracking-[0.06em] text-accent">
              #{rank} THIS WEEK
            </span>
          )}
          <StockBadge stock={product.stock} />
        </div>
      </Link>

      <div className="p-4">
        <p className="mb-1.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-primary">
          {product.brand}
        </p>
        <Link href={browseHref}>
          <p className="mb-1 font-mono text-base font-semibold text-ink transition-colors group-hover:text-primary">
            {product.partNumber}
          </p>
        </Link>
        <p className="mb-2.5 line-clamp-2 text-[12.5px] leading-[1.5] text-[#64748b]">{product.name}</p>

        <div className="mb-3.5 flex items-center gap-1.5">
          <span className="font-mono text-xs tracking-[0.06em] text-accent">
            {"★".repeat(filled)}
            <span className="text-[#d7dee7]">{"★".repeat(5 - filled)}</span>
          </span>
          <span className="text-[11.5px] text-[#8a94a6]">
            {product.rating.toFixed(1)} · {product.reviews} reviews
          </span>
        </div>

        <Link
          href={browseHref}
          className="btn-glass w-full rounded-md py-2.5 text-center text-[13px] font-bold shadow-[0_8px_18px_rgba(0,125,204,.24)]"
        >
          View details
        </Link>
      </div>
    </div>
  );
}
