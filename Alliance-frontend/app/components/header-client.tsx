"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Globe, Phone, Mail, Menu, ChevronDown, User, MessageCircle, X } from "lucide-react";
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
      {/* Utility bar */}
      <div className="border-b border-slate-200 bg-slate-50 text-slate-600">
        <div className="mx-auto flex h-10 max-w-7xl items-center justify-between px-4 text-xs">
          <div className="flex items-center gap-5">
            <a href="tel:+8801713116019" className="flex items-center gap-1.5 font-medium hover:text-primary">
              <Phone className="size-3.5 text-primary" /> +8801713-116019
            </a>
            <a
              href="mailto:info@autolink.com"
              className="hidden items-center gap-1.5 font-medium hover:text-primary sm:flex"
            >
              <Mail className="size-3.5 text-primary" /> info@autolink.com
            </a>
            <span className="hidden items-center gap-1.5 text-primary md:flex">
              <Globe className="size-3.5" /> Ships Worldwide
            </span>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden items-center gap-3 border-r border-slate-300 pr-4 sm:flex">
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="AutoLink on Facebook"
                className="text-slate-500 transition-colors hover:text-primary"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="size-3.5">
                  <path d="M13.5 21v-8.06h2.7l.4-3.14h-3.1V7.94c0-.91.25-1.53 1.56-1.53h1.66V3.6C15.9 3.5 15 3.44 13.94 3.44c-2.42 0-4.08 1.48-4.08 4.19v2.34H7.15v3.14h2.71V21h3.64Z" />
                </svg>
              </a>
              <a
                href="https://linkedin.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="AutoLink on LinkedIn"
                className="text-slate-500 transition-colors hover:text-primary"
              >
                <svg viewBox="0 0 24 24" fill="currentColor" className="size-3.5">
                  <path d="M6.94 8.5H3.56V20.5H6.94V8.5ZM5.25 3.5a1.97 1.97 0 1 0 0 3.94A1.97 1.97 0 0 0 5.25 3.5ZM20.44 20.5v-6.6c0-3.54-1.89-5.19-4.41-5.19-2.03 0-2.94 1.12-3.45 1.9V8.5H9.2c.05 1 0 12 0 12h3.38v-6.7c0-.36.03-.72.13-.98.29-.72.95-1.47 2.06-1.47 1.46 0 2.04 1.11 2.04 2.74v6.41h3.63Z" />
                </svg>
              </a>
              <a
                href="https://wa.me/8801713116019"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="AutoLink on WhatsApp"
                className="text-slate-500 transition-colors hover:text-primary"
              >
                <MessageCircle className="size-3.5" />
              </a>
            </div>
            <span className="font-medium text-slate-500">English (USD $)</span>
          </div>
        </div>
      </div>

      {/* Main bar */}
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 md:h-20 md:gap-4">
          <Link href="/" className="flex shrink-0 items-center gap-1.5">
            <Image
              src="/logo-mark.png"
              alt="AutoLink Integrated Technologies"
              width={44}
              height={44}
              priority
              className="size-9 shrink-0 object-contain md:size-11"
            />
            <div className="leading-none">
              <div className="text-xl font-extrabold tracking-tight text-primary md:text-2xl">
                AutoLink<span className="text-accent">.</span>
              </div>
              <div className="mt-0.5 hidden text-[9px] font-medium uppercase tracking-[0.14em] text-slate-400 sm:block">
                Integrated Technologies
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

          <div className="ml-auto hidden shrink-0 items-center gap-3 md:flex">
            <Link
              href="/admin/login"
              className="flex h-11 items-center gap-2 rounded-full border border-slate-300 px-4 text-sm font-semibold text-slate-700 transition-all hover:border-primary hover:text-primary hover:shadow-sm"
            >
              <User className="size-4" />
              <span className="hidden sm:inline">Login</span>
            </Link>
            <Link
              href="/quote"
              className="flex h-11 items-center gap-2 rounded-lg bg-[#10192d] px-4 text-sm font-semibold text-white transition-colors hover:bg-[#1a2740]"
            >
              Price Requests
              {count > 0 && (
                <span className="flex min-w-5 items-center justify-center rounded-full bg-accent px-1.5 py-0.5 text-xs font-bold text-[#10192d]">
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
              <a href="mailto:info@autolink.com" className="flex items-center gap-2 text-slate-700">
                <Mail className="size-4" /> info@autolink.com
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Category nav (desktop/tablet) */}
      <div className="hidden bg-primary text-white md:block">
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
