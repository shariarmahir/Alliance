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
      {/* Four per row from the base breakpoint up, so phones aren't stuck
          with one full-width row per category. Below sm the card switches
          from the horizontal icon+label layout to a stacked one — a quarter-
          width mobile card is too narrow for "icon beside two text lines" to
          stay legible, so the icon centers on top and the label sits below,
          restoring the original horizontal layout from sm up.
          Jumping straight from 4 to 8 columns at lg left a tablet-width gap
          (4 columns, horizontal layout, full names like "PLCs & Machine
          Control") where the card was too narrow for its own name and
          truncate clipped it to "P...". md:grid-cols-6 fills that gap. */}
      <div className="grid grid-cols-4 gap-2 sm:gap-4 md:grid-cols-6 lg:grid-cols-8">
        {categories.map((c) => (
          <Link
            key={c.slug}
            href={`/products?category=${c.slug}`}
            className="flex flex-col items-center gap-2 rounded-[10px] border border-slate-line bg-white p-2.5 text-center transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-[0_8px_22px_rgba(0,125,204,.12)] sm:flex-row sm:items-center sm:gap-4 sm:p-4.5 sm:text-left"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-surface-blue sm:size-14">
              <Image src={c.icon} alt="" width={22} height={22} className="sm:h-8.5 sm:w-8.5" />
            </span>
            <span className="min-w-0">
              <strong className="block truncate text-[10.5px] font-semibold text-ink sm:line-clamp-2 sm:overflow-visible sm:text-[14.5px] sm:leading-[1.3] sm:whitespace-normal">
                {c.name}
              </strong>
              <span className="hidden font-mono text-xs text-[#8a94a6] sm:block">
                {c.productCount} parts
              </span>
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
