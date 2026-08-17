import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProductBySlug, getRelatedProducts } from "@/app/lib/mock-data";
import { ProductGallery } from "@/app/components/product-gallery";
import { ProductDetailTabs } from "@/app/components/product-detail-tabs";
import { QuoteCta } from "@/app/components/quote-cta";
import type { Product } from "@/app/lib/types";

// Status pills across the top of the buy column — colour-coded per the bundle.
const stockPill: Record<Product["stock"], { bg: string; fg: string; dot: string; label: (q: number) => string }> = {
  "in-stock": {
    bg: "bg-ok-bg",
    fg: "text-ok",
    dot: "bg-ok-dot",
    label: (q) => `In stock — ${q} units`,
  },
  "low-stock": {
    bg: "bg-warn-bg",
    fg: "text-warn",
    dot: "bg-accent",
    label: (q) => `Low stock — ${q} units`,
  },
  "out-of-stock": {
    bg: "bg-[#f2f4f7]",
    fg: "text-ink-soft",
    dot: "bg-[#9aa6b6]",
    label: () => "Sourced to order — 5–7 days",
  },
};

const conditionLabel: Record<Product["stock"], string> = {
  "in-stock": "New, factory sealed",
  "low-stock": "Tested surplus",
  "out-of-stock": "Obsolete series",
};

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = getProductBySlug(slug);
  if (!product) return { title: "Product Not Found" };
  return {
    title: `${product.partNumber} | ${product.name}`,
    description: product.description[0],
  };
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = getProductBySlug(slug);
  if (!product) notFound();

  const related = getRelatedProducts(slug);
  const pill = stockPill[product.stock];

  return (
    <div className="mx-auto max-w-[1360px] px-8 pb-8 pt-4.5">
      <nav className="mb-5 text-xs text-[#8a94a6]">
        <Link href="/" className="hover:text-primary">
          Home
        </Link>
        <span className="mx-1.5 text-[#c8d0da]">/</span>
        <Link href="/products" className="hover:text-primary">
          All products
        </Link>
        <span className="mx-1.5 text-[#c8d0da]">/</span>
        <span className="text-ink">{product.partNumber}</span>
      </nav>

      <div className="grid grid-cols-1 gap-11 lg:grid-cols-[520px_1fr]">
        <div>
          <ProductGallery images={product.gallery} alt={product.name} />
          <div className="mt-5 flex gap-3 rounded-[10px] border border-slate-line bg-surface p-4">
            <span className="size-[34px] shrink-0 rounded-md border border-tint-line bg-tint" />
            <span>
              <strong className="mb-1 block text-[13.5px] font-semibold text-ink">
                Not sure this is the right part?
              </strong>
              <span className="text-[12.5px] leading-[1.6] text-ink-muted">
                Send a photo of the nameplate on WhatsApp —{" "}
                <a
                  href="https://wa.me/8801713116019"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono font-semibold text-primary"
                >
                  +8801713-116019
                </a>
              </span>
            </span>
          </div>
        </div>

        <div className="min-w-0">
          <div className="mb-2.5 flex items-center gap-3">
            <span className="mono-label text-[11.5px] tracking-[0.1em] text-primary">{product.brand}</span>
            <span className="h-3 w-px bg-[#dde3ea]" />
            <span className="text-xs text-[#8a94a6]">{conditionLabel[product.stock]}</span>
          </div>

          <h1 className="mb-2 font-mono text-3xl font-bold leading-[1.05] tracking-[-0.02em] text-ink md:text-[38px]">
            {product.partNumber}
          </h1>
          <p className="mb-4 text-base leading-[1.6] text-ink-soft">{product.name}</p>

          <div className="mb-5.5 flex flex-wrap gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold ${pill.bg} ${pill.fg}`}
            >
              <span className={`size-[7px] rounded-full ${pill.dot}`} />
              {pill.label(product.stockQty)}
            </span>
            <span className="rounded-md bg-tint px-3 py-1.5 text-xs font-semibold text-[#00618f]">
              {conditionLabel[product.stock]}
            </span>
          </div>

          <div className="mb-5.5 grid grid-cols-1 gap-px overflow-hidden rounded-[10px] border border-slate-line bg-slate-line sm:grid-cols-2">
            <div className="bg-white px-4 py-3.5">
              <p className="mono-label mb-1 text-[10px] text-[#8a94a6]">CONDITION</p>
              <p className="text-[13.5px] font-semibold text-ink">{conditionLabel[product.stock]}</p>
            </div>
            <div className="bg-white px-4 py-3.5">
              <p className="mono-label mb-1 text-[10px] text-[#8a94a6]">WARRANTY</p>
              <p className="text-[13.5px] font-semibold text-ink">
                {product.warrantyYears}-year AutoLink warranty
              </p>
            </div>
            <div className="bg-white px-4 py-3.5">
              <p className="mono-label mb-1 text-[10px] text-[#8a94a6]">ALSO KNOWN AS</p>
              <p className="font-mono text-[13.5px] font-semibold text-ink">
                {product.alternatePartNumbers.length > 0
                  ? product.alternatePartNumbers.join(" · ")
                  : product.partNumber}
              </p>
            </div>
            <div className="bg-white px-4 py-3.5">
              <p className="mono-label mb-1 text-[10px] text-[#8a94a6]">REPAIR ROUTE</p>
              <p className="text-[13.5px] font-semibold text-ink">Exchange available — 5 working days</p>
            </div>
          </div>

          <QuoteCta product={product} />

          <ProductDetailTabs
            description={product.description}
            specifications={product.specifications}
            repairRoute="Cross-reference an obsolete number, check firmware revision, or arrange a repair instead of a replacement. Exchange available — 5 working days."
          />
        </div>
      </div>

      {related.length > 0 && (
        <div className="mt-10">
          <h2 className="mb-4 text-xl font-bold text-ink">Engineers also asked about</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((p) => (
              <Link
                key={p.slug}
                href={`/products/${p.slug}`}
                className="flex gap-3.5 rounded-[10px] border border-slate-line p-3.5 transition-all hover:border-primary hover:shadow-[0_8px_20px_rgba(16,25,45,.07)]"
              >
                <span className="flex size-[60px] shrink-0 items-center justify-center rounded-md bg-surface">
                  <span className="mono-label text-[10px] text-primary">{p.brand.slice(0, 3)}</span>
                </span>
                <span className="min-w-0">
                  <span className="mono-label block text-[10px] tracking-[0.07em] text-primary">{p.brand}</span>
                  <span className="my-1 block truncate font-mono text-[13px] font-semibold text-ink">
                    {p.partNumber}
                  </span>
                  <span className="line-clamp-2 text-[11.5px] text-[#8a94a6]">{p.name}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
