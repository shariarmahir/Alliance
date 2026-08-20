import { HeroImagesClient } from "./hero-images-client";
import { readHeroImages } from "@/app/lib/admin-data";

export default async function AdminHeroImagesPage() {
  const heroImages = await readHeroImages();
  return <HeroImagesClient initialImages={heroImages} />;
}
