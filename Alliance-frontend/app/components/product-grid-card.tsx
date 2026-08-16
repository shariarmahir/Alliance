import Link from "next/link";
import Image from "next/image";
import type { Product } from "@/app/lib/types";
import { RequestQuoteButton } from "@/app/components/request-quote-button";

// Catalog card in the landing page's "Most requested parts" language: image
// panel with a corner stock badge, brand kicker, mono part number, description,
// then the Ask Price row. Differs from TopSellerCard because catalog products
// carry no rating/review data — the spec chips fill that slot instead.

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
        <div className="relative flex h-[158px] items-center justify-center border-b border-hairline bg-surface">
          <Image
            src={product.image}
            alt={product.name}
            fill
            sizes="(min-width: 1536px) 20vw, (min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"
            className="object-contain p-3 transition-transform duration-500 group-hover:scale-105"
          />
          <span
            className={`absolute right-2.5 top-2.5 rounded px-2.5 py-1 font-mono text-[10px] font-semibold ${badge.cls}`}
          >
            {badge.label(product.stockQty)}
          </span>
        </div>
      </Link>

      <div className="flex flex-1 flex-col p-4">
        <p className="mb-1.5 font-mono text-[10.5px] font-semibold uppercase tracking-[0.08em] text-primary">
          {product.brand.replace(/-/g, " ")}
        </p>
        <Link href={href}>
          <p className="mb-1 truncate font-mono text-[15px] font-semibold text-ink transition-colors group-hover:text-primary">
            {product.partNumber}
          </p>
        </Link>
        <p className="mb-2.5 line-clamp-2 text-[12.5px] leading-[1.5] text-[#64748b]">
          {product.name}
        </p>

        {/* Catalog products have no ratings; the first two spec chips carry the
            same visual weight the star row does on the landing page. */}
        <div className="mb-3.5 flex flex-wrap gap-1.5">
          {product.shortSpecs.slice(0, 2).map((s) => (
            <span
              key={s}
              className="truncate rounded-[5px] bg-[#f2f4f7] px-2 py-1 font-mono text-[10.5px] font-medium text-ink-muted"
            >
              {s}
            </span>
          ))}
        </div>

        <div className="mt-auto flex gap-2">
          {/* className replaces the button's default classes rather than
              merging, so the full list is passed here. */}
          <RequestQuoteButton
            product={product}
            className="btn-glass flex-1 rounded-md py-2.5 text-[13px] font-bold shadow-[0_8px_18px_rgba(0,125,204,.24)]"
          />
          <Link
            href={href}
            aria-label={`View details for ${product.partNumber}`}
            className="inline-flex w-[42px] shrink-0 items-center justify-center rounded-md border border-[#dde3ea] text-[15px] font-semibold text-[#64748b] transition-colors hover:border-primary hover:text-primary"
          >
            +
          </Link>
        </div>
      </div>
    </div>
  );
}
