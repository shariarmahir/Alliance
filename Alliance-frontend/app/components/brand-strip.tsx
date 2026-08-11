import Image from "next/image";
import Link from "next/link";
import { brands } from "@/app/lib/mock-data";

export function BrandStrip() {
  return (
    <section className="border-y border-slate-200 bg-slate-50 py-10">
      <div className="mx-auto max-w-7xl px-4">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-bold text-slate-900">Popular Brands Available</h2>
          <Link href="/products" className="text-sm font-medium text-primary hover:underline">
            Browse All
          </Link>
        </div>
        <div className="grid grid-cols-3 items-center gap-6 sm:grid-cols-6">
          {brands.map((b) => (
            <Link
              key={b.slug}
              href={`/products?brand=${b.slug}`}
              className="flex items-center justify-center rounded-lg border border-slate-200 bg-white p-4 grayscale transition-all hover:grayscale-0 hover:shadow-md"
            >
              <Image src={b.logo} alt={b.name} width={100} height={40} className="h-8 w-auto object-contain" />
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
