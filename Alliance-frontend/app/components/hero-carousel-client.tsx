"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

type Slide = { image: string; headline: string; subheadline: string };

export function HeroCarouselClient({ slides }: { slides: Slide[] }) {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setActive((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(id);
  }, [slides.length]);

  return (
    <section className="relative h-[420px] w-full overflow-hidden bg-slate-900 sm:h-[480px]">
      {slides.map((slide, i) => (
        <div
          key={i}
          className={`absolute inset-0 transition-opacity duration-700 ${i === active ? "opacity-100" : "pointer-events-none opacity-0"}`}
        >
          <Image src={slide.image} alt="" fill priority={i === 0} sizes="100vw" className="object-cover opacity-40" />
          <div className="relative z-10 mx-auto flex h-full max-w-7xl flex-col justify-center px-4">
            <h1 className="mb-4 max-w-2xl text-3xl font-bold text-white sm:text-5xl">{slide.headline}</h1>
            <p className="mb-6 max-w-xl text-slate-200">{slide.subheadline}</p>
            <Link href="/products" className="btn-glass-accent w-fit">
              Browse Catalog
            </Link>
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
  );
}
