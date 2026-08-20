// Server component: reads hero background image paths (admin-editable via
// /admin/hero-images) and hands them to the client carousel. Headline/subheadline
// text stays hardcoded — image only, per design spec.
import { getHeroImages } from "@/app/lib/catalog-data";
import { HeroCarouselClient } from "./hero-carousel-client";

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

export async function HeroCarousel() {
  const heroImages = (await getHeroImages()).sort((a, b) => a.slot - b.slot);
  const slides = SLIDE_COPY.map((copy, i) => ({
    ...copy,
    image: heroImages[i]?.path ?? "/images/hero/image1.jpg",
  }));

  return <HeroCarouselClient slides={slides} />;
}
