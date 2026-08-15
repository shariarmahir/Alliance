"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Truck, Headset, ShieldCheck } from "lucide-react";

type Slide = { image: string; headlineLine1: string; headlineLine2: string; subheadline: string };

const FEATURES = [
  { icon: Truck, title: "Worldwide Shipping", text: "Tracked delivery to 100+ countries" },
  { icon: Headset, title: "Expert Support", text: "Talk to real automation engineers" },
  { icon: ShieldCheck, title: "Genuine & Tested", text: "Warranty on every order" },
];

const STATS = [
  { value: "50,000+", label: "Parts in Catalog" },
  { value: "100+", label: "Countries Served" },
  { value: "48 hrs", label: "Avg. Quote Time" },
  { value: "24/7", label: "Technical Support" },
];

export function HeroCarouselClient({ slides }: { slides: Slide[] }) {
  const [active, setActive] = useState(0);
  const [q, setQ] = useState("");
  const router = useRouter();

  useEffect(() => {
    const id = setInterval(() => {
      setActive((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(id);
  }, [slides.length]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    router.push(`/products?q=${encodeURIComponent(q)}`);
  }

  return (
    <>
      <section className="relative aspect-auto min-h-140 w-full overflow-hidden bg-slate-900 sm:aspect-16/6 sm:min-h-0">
        {slides.map((slide, i) => (
          <div
            key={i}
            className={`absolute inset-0 transition-opacity duration-700 ${i === active ? "opacity-100" : "pointer-events-none opacity-0"}`}
          >
            <Image src={slide.image} alt="" fill priority={i === 0} sizes="100vw" className="object-cover" />
            <div className="absolute inset-0 bg-primary/60" />
            <div className="absolute inset-0 bg-linear-to-r from-slate-900/80 via-slate-900/40 to-transparent" />

            <div className="relative z-10 mx-auto flex h-full max-w-7xl flex-col justify-center px-4 py-6 sm:py-0">
              <span className="mb-3 w-fit rounded-full border border-white/30 bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-sm sm:mb-4 sm:px-3 sm:text-[11px]">
                Ships Worldwide From Bangladesh
              </span>
              <h1 className="mb-3 max-w-2xl text-2xl font-extrabold leading-tight sm:mb-4 sm:text-3xl md:text-5xl">
                <span className="block text-white">{slide.headlineLine1}</span>
                <span className="block text-accent">{slide.headlineLine2}</span>
              </h1>
              <p className="mb-4 max-w-xl text-xs text-slate-200 sm:mb-6 sm:text-sm md:text-base">{slide.subheadline}</p>

              <form onSubmit={submit} className="mb-4 flex w-full max-w-xl flex-col gap-2 sm:mb-3 sm:flex-row sm:gap-0">
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search 50,000+ parts by number or brand..."
                  className="h-11 w-full min-w-0 rounded-md border-0 bg-white px-4 text-sm text-slate-900 outline-none placeholder:text-slate-400 sm:h-12 sm:rounded-l-md sm:rounded-r-none"
                />
                <button
                  type="submit"
                  className="btn-glass-accent flex h-11 shrink-0 items-center justify-center gap-2 rounded-md px-5 sm:h-12 sm:rounded-l-none sm:rounded-r-md"
                >
                  <Search className="size-4" /> Ask a Price
                </button>
              </form>
              <Link
                href="/products"
                className="mb-4 inline-flex w-fit items-center gap-2 rounded-md border border-white/30 bg-white/10 px-5 py-2.5 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/20 sm:mb-6"
              >
                Browse the catalogue
              </Link>

              <div className="flex flex-wrap gap-x-6 gap-y-2.5 sm:gap-x-8 sm:gap-y-3">
                {FEATURES.map((f) => (
                  <div key={f.title} className="flex items-center gap-2 sm:gap-2.5">
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/20 sm:size-9">
                      <f.icon className="size-3.5 text-accent sm:size-4" />
                    </span>
                    <div className="leading-tight">
                      <p className="text-[11px] font-semibold text-white sm:text-xs">{f.title}</p>
                      <p className="hidden text-[11px] text-slate-300 sm:block">{f.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}

        <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 gap-2 sm:bottom-6">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Go to slide ${i + 1}`}
              onClick={() => setActive(i)}
              className={`h-1.5 rounded-full transition-all sm:h-2 ${i === active ? "w-5 bg-accent sm:w-6" : "w-1.5 bg-white/50 sm:w-2"}`}
            />
          ))}
        </div>
      </section>

      <div className="bg-primary">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-4 px-4 py-6 sm:gap-6 sm:py-8 md:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-xl font-extrabold text-accent sm:text-3xl md:text-4xl">{s.value}</p>
              <p className="mt-1 text-[11px] font-medium text-white/80 sm:text-xs md:text-sm">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
