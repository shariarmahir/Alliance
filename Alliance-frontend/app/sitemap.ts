import type { MetadataRoute } from "next";
import { getAllProducts } from "@/app/lib/mock-data";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = "https://www.autolink.example";
  const staticRoutes = ["", "/products"].map((path) => ({
    url: `${base}${path}`,
    lastModified: new Date(),
  }));
  const products = await getAllProducts();
  const productRoutes = products.map((p) => ({
    url: `${base}/products/${p.slug}`,
    lastModified: new Date(),
  }));
  return [...staticRoutes, ...productRoutes];
}
