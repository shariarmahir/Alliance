// Server component: reads hero background image paths from data/hero-images.json
// (admin-editable via /admin/hero-images) and hands them to the client carousel.
// Headline/subheadline text stays hardcoded — image only, per design spec.
import fs from "fs";
import path from "path";
import { HeroCarouselClient } from "./hero-carousel-client";

type HeroImageEntry = { slot: number; path: string };

const SLIDE_COPY = [
  {
    headline: "Industrial Automation Parts, Shipped Worldwide",
    subheadline:
      "PLCs, drives, HMIs, and control components from trusted global brands — sourced and shipped from Bangladesh.",
  },
  {
    headline: "Genuine Parts. Verified Suppliers.",
    subheadline: "Every part in our catalog is sourced from authorized channels with full traceability and warranty coverage.",
  },
  {
    headline: "Fast Quotations. Reliable Lead Times.",
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
    image: heroImages[i]?.path ?? "/images/hero/hero1.svg",
  }));

  return <HeroCarouselClient slides={slides} />;
}
