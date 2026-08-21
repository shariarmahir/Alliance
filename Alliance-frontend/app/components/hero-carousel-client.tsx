"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

type Slide = { image: string; headlineLine1: string; headlineLine2: string; subheadline: string };

export function HeroCarouselClient({ slides }: { slides: Slide[] }) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setActive((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(id);
  }, [slides.length]);

  return (
    <section className="relative min-h-[452px] w-full overflow-hidden bg-[#0d1626]">
      {slides.map((slide, i) => (
        <div
          key={i}
          className={`absolute inset-0 transition-opacity duration-700 ${i === active ? "opacity-100" : "pointer-events-none opacity-0"}`}
        >
          <Image
            src={slide.image}
            alt=""
            fill
            priority={i === 0}
            sizes="100vw"
            className="object-cover opacity-[0.62]"
          />
          <div className="absolute inset-0 bg-[linear-gradient(96deg,#0b1420_8%,rgba(11,20,32,.85)_44%,rgba(11,20,32,.15)_78%)]" />
        </div>
      ))}

      <div className="relative z-10 mx-auto flex min-h-[452px] max-w-[1360px] flex-col justify-center gap-5 px-7 py-12 md:px-[68px]">
        <span className="w-fit rounded-[20px] border border-white/[0.22] bg-white/[0.13] px-3.5 py-1.5 font-mono text-[11px] font-semibold uppercase tracking-[0.08em] text-[#ffd15c] backdrop-blur-sm">
          Obsolete &amp; Hard-To-Find Specialists
        </span>
        {/* The page's h1 names the business. The carousel headline cannot: it
            rotates, so the single heading search engines weigh most would keep
            changing and would never contain the brand name — which is why
            searching "autolink" found nothing. Visually hidden, not removed,
            so the design is unchanged and screen readers still get a stable
            page title. */}
        <h1 className="sr-only">
          AutoLink Integrated Technologies — industrial electronics and
          automation parts supplier in Uttara, Dhaka, Bangladesh
        </h1>
        {/* A p, not a heading: it is the slide's message rather than a section
            title, and it is still read aloud — hiding it would remove real
            content from screen readers to no benefit. */}
        <p className="max-w-[680px] text-3xl font-extrabold leading-[1.06] tracking-[-0.025em] text-white sm:text-4xl md:text-[52px]">
          {slides[active].headlineLine1} {slides[active].headlineLine2}
        </p>
        <p className="max-w-[520px] text-sm leading-relaxed text-white/[0.82] md:text-[17px]">
          {slides[active].subheadline}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          {/* Entry point into the catalogue — /quote is the request list and
              would dead-end on its empty state for a first-time visitor. */}
          <Link
            href="/products"
            className="btn-sheen inline-flex items-center gap-2.5 rounded-[9px] border border-white/35 bg-accent/90 px-6 py-3.5 text-[15px] font-bold text-ink shadow-[0_12px_30px_rgba(255,185,0,.28)] backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:bg-accent"
          >
            Ask a price
          </Link>
          <Link
            href="/products"
            className="inline-flex items-center gap-2.5 rounded-[9px] border border-white/30 bg-white/[0.12] px-6 py-3.5 text-[15px] font-semibold text-white backdrop-blur-md transition-colors hover:bg-white/20"
          >
            Browse the catalogue
          </Link>
        </div>
      </div>

      <div className="absolute bottom-[34px] right-7 z-10 flex items-center gap-2 md:right-11">
        {slides.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Go to slide ${i + 1}`}
            onClick={() => setActive(i)}
            className={`h-1 rounded-sm transition-all ${i === active ? "w-[26px] bg-accent" : "w-2.5 bg-white/45"}`}
          />
        ))}
      </div>
    </section>
  );
}
