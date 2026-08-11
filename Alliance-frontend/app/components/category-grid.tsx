import Image from "next/image";
import Link from "next/link";
import { categories } from "@/app/lib/mock-data";

export function CategoryGrid() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-12">
      <h2 className="mb-6 text-2xl font-bold text-slate-900">Top Categories</h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-8">
        {categories.map((c) => (
          <Link
            key={c.slug}
            href={`/products?category=${c.slug}`}
            className="group flex flex-col items-center gap-2 rounded-xl border border-slate-200 bg-white p-4 text-center transition-shadow hover:shadow-lg"
          >
            <span className="flex size-16 items-center justify-center rounded-full bg-primary/10 transition-colors group-hover:bg-primary/20">
              <Image src={c.icon} alt="" width={32} height={32} />
            </span>
            <span className="text-sm font-medium text-slate-900">{c.name}</span>
            <span className="text-xs text-slate-500">{c.productCount} products</span>
          </Link>
        ))}
      </div>
    </section>
  );
}
