import fs from "fs";
import path from "path";
import { HeroImagesClient } from "./hero-images-client";
import type { HeroImageEntry } from "@/app/lib/admin-catalog";

function readHeroImages(): HeroImageEntry[] {
  const raw = fs.readFileSync(path.join(process.cwd(), "data", "hero-images.json"), "utf-8");
  return JSON.parse(raw);
}

export default function AdminHeroImagesPage() {
  const heroImages = readHeroImages();
  return <HeroImagesClient initialImages={heroImages} />;
}
