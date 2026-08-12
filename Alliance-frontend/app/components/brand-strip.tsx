import Image from "next/image";
import Link from "next/link";
import { brands } from "@/app/lib/mock-data";

export function BrandStrip() {
  return (
    <section className="border-y border-slate-200 bg-slate-50 py-8">
      <div className="mx-auto max-w-7xl px-4">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Popular Brands Available</h2>
          <Link href="/products" className="text-sm font-medium text-primary hover:underline">
            Browse All
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {brands.map((b) => (
            <Link
              key={b.slug}
              href={`/products?brand=${b.slug}`}
              className="relative aspect-3/2 overflow-hidden rounded-lg border border-slate-200 bg-white p-5 transition-all hover:shadow-md"
            >
              <Image src={b.logo} alt={b.name} fill sizes="200px" className="object-contain p-2" />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
