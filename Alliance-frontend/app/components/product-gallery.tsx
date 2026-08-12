"use client";

import { useState } from "react";
import Image from "next/image";

export function ProductGallery({ images, alt }: { images: string[]; alt: string }) {
  const [active, setActive] = useState(0);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative aspect-square overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
        <Image
          src={images[active]}
          alt={alt}
          fill
          sizes="(min-width: 1024px) 40vw, 90vw"
          className="object-contain p-8"
          priority
        />
      </div>
      {images.length > 1 && (
        <div className="flex gap-2">
          {images.map((img, i) => (
            <button
              key={`${img}-${i}`}
              type="button"
              onClick={() => setActive(i)}
              className={`relative size-16 overflow-hidden rounded-lg border bg-slate-50 transition-all ${
                i === active ? "border-primary ring-2 ring-primary/30" : "border-slate-200"
              }`}
            >
              <Image src={img} alt="" fill sizes="64px" className="object-contain p-2" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
