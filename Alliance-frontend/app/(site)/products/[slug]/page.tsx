import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getProduct, getRelatedProducts } from "@/app/lib/catalog-data";
import { ProductGallery } from "@/app/components/product-gallery";
import { ProductDetailTabs } from "@/app/components/product-detail-tabs";
import { QuoteCta } from "@/app/components/quote-cta";
import { SITE_URL } from "@/app/lib/site";
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

// Availability as schema.org states it. Derived from the same stock status
// the page shows, so the rich result cannot contradict the page it describes
// — a mismatch there is what gets structured data ignored.
const AVAILABILITY: Record<Product["stock"], string> = {
  "in-stock": "https://schema.org/InStock",
  "low-stock": "https://schema.org/LimitedAvailability",
  "out-of-stock": "https://schema.org/OutOfStock",
};

/** Absolute, because relative URLs are silently dropped from structured data. */
function absolute(path: string): string {
  return path.startsWith("http") ? path : `${SITE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) return { title: "Product Not Found" };

  // The part number is what people actually search for, so it leads the title
  // and is repeated in the description. Alternate part numbers matter just as
  // much: a buyer cross-referencing an equivalent code should land here.
  const description =
    `${product.partNumber} — ${product.name}. ` +
    (product.description[0] ?? "") +
    ` Request a quotation from AutoLink, Dhaka. Shipped worldwide.`;

  return {
    title: `${product.partNumber} | ${product.name}`,
    description: description.slice(0, 300),
    // Without this the page is reachable at filter/query variants that all
    // look like duplicate content to a crawler.
    alternates: { canonical: `/products/${product.slug}` },
    keywords: [
      product.partNumber,
      product.name,
      ...product.alternatePartNumbers,
      product.brand,
      `${product.partNumber} price Bangladesh`,
      `${product.partNumber} supplier Dhaka`,
    ],
    openGraph: {
      type: "website",
      title: `${product.partNumber} — ${product.name}`,
      description: product.description[0],
      url: `${SITE_URL}/products/${product.slug}`,
      images: product.image
        ? [{ url: absolute(product.image), alt: `${product.partNumber} — ${product.name}` }]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: `${product.partNumber} — ${product.name}`,
      description: product.description[0],
      images: product.image ? [absolute(product.image)] : undefined,
    },
  };
}

export default async function ProductDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();

  const related = await getRelatedProducts(product);
  const pill = stockPill[product.stock];

  // What turns a plain blue link into a rich result: brand, part number,
  // availability and specifications, expressed so Google can read them.
  //
  // Deliberately no `price`. This is a quotation-based B2B catalogue and the
  // public API omits price entirely, so there is no figure here to publish --
  // and inventing one would both leak commercial terms and be wrong. The
  // Offer still carries availability and a URL, which is what makes the
  // product eligible for a rich result; `priceSpecification` is omitted
  // rather than zeroed, because a price of 0 is a claim, and absence is not.
  const productSchema = {
    "@context": "https://schema.org",
    "@type": "Product",
    "@id": `${SITE_URL}/products/${product.slug}/#product`,
    name: `${product.partNumber} ${product.name}`.trim(),
    sku: product.partNumber,
    mpn: product.partNumber,
    description: product.description.join(" "),
    url: `${SITE_URL}/products/${product.slug}`,
    image: (product.gallery?.length ? product.gallery : [product.image])
      .filter(Boolean)
      .map(absolute),
    brand: { "@type": "Brand", name: product.brand },
    // Equivalent codes a buyer might cross-reference to reach this part.
    ...(product.alternatePartNumbers.length
      ? { alternateName: product.alternatePartNumbers }
      : {}),
    ...(Object.keys(product.specifications).length
      ? {
          additionalProperty: Object.entries(product.specifications).map(([name, value]) => ({
            "@type": "PropertyValue",
            name,
            value,
          })),
        }
      : {}),
    offers: {
      "@type": "Offer",
      url: `${SITE_URL}/products/${product.slug}`,
      availability: AVAILABILITY[product.stock],
      itemCondition: "https://schema.org/NewCondition",
      seller: { "@id": `${SITE_URL}/#organization` },
      areaServed: "Worldwide",
    },
    ...(product.warrantyYears
      ? {
          warranty: {
            "@type": "WarrantyPromise",
            durationOfWarranty: {
              "@type": "QuantitativeValue",
              value: product.warrantyYears,
              unitCode: "ANN",
            },
          },
        }
      : {}),
  };

  // Mirrors the visible breadcrumb above. Google renders this as the path
  // under the result title instead of a bare URL.
  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Home", item: SITE_URL },
      { "@type": "ListItem", position: 2, name: "All products", item: `${SITE_URL}/products` },
      {
        "@type": "ListItem",
        position: 3,
        name: product.partNumber,
        item: `${SITE_URL}/products/${product.slug}`,
      },
    ],
  };

  return (
    <div className="mx-auto max-w-[1360px] px-4 pb-8 pt-4.5 sm:px-6 lg:px-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify([productSchema, breadcrumbSchema]),
        }}
      />
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
                  href="https://wa.me/8801315770099"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono font-semibold text-primary"
                >
                  +8801315-770099
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
