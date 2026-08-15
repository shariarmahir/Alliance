// Server component: reads hero background image paths from data/hero-images.json
// (admin-editable via /admin/hero-images) and hands them to the client carousel.
// Headline/subheadline text stays hardcoded — image only, per design spec.
import fs from "fs";
import path from "path";
import { HeroCarouselClient } from "./hero-carousel-client";

type HeroImageEntry = { slot: number; path: string };

const SLIDE_COPY = [
  {
    headlineLine1: "The part that stops your line,",
    headlineLine2: "in stock today",
    subheadline:
      "PLCs, drives, servos, HMIs and power components from 60+ manufacturers — quoted in four working hours, shipped worldwide from Dhaka.",
  },
  {
    headlineLine1: "Genuine parts.",
    headlineLine2: "Verified suppliers.",
    subheadline:
      "Every unit inspected, function-tested and covered by an AutoLink warranty before it leaves Uttara.",
  },
  {
    headlineLine1: "Obsolete numbers,",
    headlineLine2: "found and tested",
    subheadline:
      "If it is discontinued, we hunt it down or offer a bench-tested equivalent — with the cross-reference confirmed by an engineer.",
  },
];

function readHeroImages(): HeroImageEntry[] {
  const raw = fs.readFileSync(path.join(process.cwd(), "data", "hero-images.json"), "utf-8");
  return JSON.parse(raw);
}

export function HeroCarousel() {
  const heroImages = readHeroImages().sort((a, b) => a.slot - b.slot);
  const slides = SLIDE_COPY.map((copy, i) => ({
    ...copy,
    image: heroImages[i]?.path ?? "/images/hero/image1.jpg",
  }));

  return <HeroCarouselClient slides={slides} />;
}
