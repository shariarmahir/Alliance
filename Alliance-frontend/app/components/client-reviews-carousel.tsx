"use client";

import { useEffect, useRef, useState } from "react";
import type { Review } from "@/app/lib/types";

export function ClientReviewsCarousel({ reviews }: { reviews: Review[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLElement | null)[]>([]);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    function onScroll() {
      if (!track) return;
      const trackCenter = track.scrollLeft + track.clientWidth / 2;
      let closest = 0;
      let closestDist = Infinity;
      cardRefs.current.forEach((card, i) => {
        if (!card) return;
        const cardCenter = card.offsetLeft + card.offsetWidth / 2;
        const dist = Math.abs(cardCenter - trackCenter);
        if (dist < closestDist) {
          closestDist = dist;
          closest = i;
        }
      });
      setActive(closest);
    }

    track.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
    return () => track.removeEventListener("scroll", onScroll);
  }, []);

  function goTo(i: number) {
    const card = cardRefs.current[i];
    if (!card || !trackRef.current) return;
    trackRef.current.scrollTo({
      left: card.offsetLeft - trackRef.current.offsetLeft,
      behavior: "smooth",
    });
  }

  return (
    <>
      <div
        ref={trackRef}
        className="-mx-4 flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 pb-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {reviews.map((r, i) => (
          <article
            key={r.id}
            ref={(el) => {
              cardRefs.current[i] = el;
            }}
            className="relative flex w-[300px] shrink-0 snap-start flex-col rounded-[10px] border border-slate-line bg-white p-6 transition-shadow hover:shadow-md sm:w-[380px]"
          >
            <span className="font-mono text-[13px] tracking-[0.08em] text-accent">
              {"★".repeat(r.rating)}
              <span className="text-[#d7dee7]">{"★".repeat(5 - r.rating)}</span>
            </span>
            <p className="mb-4.5 mt-3 flex-1 text-sm leading-[1.7] text-[#31405a]">{r.text}</p>
            <div className="flex items-center gap-3">
              <span className="flex size-[38px] shrink-0 items-center justify-center rounded-full bg-tint text-[13px] font-bold text-primary">
                {r.author
                  .split(" ")
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join("")}
              </span>
              <span>
                <strong className="block text-[13.5px] font-semibold text-ink">{r.author}</strong>
                <span className="text-xs text-[#8a94a6]">{r.country}</span>
              </span>
            </div>
          </article>
        ))}
      </div>

      <div className="mt-6 flex items-center justify-center gap-2.5">
        {reviews.map((r, i) => (
          <button
            key={r.id}
            type="button"
            onClick={() => goTo(i)}
            aria-label={`Go to review from ${r.author}`}
            aria-current={active === i}
            className="group relative flex h-4 w-4 items-center justify-center"
          >
            <span
              className={`absolute inset-0 rounded-full transition-all duration-300 ${
                active === i ? "scale-100 animate-ping bg-primary/30" : "scale-0"
              }`}
            />
            <span
              className={`relative rounded-full transition-all duration-300 ${
                active === i
                  ? "size-2.5 bg-linear-to-br from-primary to-accent shadow-sm shadow-primary/40"
                  : "size-2 bg-slate-300 group-hover:bg-slate-400"
              }`}
            />
          </button>
        ))}
      </div>
    </>
  );
}
