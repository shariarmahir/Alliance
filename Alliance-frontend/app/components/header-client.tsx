"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Globe, Phone, Mail, Menu, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import type { Category } from "@/app/lib/types";

export function HeaderClient({ categories }: { categories: Category[] }) {
  const [q, setQ] = useState("");
  const router = useRouter();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    router.push(`/products?q=${encodeURIComponent(q)}`);
  }

  return (
    <header className="sticky top-0 z-50 w-full">
      {/* Utility bar */}
      <div className="bg-slate-900 text-slate-200">
        <div className="mx-auto flex h-9 max-w-7xl items-center justify-between px-4 text-xs">
          <div className="flex items-center gap-2">
            <Globe className="size-3.5 text-accent" /> Ships Worldwide · International Industrial Electronics
          </div>
          <div className="hidden items-center gap-5 sm:flex">
            <a href="tel:+8801713116019" className="flex items-center gap-1 hover:text-accent">
              <Phone className="size-3.5" /> +8801713-116019
            </a>
            <a href="mailto:info@alliance.com" className="flex items-center gap-1 hover:text-accent">
              <Mail className="size-3.5" /> info@alliance.com
            </a>
          </div>
        </div>
      </div>

      {/* Main bar */}
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-20 max-w-7xl items-center gap-4 px-4">
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <div className="flex size-10 items-center justify-center rounded-lg bg-primary text-lg font-extrabold text-white">
              A
            </div>
            <div className="leading-none">
              <div className="text-2xl font-extrabold tracking-tight text-primary">
                Alliance<span className="text-accent">.</span>
              </div>
              <div className="text-[10px] font-medium uppercase tracking-widest text-slate-500">
                Industrial Electronics
              </div>
            </div>
          </Link>

          <form onSubmit={submit} className="mx-auto hidden w-full max-w-2xl md:flex">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by part number, brand or product..."
              className="h-11 w-full rounded-l-md border border-r-0 border-slate-300 px-4 text-sm outline-none focus:border-primary"
            />
            <button type="submit" className="btn-glass-accent flex h-11 items-center gap-2 rounded-l-none rounded-r-md px-5">
              <Search className="size-4" /> Search
            </button>
          </form>

          <Link href="/products" className="btn-glass ml-auto flex h-11 items-center">
            Browse Catalog
          </Link>
        </div>
      </div>

      {/* Category nav */}
      <div className="bg-primary text-white">
        <div className="mx-auto flex h-11 max-w-7xl items-center gap-1 overflow-x-auto px-4 text-sm font-medium">
          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-1 rounded px-3 py-1.5 hover:bg-white/15 focus:outline-none">
              <Menu className="size-4" /> All Categories <ChevronDown className="size-3.5" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              {categories.map((c) => (
                <DropdownMenuItem key={c.slug} render={<Link href={`/products?category=${c.slug}`} />}>
                  {c.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          {categories.slice(0, 6).map((c) => (
            <Link
              key={c.slug}
              href={`/products?category=${c.slug}`}
              className="whitespace-nowrap rounded px-3 py-1.5 hover:bg-white/15"
            >
              {c.name}
            </Link>
          ))}
          <Link href="/products" className="whitespace-nowrap rounded px-3 py-1.5 hover:bg-white/15">
            All Products
          </Link>
        </div>
      </div>
    </header>
  );
}
