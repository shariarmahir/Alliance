import Link from "next/link";
import Image from "next/image";
import type { Product } from "@/app/lib/types";

// Catalog card in the landing page's "Most requested parts" language: image
// panel with a corner stock badge, brand kicker, mono part number, description,
// then a single "View details" link to the product page. Differs from
// TopSellerCard because catalog products carry no rating/review data — the
// spec chips fill that slot instead. Unlike the top-sellers card, this one
// doesn't jump straight to "Ask Price" — the listing is a browse surface, so
// it sends shoppers to the detail page first, where the quote flow lives.

const STOCK_BADGE: Record<Product["stock"], { cls: string; label: (q: number) => string }> = {
  "in-stock": { cls: "bg-ok-bg text-ok", label: (q) => `IN STOCK ${q}` },
  "low-stock": { cls: "bg-warn-bg text-warn", label: (q) => `LOW STOCK ${q}` },
  "out-of-stock": { cls: "bg-[#f2f4f7] text-ink-muted", label: () => "5–7 DAYS" },
};

export function ProductGridCard({ product }: { product: Product }) {
  const href = `/products/${product.slug}`;
  const badge = STOCK_BADGE[product.stock];

  return (
    <div className="group flex flex-col overflow-hidden rounded-[10px] border border-slate-line bg-white transition-all duration-300 hover:-translate-y-[3px] hover:border-primary hover:shadow-[0_12px_28px_rgba(16,25,45,.1)]">
      <Link href={href} className="block">
        <div className="relative flex h-28 items-center justify-center border-b border-hairline bg-surface sm:h-[158px]">
          <Image
            src={product.image}
            alt={product.name}
            fill
            sizes="(min-width: 1536px) 20vw, (min-width: 1024px) 25vw, (min-width: 640px) 50vw, 50vw"
            className="object-contain p-2 transition-transform duration-500 group-hover:scale-105 sm:p-3"
          />
          <span
            className={`absolute right-1.5 top-1.5 rounded px-1.5 py-0.5 font-mono text-[8.5px] font-semibold sm:right-2.5 sm:top-2.5 sm:px-2.5 sm:py-1 sm:text-[10px] ${badge.cls}`}
          >
            {badge.label(product.stockQty)}
          </span>
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-2.5 sm:p-4">
        <p className="mb-1 truncate font-mono text-[9px] font-semibold uppercase tracking-[0.08em] text-primary sm:mb-1.5 sm:text-[10.5px]">
          {product.brand.replace(/-/g, " ")}
        </p>
        <Link href={href}>
          <p className="mb-1 truncate font-mono text-[12.5px] font-semibold text-ink transition-colors group-hover:text-primary sm:text-[15px]">
            {product.partNumber}
          </p>
        </Link>
        <p className="mb-2 line-clamp-2 text-[11px] leading-[1.45] text-[#64748b] sm:mb-2.5 sm:text-[12.5px] sm:leading-[1.5]">
          {product.name}
        </p>

        {/* Catalog products have no ratings; the first two spec chips carry the
            same visual weight the star row does on the landing page. Hidden
            below sm — a two-up card is too narrow for even one truncated chip
            to read as information rather than noise. */}
        <div className="mb-3.5 hidden flex-wrap gap-1.5 sm:flex">
          {product.shortSpecs.slice(0, 2).map((s) => (
            <span
              key={s}
              className="truncate rounded-[5px] bg-[#f2f4f7] px-2 py-1 font-mono text-[10.5px] font-medium text-ink-muted"
            >
              {s}
            </span>
          ))}
        </div>

        <Link
          href={href}
          className="btn-glass mt-auto w-full rounded-md py-2 text-center text-[11.5px] font-bold shadow-[0_8px_18px_rgba(0,125,204,.24)] sm:py-2.5 sm:text-[13px]"
        >
          View details
        </Link>
      </div>
    </div>
  );
}
