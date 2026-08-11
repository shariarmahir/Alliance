import Link from "next/link";
import { Phone, Mail, Search, ChevronDown } from "lucide-react";
import { categories } from "@/app/lib/mock-data";

export function Header() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="hidden bg-primary text-white sm:block">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-1.5 text-xs">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <Phone className="size-3.5" /> +8801713-116019
            </span>
            <span className="flex items-center gap-1">
              <Mail className="size-3.5" /> info@alliance.com
            </span>
          </div>
          <p>Industrial Electronics &amp; Automation Parts — Shipped Worldwide</p>
        </div>
      </div>

      <div className="mx-auto flex max-w-7xl items-center gap-6 px-4 py-3">
        <Link href="/" className="text-2xl font-bold tracking-tight text-primary">
          Alliance
        </Link>

        <nav className="hidden items-center gap-6 text-sm font-medium text-slate-700 lg:flex">
          <Link href="/" className="hover:text-primary">
            Home
          </Link>
          <Link href="/products" className="hover:text-primary">
            All Products
          </Link>
          <div className="group relative">
            <button className="flex items-center gap-1 hover:text-primary">
              Categories <ChevronDown className="size-4" />
            </button>
            <div className="invisible absolute left-0 top-full z-50 w-64 rounded-lg border border-slate-200 bg-white p-2 opacity-0 shadow-xl transition-all group-hover:visible group-hover:opacity-100">
              {categories.map((c) => (
                <Link
                  key={c.slug}
                  href={`/products?category=${c.slug}`}
                  className="block rounded-md px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-primary"
                >
                  {c.name}
                </Link>
              ))}
            </div>
          </div>
          <a href="#about" className="hover:text-primary">
            About
          </a>
          <a href="#contact" className="hover:text-primary">
            Contact
          </a>
        </nav>

        <form action="/products" method="GET" className="ml-auto hidden max-w-sm flex-1 items-center gap-2 md:flex">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              name="q"
              placeholder="Search part number or description..."
              className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm focus:border-primary focus:outline-none"
            />
          </div>
        </form>

        <Link href="/products" className="btn-glass ml-auto md:ml-0">
          Browse Catalog
        </Link>
      </div>
    </header>
  );
}
