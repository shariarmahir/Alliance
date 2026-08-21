import type { MetadataRoute } from "next";
import { getProducts } from "@/app/lib/catalog-data";
import { SITE_URL } from "@/app/lib/site";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const staticRoutes = [
    // priority/changeFrequency are hints, not directives, but they do tell
    // Google which pages are worth recrawling often. The catalogue changes;
    // the terms page does not.
    { path: "", priority: 1, changeFrequency: "daily" as const },
    { path: "/products", priority: 0.9, changeFrequency: "daily" as const },
    { path: "/contact", priority: 0.7, changeFrequency: "monthly" as const },
    { path: "/terms", priority: 0.3, changeFrequency: "yearly" as const },
    { path: "/privacy", priority: 0.3, changeFrequency: "yearly" as const },
  ].map(({ path, priority, changeFrequency }) => ({
    url: `${SITE_URL}${path}`,
    lastModified: new Date(),
    changeFrequency,
    priority,
  }));

  // A backend that is down must not take the sitemap with it: an erroring
  // sitemap is worse for indexing than one listing only the static pages.
  let productRoutes: MetadataRoute.Sitemap = [];
  try {
    const products = (await getProducts({ pageSize: 100 })).items;
    productRoutes = products.map((p) => ({
      url: `${SITE_URL}/products/${p.slug}`,
      lastModified: new Date(),
      changeFrequency: "weekly" as const,
      priority: 0.8,
    }));
  } catch {
    // Static routes alone still get the site indexed.
  }

  return [...staticRoutes, ...productRoutes];
}
