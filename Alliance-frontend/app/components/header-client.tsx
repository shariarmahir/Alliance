"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Phone, Mail, Menu, User, MessageCircle, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import { useQuote } from "@/app/lib/quote-context";
import type { Category } from "@/app/lib/types";

export function HeaderClient({ categories }: { categories: Category[] }) {
  const [q, setQ] = useState("");
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const router = useRouter();
  const { count } = useQuote();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    router.push(`/products?q=${encodeURIComponent(q)}`);
    setMobileSearchOpen(false);
    setMobileMenuOpen(false);
  }

  return (
    <header className="sticky top-0 z-50 w-full">
      {/* Utility strip */}
      <div className="border-b border-slate-line bg-surface-blue text-[#4c5a72]">
        <div className="mx-auto flex h-[34px] max-w-[1360px] items-center justify-between px-7 text-[11.5px]">
          <div className="flex items-center gap-5">
            <a href="tel:+8801713116019" className="credit-shine font-mono font-bold">
              +8801713-116019
            </a>
            <a href="mailto:info@auto-bd.com" className="hidden hover:text-primary sm:block">
              info@auto-bd.com
            </a>
          </div>
          <div className="hidden font-semibold text-primary lg:block">
            Same-day dispatch on stocked parts · Ships to 100+ countries
          </div>
          <div className="flex items-center gap-3.5">
            <span>BD · BDT</span>
            <span className="text-[#c3ccd8]">|</span>
            <Link
              href="/track"
              className="btn-sheen inline-flex items-center justify-center rounded-full bg-primary px-3 py-[3px] text-[11px] font-semibold text-white shadow-sm shadow-primary/30 transition-all hover:-translate-y-px hover:bg-primary-dark hover:shadow-md hover:shadow-primary/40"
            >
              Track an order
            </Link>
          </div>
        </div>
      </div>

      {/* Main bar */}
      <div className="bg-white">
        <div className="mx-auto flex h-16 max-w-[1360px] items-center gap-6 px-7 md:h-[76px]">
          <Link href="/" className="flex shrink-0 items-center gap-2.5">
            <Image
              src="/logo-mark.png"
              alt="AutoLink Integrated Technologies"
              width={44}
              height={44}
              priority
              className="size-9 shrink-0 object-contain"
            />
            {/* Wordmark stays dominant; the registered name sits under it as a
                lockup line, hidden on narrow screens where the search bar and
                actions need the width. */}
            <span className="leading-none">
              <span className="block text-xl font-bold tracking-[-0.02em] text-ink md:text-2xl">
                AutoLink<span className="text-accent">.</span>
              </span>
              <span className="mono-label mt-0.5 hidden text-[8.5px] tracking-[0.14em] text-ink-muted lg:block">
                Integrated Technologies
              </span>
            </span>
          </Link>

          <form
            onSubmit={submit}
            className="mx-auto hidden h-11 w-full flex-1 overflow-hidden rounded-md border-[1.5px] border-primary md:flex"
          >
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by keyword, part number or SKU"
              className="w-full flex-1 px-4 text-sm text-ink outline-none"
            />
            <button
              type="submit"
              className="w-[104px] shrink-0 bg-primary text-sm font-semibold text-white transition-colors hover:bg-primary-dark"
            >
              Search
            </button>
          </form>

          <div className="ml-auto hidden shrink-0 items-center gap-2.5 md:flex">
            <Link
              href="/admin/login"
              className="flex items-center gap-2 rounded-md border border-[#dde3ea] px-3.5 py-2.5 text-[13px] font-medium text-ink transition-colors hover:border-primary hover:text-primary"
            >
              <span className="size-2 rounded-full bg-primary" />
              My Account
            </Link>
            <Link
              href="/quote"
              className="flex items-center gap-2 rounded-md bg-ink px-3.5 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-[#1a2740]"
            >
              Price Requests
              {count > 0 && (
                <span className="flex min-w-5 items-center justify-center rounded-[10px] bg-accent px-1.5 py-0.5 font-mono text-[11px] font-bold text-ink">
                  {count}
                </span>
              )}
            </Link>
          </div>

          {/* Mobile-only controls */}
          <div className="ml-auto flex items-center gap-1 md:hidden">
            <button
              type="button"
              aria-label="Search"
              onClick={() => setMobileSearchOpen((v) => !v)}
              className="flex size-10 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100"
            >
              <Search className="size-5" />
            </button>
            <button
              type="button"
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              onClick={() => setMobileMenuOpen((v) => !v)}
              className="flex size-10 items-center justify-center rounded-lg text-slate-700 hover:bg-slate-100"
            >
              {mobileMenuOpen ? <X className="size-5" /> : <Menu className="size-5" />}
            </button>
          </div>
        </div>

        {/* Mobile search bar */}
        {mobileSearchOpen && (
          <form onSubmit={submit} className="flex gap-2 border-t border-slate-200 px-4 py-3 md:hidden">
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by part number, brand or product..."
              className="h-11 w-full rounded-md border border-slate-300 px-4 text-sm outline-none focus:border-primary"
            />
            <button type="submit" className="btn-glass-accent flex h-11 shrink-0 items-center gap-2 px-4">
              <Search className="size-4" />
            </button>
          </form>
        )}
      </div>

      {/* Mobile slide-down menu panel */}
      {mobileMenuOpen && (
        <div className="max-h-[calc(100vh-4rem)] overflow-y-auto border-b border-slate-200 bg-white px-4 py-4 md:hidden">
          <div className="flex flex-col gap-1">
            <Link
              href="/admin/login"
              onClick={() => setMobileMenuOpen(false)}
              className="flex h-11 items-center justify-center gap-2 rounded-full border border-slate-300 text-sm font-semibold text-slate-700"
            >
              <User className="size-4" /> Login
            </Link>
            <Link
              href="/products"
              onClick={() => setMobileMenuOpen(false)}
              className="btn-glass mt-2 flex h-11 items-center justify-center"
            >
              Browse Catalog
            </Link>

            <div className="mt-3 mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              Categories
            </div>
            {categories.map((c) => (
              <Link
                key={c.slug}
                href={`/products?category=${c.slug}`}
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-md px-2 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
              >
                {c.name}
              </Link>
            ))}
            <Link
              href="/products"
              onClick={() => setMobileMenuOpen(false)}
              className="rounded-md px-2 py-2 text-sm font-medium text-primary hover:bg-slate-100"
            >
              All Products
            </Link>

            <div className="mt-3 flex flex-col gap-2 border-t border-slate-200 pt-3 text-sm">
              <a href="tel:+8801713116019" className="flex items-center gap-2 text-slate-700">
                <Phone className="size-4" /> +8801713-116019
              </a>
              <a href="mailto:info@auto-bd.com" className="flex items-center gap-2 text-slate-700">
                <Mail className="size-4" /> info@auto-bd.com
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Nav row (desktop/tablet) */}
      <div className="hidden border-y border-slate-line bg-white md:block">
        <div className="mx-auto flex max-w-[1360px] items-stretch justify-between px-7">
          <div className="flex items-center gap-7 text-[13.5px] font-medium text-ink">
            <DropdownMenu>
              <DropdownMenuTrigger className="flex items-center gap-2.5 border-b-2 border-accent py-3.5 font-semibold focus:outline-none">
                <span className="flex flex-col gap-[3px]">
                  <span className="h-0.5 w-3.5 bg-ink" />
                  <span className="h-0.5 w-3.5 bg-ink" />
                  <span className="h-0.5 w-3.5 bg-ink" />
                </span>
                All Products
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-64">
                {categories.map((c) => (
                  <DropdownMenuItem key={c.slug} render={<Link href={`/products?category=${c.slug}`} />}>
                    {c.name}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            <Link href="/products" className="py-3.5 transition-colors hover:text-primary">
              Brands &amp; Manufacturers
            </Link>
            <Link href="/#services" className="py-3.5 transition-colors hover:text-primary">
              Repair &amp; Exchange
            </Link>
            <Link href="/#services" className="py-3.5 transition-colors hover:text-primary">
              Services
            </Link>
            <Link href="/contact" className="py-3.5 transition-colors hover:text-primary">
              Sell Us Your Parts
            </Link>
            <Link href="/contact" className="py-3.5 transition-colors hover:text-primary">
              About AutoLink
            </Link>
          </div>
          <a
            href="https://wa.me/8801713116019"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden items-center gap-2.5 text-[11.5px] leading-tight text-[#64748b] lg:flex"
          >
            <span className="flex size-[30px] items-center justify-center rounded-full bg-[#e9eef4]">
              <MessageCircle className="size-3.5 text-primary" />
            </span>
            <span>
              <strong className="block font-mono text-[13px] font-semibold text-primary">
                +8801713-116019
              </strong>
              Engineers on WhatsApp, 24/7
            </span>
          </a>
        </div>
      </div>
    </header>
  );
}
