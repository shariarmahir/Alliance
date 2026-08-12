// Server component: reads hero background image paths from data/hero-images.json
// (admin-editable via /admin/hero-images) and hands them to the client carousel.
// Headline/subheadline text stays hardcoded — image only, per design spec.
import fs from "fs";
import path from "path";
import { HeroCarouselClient } from "./hero-carousel-client";

type HeroImageEntry = { slot: number; path: string };

const SLIDE_COPY = [
  {
    headlineLine1: "Industrial Electronics,",
    headlineLine2: "Sourced Globally.",
    subheadline:
      "PLCs, VFD drives, servo motors, power systems and automation parts. New, refurbished & repair — request a quotation and get it delivered anywhere.",
  },
  {
    headlineLine1: "Genuine Parts.",
    headlineLine2: "Verified Suppliers.",
    subheadline: "Every part in our catalog is sourced from authorized channels with full traceability and warranty coverage.",
  },
  {
    headlineLine1: "Fast Quotations.",
    headlineLine2: "Reliable Lead Times.",
    subheadline: "Request a quote in minutes and get a dedicated response from our technical sales team.",
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
