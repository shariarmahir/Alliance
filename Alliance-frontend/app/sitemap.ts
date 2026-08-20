import type { MetadataRoute } from "next";
import { getProducts } from "@/app/lib/catalog-data";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = "https://www.autolink.example";
  const staticRoutes = ["", "/products", "/contact", "/terms", "/privacy"].map((path) => ({
    url: `${base}${path}`,
    lastModified: new Date(),
  }));
  const products = (await getProducts({ pageSize: 100 })).items;
  const productRoutes = products.map((p) => ({
    url: `${base}/products/${p.slug}`,
    lastModified: new Date(),
  }));
  return [...staticRoutes, ...productRoutes];
}
