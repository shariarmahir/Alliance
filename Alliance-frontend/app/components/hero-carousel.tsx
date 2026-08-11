"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

const slides = [
  {
    image: "/images/hero/hero1.svg",
    headline: "Industrial Automation Parts, Shipped Worldwide",
    subheadline: "PLCs, drives, HMIs, and control components from trusted global brands — sourced and shipped from Bangladesh.",
  },
  {
    image: "/images/hero/hero2.svg",
    headline: "Genuine Parts. Verified Suppliers.",
    subheadline: "Every part in our catalog is sourced from authorized channels with full traceability and warranty coverage.",
  },
  {
    image: "/images/hero/hero3.svg",
    headline: "Fast Quotations. Reliable Lead Times.",
    subheadline: "Request a quote in minutes and get a dedicated response from our technical sales team.",
  },
];

export function HeroCarousel() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const id = setInterval(() => {
      setActive((prev) => (prev + 1) % slides.length);
    }, 5000);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="relative h-[420px] w-full overflow-hidden bg-slate-900 sm:h-[480px]">
      {slides.map((slide, i) => (
        <div
          key={slide.image}
          className={`absolute inset-0 transition-opacity duration-700 ${i === active ? "opacity-100" : "pointer-events-none opacity-0"}`}
        >
          <Image src={slide.image} alt="" fill priority={i === 0} className="object-cover opacity-40" />
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
        {slides.map((slide, i) => (
          <button
            key={slide.image}
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
