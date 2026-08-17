import { HeroImagesClient } from "./hero-images-client";
import { readHeroImages } from "@/app/lib/admin-catalog";

export default async function AdminHeroImagesPage() {
  const heroImages = await readHeroImages();
  return <HeroImagesClient initialImages={heroImages} />;
}
