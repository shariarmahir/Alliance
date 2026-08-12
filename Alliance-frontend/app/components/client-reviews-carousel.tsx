"use client";

import { useEffect, useRef, useState } from "react";
import { Star, Quote } from "lucide-react";
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
            className="relative flex w-[270px] shrink-0 snap-start flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md sm:w-[310px]"
          >
            <Quote className="absolute right-4 top-4 size-7 text-primary/10" />
            <div className="flex items-center gap-0.5">
              {Array.from({ length: 5 }).map((_, s) => (
                <Star
                  key={s}
                  className={`size-3.5 ${s < r.rating ? "fill-accent text-accent" : "fill-slate-200 text-slate-200"}`}
                />
              ))}
            </div>
            <p className="mt-3 flex-1 text-xs leading-relaxed text-slate-600">&ldquo;{r.text}&rdquo;</p>
            <div className="mt-5 flex items-center gap-2.5 border-t border-slate-100 pt-3.5">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                {r.author
                  .split(" ")
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join("")}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">{r.author}</p>
                <p className="text-xs text-slate-500">{r.country}</p>
              </div>
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
