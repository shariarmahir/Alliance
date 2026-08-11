import { categories, brands, products } from "@/app/lib/mock-data";
import { ProductCard } from "@/app/components/product-card";
import { ProductFilters } from "@/app/components/product-filters";

const PAGE_SIZE = 24;

export const metadata = { title: "All Products" };

export default async function ProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; brand?: string; q?: string; inStock?: string; page?: string }>;
}) {
  const sp = await searchParams;
  let filtered = products;
  if (sp.category) filtered = filtered.filter((p) => p.categorySlug === sp.category);
  if (sp.brand) filtered = filtered.filter((p) => p.brand === sp.brand);
  if (sp.inStock === "true") filtered = filtered.filter((p) => p.stock !== "out-of-stock");
  if (sp.q) {
    const q = sp.q.toLowerCase();
    filtered = filtered.filter((p) => p.name.toLowerCase().includes(q) || p.partNumber.toLowerCase().includes(q));
  }

  const page = Math.max(1, Number(sp.page ?? "1"));
  const start = (page - 1) * PAGE_SIZE;
  const paged = filtered.slice(start, start + PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">PLC &amp; Industrial Automation Controls</h1>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]">
        <ProductFilters categories={categories} brands={brands} />
        <div>
          <p className="mb-4 text-sm text-slate-600">{filtered.length} results</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {paged.map((p) => <ProductCard key={p.slug} product={p} />)}
          </div>
          {totalPages > 1 && (
            <div className="mt-8 flex justify-center gap-2">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((n) => (
                <a
                  key={n}
                  href={`?${new URLSearchParams({ ...sp, page: String(n) } as Record<string, string>).toString()}`}
                  className={`rounded-md px-3 py-1.5 text-sm ${n === page ? "bg-primary text-white" : "border border-slate-200"}`}
                >
                  {n}
                </a>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
