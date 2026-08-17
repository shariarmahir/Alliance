import Image from "next/image";
import Link from "next/link";
import { getAllCategories } from "@/app/lib/mock-data";

export async function CategoryGrid() {
  const categories = await getAllCategories();
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
      {/* Four per row from the base breakpoint up, so phones aren't stuck
          with one full-width row per category, stepping to 6 then 8 as the
          viewport widens. The card stays stacked (icon on top, name below,
          centered) at every width rather than switching to icon-beside-name
          from sm — with 8 categories in a row, a name like "PLCs & Machine
          Control" or "Contactors & Starters" never fits beside a fixed-size
          icon in a narrow column without wrapping into the icon or the parts
          count below it. Stacked, the name gets the card's full width to
          wrap into instead. */}
      <div className="grid grid-cols-4 gap-2 sm:gap-4 md:grid-cols-6 lg:grid-cols-8">
        {categories.map((c) => (
          <Link
            key={c.slug}
            href={`/products?category=${c.slug}`}
            className="flex flex-col items-center gap-2 rounded-[10px] border border-slate-line bg-white p-2.5 text-center transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-[0_8px_22px_rgba(0,125,204,.12)] sm:gap-2.5 sm:p-4"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-surface-blue sm:size-13">
              <Image src={c.icon} alt="" width={22} height={22} className="sm:h-7.5 sm:w-7.5" />
            </span>
            <span className="min-w-0">
              <strong className="line-clamp-2 text-[10.5px] font-semibold text-ink sm:text-[13px] sm:leading-[1.3]">
                {c.name}
              </strong>
              <span className="mt-0.5 hidden font-mono text-[11px] text-[#8a94a6] sm:block">
                {c.productCount} parts
              </span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
