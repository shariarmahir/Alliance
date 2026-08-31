import Link from "next/link";
import { getBrands } from "@/app/lib/catalog-data";
import { BrandLogo } from "@/app/components/brand-logo";

// Two rows at the widest breakpoint (lg:grid-cols-6) is twelve cards — capped
// here rather than with CSS row limiting, so the "All 60+ manufacturers"
// link has an actual reason to exist instead of a grid that already shows
// everything.
const MAX_BRANDS = 12;

export async function BrandStrip() {
  const brands = (await getBrands()).slice(0, MAX_BRANDS);
  return (
    <section className="mx-auto max-w-[1360px] px-4 sm:px-7 py-13 md:px-[68px]">
      <div className="mb-5 flex items-baseline justify-between">
        <h2 className="text-2xl font-bold tracking-[-0.02em] text-ink sm:text-[27px]">
          Popular brands available
        </h2>
        <Link
          href="/products"
          className="border-b border-[#b9dcf3] text-[13px] font-medium text-primary hover:text-primary-dark"
        >
          All 60+ manufacturers
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        {brands.map((b) => (
          <Link
            key={b.slug}
            href={`/products?brand=${b.slug}`}
            className="relative flex h-[92px] items-center justify-center rounded-[10px] border border-slate-line bg-white p-4.5 transition-all hover:border-primary hover:shadow-[0_8px_20px_rgba(16,25,45,.08)]"
          >
            <BrandLogo slug={b.slug} name={b.name} logo={b.logo} />
          </Link>
        ))}
      </div>
    </section>
  );
}
