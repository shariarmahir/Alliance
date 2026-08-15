import Image from "next/image";
import Link from "next/link";
import { categories } from "@/app/lib/mock-data";

export function CategoryGrid() {
  return (
    <section className="mx-auto max-w-[1360px] px-7 py-13 md:px-[68px]">
      <div className="mb-6 flex items-baseline justify-between">
        <h2 className="text-2xl font-bold tracking-[-0.02em] text-ink sm:text-[27px]">Shop by category</h2>
        <Link
          href="/products"
          className="border-b border-[#b9dcf3] text-[13px] font-medium text-primary hover:text-primary-dark"
        >
          Browse all {categories.length} categories
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {categories.map((c) => (
          <Link
            key={c.slug}
            href={`/products?category=${c.slug}`}
            className="flex items-center gap-4 rounded-[10px] border border-slate-line bg-white p-4.5 transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-[0_8px_22px_rgba(0,125,204,.12)]"
          >
            <span className="flex size-14 shrink-0 items-center justify-center rounded-md bg-surface-blue">
              <Image src={c.icon} alt="" width={34} height={34} />
            </span>
            <span className="min-w-0">
              <strong className="block text-[14.5px] font-semibold text-ink">{c.name}</strong>
              <span className="font-mono text-xs text-[#8a94a6]">{c.productCount} parts</span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
