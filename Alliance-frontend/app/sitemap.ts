import type { MetadataRoute } from "next";
import { products } from "@/app/lib/mock-data";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://www.alliance.example";
  const staticRoutes = ["", "/products"].map((path) => ({
    url: `${base}${path}`,
    lastModified: new Date(),
  }));
  const productRoutes = products.map((p) => ({
    url: `${base}/products/${p.slug}`,
    lastModified: new Date(),
  }));
  return [...staticRoutes, ...productRoutes];
}
