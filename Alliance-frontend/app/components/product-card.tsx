import Link from "next/link";
import Image from "next/image";
import type { Product } from "@/app/lib/types";
import { RequestQuoteButton } from "@/app/components/request-quote-button";

// Availability copy in the bundle names the fulfilment route, not just a
// stock level — each state carries its own dot colour and dispatch note.
const availability: Record<Product["stock"], { dot: string; text: string; label: (q: number) => string }> = {
  "in-stock": {
    dot: "bg-ok-dot",
    text: "text-ok",
    label: (q) => `In stock — ${q} units`,
  },
  "low-stock": {
    dot: "bg-accent",
    text: "text-warn",
    label: (q) => `Low stock — ${q} units`,
  },
  "out-of-stock": {
    dot: "bg-[#9aa6b6]",
    text: "text-ink-muted",
    label: () => "Sourced to order — 5–7 days",
  },
};

const dispatchNote: Record<Product["stock"], string> = {
  "in-stock": "Dispatches today from Dhaka\nAir freight 3–5 days worldwide",
  "low-stock": "Bench-tested, 2-year warranty\nDispatch within 24 hours",
  "out-of-stock": "Ask an engineer about tested\nequivalents held in Dhaka",
};

const conditionBadge: Record<Product["stock"], { bg: string; fg: string; label: string }> = {
  "in-stock": { bg: "bg-tint", fg: "text-[#00618f]", label: "NEW SEALED" },
  "low-stock": { bg: "bg-warn-bg", fg: "text-warn", label: "TESTED SURPLUS" },
  "out-of-stock": { bg: "bg-[#f2f4f7]", fg: "text-ink-muted", label: "OBSOLETE SERIES" },
};

export function ProductCard({ product }: { product: Product }) {
  const href = `/products/${product.slug}`;
  const avail = availability[product.stock];
  const badge = conditionBadge[product.stock];

  return (
    <div className="grid grid-cols-1 gap-5 rounded-[10px] border border-slate-line bg-white p-[18px] transition-all hover:border-primary hover:shadow-[0_8px_22px_rgba(16,25,45,.08)] md:grid-cols-[132px_1fr] lg:grid-cols-[132px_1fr_232px]">
      <Link
        href={href}
        className="flex h-28 items-center justify-center overflow-hidden rounded-md border border-hairline bg-surface"
      >
        <Image
          src={product.image}
          alt={product.name}
          width={132}
          height={112}
          className="size-full object-contain p-2"
        />
      </Link>

      <div className="min-w-0">
        <div className="mb-1.5 flex flex-wrap items-center gap-2.5">
          <span className="mono-label text-[10.5px] text-primary">{product.brand}</span>
          <span className={`rounded px-1.5 py-0.5 font-mono text-[9.5px] font-semibold ${badge.bg} ${badge.fg}`}>
            {badge.label}
          </span>
        </div>
        <Link href={href}>
          <p className="mb-1.5 font-mono text-lg font-semibold text-ink transition-colors hover:text-primary">
            {product.partNumber}
          </p>
        </Link>
        <p className="mb-2.5 max-w-[520px] text-[13px] leading-[1.6] text-ink-muted">{product.name}</p>
        <div className="flex flex-wrap gap-1.5">
          {product.shortSpecs.slice(0, 5).map((s) => (
            <span
              key={s}
              className="rounded-[5px] bg-[#f2f4f7] px-2.5 py-1 font-mono text-[11px] font-medium text-ink-muted"
            >
              {s}
            </span>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2.5 lg:border-l lg:border-hairline lg:pl-5">
        <span className={`inline-flex items-center gap-1.5 text-[12.5px] font-semibold ${avail.text}`}>
          <span className={`size-[7px] rounded-full ${avail.dot}`} />
          {avail.label(product.stockQty)}
        </span>
        <span className="whitespace-pre-line text-xs leading-[1.6] text-[#8a94a6]">
          {dispatchNote[product.stock]}
        </span>
        <RequestQuoteButton product={product} withStepper />
        <Link href={href} className="text-center text-xs font-semibold text-primary hover:underline">
          View full details
        </Link>
      </div>
    </div>
  );
}
