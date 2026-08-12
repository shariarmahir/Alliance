import Image from "next/image";
import Link from "next/link";
import { categories } from "@/app/lib/mock-data";

const CARD_THEMES = [
  { gradient: "from-primary/15 via-primary/5 to-transparent", ring: "group-hover:ring-primary/30" },
  { gradient: "from-accent/20 via-accent/5 to-transparent", ring: "group-hover:ring-accent/30" },
  { gradient: "from-emerald-500/15 via-emerald-500/5 to-transparent", ring: "group-hover:ring-emerald-500/30" },
  { gradient: "from-violet-500/15 via-violet-500/5 to-transparent", ring: "group-hover:ring-violet-500/30" },
  { gradient: "from-rose-500/15 via-rose-500/5 to-transparent", ring: "group-hover:ring-rose-500/30" },
  { gradient: "from-sky-500/15 via-sky-500/5 to-transparent", ring: "group-hover:ring-sky-500/30" },
  { gradient: "from-amber-500/15 via-amber-500/5 to-transparent", ring: "group-hover:ring-amber-500/30" },
  { gradient: "from-teal-500/15 via-teal-500/5 to-transparent", ring: "group-hover:ring-teal-500/30" },
];

export function CategoryGrid() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-10">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">Top Categories</h2>
        <Link href="/products" className="text-sm font-medium text-primary hover:underline">
          Browse All
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-8">
        {categories.map((c, i) => {
          const theme = CARD_THEMES[i % CARD_THEMES.length];
          return (
            <Link
              key={c.slug}
              href={`/products?category=${c.slug}`}
              className={`group relative flex flex-col items-center gap-1.5 overflow-hidden rounded-xl border border-slate-200 bg-white p-3 text-center shadow-sm ring-1 ring-transparent transition-all hover:-translate-y-0.5 hover:shadow-lg ${theme.ring}`}
            >
              <div
                className={`pointer-events-none absolute inset-0 bg-linear-to-br ${theme.gradient} opacity-0 transition-opacity duration-300 group-hover:opacity-100`}
              />
              <div
                className="pointer-events-none absolute inset-0 opacity-[0.04]"
                style={{
                  backgroundImage: "radial-gradient(circle at 1px 1px, currentColor 1px, transparent 0)",
                  backgroundSize: "14px 14px",
                }}
              />
              <span className="relative flex size-14 items-center justify-center rounded-full bg-primary/10 transition-colors group-hover:bg-primary/20">
                <Image src={c.icon} alt="" width={28} height={28} />
              </span>
              <span className="relative text-xs font-semibold leading-snug text-slate-900">{c.name}</span>
              <span className="relative text-[11px] text-slate-500">{c.productCount} products</span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
