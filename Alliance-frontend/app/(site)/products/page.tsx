import Link from "next/link";
import { getBrands, getCategories, getProducts } from "@/app/lib/catalog-data";
import { ProductGridCard } from "@/app/components/product-grid-card";
import { ProductFilters } from "@/app/components/product-filters";

const PAGE_SIZE = 24;

export const metadata = {
  title: "Industrial Automation Parts & Spares",
  description:
    "Browse AutoLink's catalogue of PLCs, VFDs, servo drives, HMIs, sensors and power system electronics from Siemens, Omron, Mitsubishi, Allen-Bradley, Schneider Electric and Danfoss. Shipped worldwide from Dhaka, Bangladesh.",
  alternates: { canonical: "/products" },
};

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; brand?: string; q?: string; inStock?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const [categories, brands, { items: products }] = await Promise.all([
    getCategories(),
    getBrands(),
    // One page covers this catalog; the filters narrow it client-side.
    getProducts({ pageSize: 100 }),
  ]);
  let filtered = products;
  if (sp.category) filtered = filtered.filter((p) => p.categorySlug === sp.category);
  if (sp.brand) filtered = filtered.filter((p) => p.brand === sp.brand);
  if (sp.inStock === "true") filtered = filtered.filter((p) => p.stock !== "out-of-stock");
  if (sp.q) {
    const q = sp.q.toLowerCase();
    filtered = filtered.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.partNumber.toLowerCase().includes(q) ||
        p.brand.toLowerCase().replace(/-/g, " ").includes(q) ||
        p.alternatePartNumbers.some((alt) => alt.toLowerCase().includes(q))
    );
  }

  const page = Math.max(1, Number(sp.page ?? "1"));
  const start = (page - 1) * PAGE_SIZE;
  const paged = filtered.slice(start, start + PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  const activeCategory = categories.find((c) => c.slug === sp.category);
  const heading = activeCategory?.name ?? "All products";

  return (
    <div className="mx-auto max-w-[1360px] px-7 pb-9 pt-4">
      <nav className="mb-4 text-xs text-[#8a94a6]">
        <Link href="/" className="hover:text-primary">
          Home
        </Link>
        <span className="mx-1.5 text-[#c8d0da]">/</span>
        <Link href="/products" className="hover:text-primary">
          All products
        </Link>
        {activeCategory && (
          <>
            <span className="mx-1.5 text-[#c8d0da]">/</span>
            <span className="text-ink">{activeCategory.name}</span>
          </>
        )}
      </nav>

      <div className="min-w-0">
        <h1 className="mb-1.5 text-[25px] font-bold tracking-[-0.02em] text-ink">{heading}</h1>
        <p className="mb-[18px] max-w-[760px] text-[13.5px] leading-[1.7] text-ink-muted">
          Processors, I/O modules, racks and communication cards for discrete and process control — new,
          factory-sealed and function-tested surplus, with obsolete series kept on the shelf.
        </p>

        <ProductFilters categories={categories} brands={brands} />

        <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3 rounded-[9px] border border-slate-line bg-surface px-3.5 py-2.5">
          <span className="text-[12.5px] text-ink-muted">
            Showing{" "}
            <strong className="text-ink">
              {filtered.length === 0 ? 0 : start + 1}–{Math.min(start + PAGE_SIZE, filtered.length)}
            </strong>{" "}
            of <strong className="text-ink">{filtered.length}</strong> results
          </span>
          <div className="flex items-center gap-3 text-[12.5px] text-ink-muted">
            <span>
              Per page <strong className="text-ink">{PAGE_SIZE}</strong>
            </span>
            <span>
              Sort <strong className="text-ink">Relevance</strong>
            </span>
          </div>
        </div>

        {/* Five per row from xl up, stepping down to two on phones — same card
            language as the landing page's "Most requested parts". 5-up lands on
            xl (1280px) rather than 2xl: the container caps at 1360px, so by xl
            it is already near full width and five 248px cards fit comfortably;
            waiting for 2xl (1536px) would show four 314px cards on a 1440px
            screen that has the room for five. Base is 2 columns (not 1) so
            phones aren't stuck with a single full-width card; the gap tightens
            below sm since two ~160px cards need the space back. */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3 xl:grid-cols-5">
          {paged.map((p) => (
            <ProductGridCard key={p.slug} product={p} />
          ))}
        </div>

        {filtered.length === 0 && (
          <p className="rounded-[10px] border border-slate-line bg-surface px-5 py-10 text-center text-sm text-ink-muted">
            No parts matched those filters. Try a broader part number, or{" "}
            <Link href="/contact" className="font-semibold text-primary hover:underline">
              ask an engineer
            </Link>
            .
          </p>
        )}

        {totalPages > 1 && (
          <div className="mt-5 flex items-center justify-between">
            <span className="text-[12.5px] text-[#8a94a6]">
              Page {page} of {totalPages}
            </span>
            <div className="flex gap-1.5 text-[12.5px] font-semibold">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                <a
                  key={n}
                  href={`?${new URLSearchParams({ ...sp, page: String(n) } as Record<string, string>).toString()}`}
                  className={`flex size-[34px] items-center justify-center rounded-[7px] ${
                    n === page
                      ? "bg-primary text-white"
                      : "border border-[#dde3ea] text-ink-soft hover:border-primary hover:text-primary"
                  }`}
                >
                  {n}
                </a>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
