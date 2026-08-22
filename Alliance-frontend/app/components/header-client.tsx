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
import { SOCIAL } from "@/app/lib/site";
import type { Category } from "@/app/lib/types";

// The brand marks are drawn here rather than imported: lucide-react dropped
// its brand icon set, and each platform's own outline is what makes the row
// legible at 13px — a generic "share" or "chat" glyph would not be recognised.
// All three are filled paths on a 24-box so they read as one set.
function BrandIcon({ path }: { path: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="size-[13px]">
      <path d={path} />
    </svg>
  );
}

const LINKEDIN_PATH =
  "M20.45 20.45h-3.56v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.94v5.67H9.35V9h3.41v1.56h.05a3.74 3.74 0 0 1 3.37-1.85c3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.07 2.07 0 1 1 0-4.13 2.07 2.07 0 0 1 0 4.13Zm1.78 13.02H3.55V9h3.57v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.72v20.56C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.72V1.72C24 .77 23.2 0 22.22 0Z";

const FACEBOOK_PATH =
  "M24 12.07C24 5.4 18.63 0 12 0S0 5.4 0 12.07C0 18.1 4.39 23.09 10.13 24v-8.44H7.08v-3.49h3.05V9.41c0-3.02 1.79-4.69 4.53-4.69 1.31 0 2.68.24 2.68.24v2.97h-1.51c-1.49 0-1.96.93-1.96 1.89v2.25h3.33l-.53 3.49h-2.8V24C19.61 23.09 24 18.1 24 12.07Z";

const WHATSAPP_PATH =
  "M12.04 2C6.58 2 2.13 6.45 2.13 11.91c0 1.75.46 3.45 1.32 4.95L2 22l5.25-1.38a9.87 9.87 0 0 0 4.79 1.22h.01c5.46 0 9.91-4.45 9.91-9.91 0-2.65-1.03-5.14-2.9-7.01A9.82 9.82 0 0 0 12.04 2Zm0 18.15h-.01a8.2 8.2 0 0 1-4.18-1.15l-.3-.18-3.11.82.83-3.04-.2-.31a8.17 8.17 0 0 1-1.26-4.38c0-4.54 3.7-8.23 8.24-8.23 2.2 0 4.27.86 5.82 2.42a8.18 8.18 0 0 1 2.41 5.82c0 4.54-3.69 8.23-8.24 8.23Zm4.52-6.16c-.25-.13-1.47-.72-1.69-.81-.23-.08-.39-.12-.56.13-.16.25-.64.81-.78.97-.15.17-.29.19-.53.06-.25-.12-1.05-.38-1.99-1.23-.74-.65-1.23-1.46-1.38-1.71-.14-.25-.01-.38.11-.5.11-.11.25-.29.37-.44.13-.15.17-.25.25-.42.08-.16.04-.31-.02-.44-.06-.12-.56-1.34-.76-1.84-.2-.48-.41-.42-.56-.43h-.48c-.16 0-.43.06-.65.31-.23.25-.86.84-.86 2.05s.88 2.38 1 2.54c.13.17 1.74 2.65 4.2 3.72.59.25 1.05.4 1.4.52.59.18 1.13.16 1.55.1.47-.07 1.47-.6 1.67-1.18.21-.58.21-1.07.15-1.18-.06-.11-.23-.17-.48-.29Z";

const SOCIALS = [
  { label: "LinkedIn", href: SOCIAL.linkedin, path: LINKEDIN_PATH },
  { label: "Facebook", href: SOCIAL.facebook, path: FACEBOOK_PATH },
  { label: "WhatsApp", href: SOCIAL.whatsapp, path: WHATSAPP_PATH },
];

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
            <a href="tel:+8801315770099" className="credit-shine font-mono font-bold">
              +8801315-770099
            </a>
            <a href="mailto:info@auto-bd.com" className="hidden hover:text-primary sm:block">
              info@auto-bd.com
            </a>
          </div>
          <div className="hidden font-semibold text-primary lg:block">
            Same-day dispatch on stocked parts · Ships to 100+ countries
          </div>
          <div className="flex items-center gap-3.5">
            <span>Bangladesh</span>
            <span className="text-[#c3ccd8]">|</span>
            {/* The three profiles carry the same sheen sweep the Track CTA used
                to, so the strip keeps its one moving element rather than
                gaining three competing ones: the delays stagger the sweep
                across the row instead of firing them in unison. */}
            <div className="flex items-center gap-1.5">
              {SOCIALS.map((social, i) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.label}
                  title={social.label}
                  className="btn-sheen inline-flex size-[22px] items-center justify-center rounded-full bg-primary text-white shadow-sm shadow-primary/30 transition-all hover:-translate-y-px hover:bg-primary-dark hover:shadow-md hover:shadow-primary/40"
                  style={{ "--sheen-delay": `${i * 0.45}s` } as React.CSSProperties}
                >
                  <BrandIcon path={social.path} />
                </a>
              ))}
            </div>
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
              <a href="tel:+8801315770099" className="flex items-center gap-2 text-slate-700">
                <Phone className="size-4" /> +8801315-770099
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
            href="https://wa.me/8801315770099"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden items-center gap-2.5 text-[11.5px] leading-tight text-[#64748b] lg:flex"
          >
            <span className="flex size-[30px] items-center justify-center rounded-full bg-[#e9eef4]">
              <MessageCircle className="size-3.5 text-primary" />
            </span>
            <span>
              <strong className="block font-mono text-[13px] font-semibold text-primary">
                +8801315-770099
              </strong>
              Engineers on WhatsApp, 24/7
            </span>
          </a>
        </div>
      </div>
    </header>
  );
}
