"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
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
      <section className="relative aspect-16/6 w-full overflow-hidden bg-slate-900">
        {slides.map((slide, i) => (
          <div
            key={i}
            className={`absolute inset-0 transition-opacity duration-700 ${i === active ? "opacity-100" : "pointer-events-none opacity-0"}`}
          >
            <Image src={slide.image} alt="" fill priority={i === 0} sizes="100vw" className="object-cover" />
            <div className="absolute inset-0 bg-primary/60" />
            <div className="absolute inset-0 bg-linear-to-r from-slate-900/80 via-slate-900/40 to-transparent" />

            <div className="relative z-10 mx-auto flex h-full max-w-7xl flex-col justify-center px-4">
              <span className="mb-4 w-fit rounded-full border border-white/30 bg-white/10 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-white backdrop-blur-sm">
                Ships Worldwide From Bangladesh
              </span>
              <h1 className="mb-4 max-w-2xl text-3xl font-extrabold leading-tight sm:text-5xl">
                <span className="block text-white">{slide.headlineLine1}</span>
                <span className="block text-accent">{slide.headlineLine2}</span>
              </h1>
              <p className="mb-6 max-w-xl text-sm text-slate-200 sm:text-base">{slide.subheadline}</p>

              <form onSubmit={submit} className="mb-6 flex w-full max-w-xl">
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Search 50,000+ parts by number or brand..."
                  className="h-12 w-full rounded-l-md border-0 bg-white px-4 text-sm text-slate-900 outline-none placeholder:text-slate-400"
                />
                <button
                  type="submit"
                  className="btn-glass-accent flex h-12 items-center gap-2 rounded-l-none rounded-r-md px-5"
                >
                  <Search className="size-4" /> Search
                </button>
              </form>

              <div className="flex flex-wrap gap-x-8 gap-y-3">
                {FEATURES.map((f) => (
                  <div key={f.title} className="flex items-center gap-2.5">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/10 ring-1 ring-white/20">
                      <f.icon className="size-4 text-accent" />
                    </span>
                    <div className="leading-tight">
                      <p className="text-xs font-semibold text-white">{f.title}</p>
                      <p className="text-[11px] text-slate-300">{f.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}

        <div className="absolute bottom-6 left-1/2 z-10 flex -translate-x-1/2 gap-2">
          {slides.map((_, i) => (
            <button
              key={i}
              type="button"
              aria-label={`Go to slide ${i + 1}`}
              onClick={() => setActive(i)}
              className={`h-2 rounded-full transition-all ${i === active ? "w-6 bg-accent" : "w-2 bg-white/50"}`}
            />
          ))}
        </div>
      </section>

      <div className="bg-primary">
        <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-4 py-8 sm:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-3xl font-extrabold text-accent sm:text-4xl">{s.value}</p>
              <p className="mt-1 text-xs font-medium text-white/80 sm:text-sm">{s.label}</p>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
