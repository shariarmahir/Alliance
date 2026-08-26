import type { MetadataRoute } from "next";
import { getProducts } from "@/app/lib/catalog-data";
import { SITE_URL } from "@/app/lib/site";

const PAGE_SIZE = 100;
// A sitemap may hold 50,000 URLs; this stays well inside that while bounding
// the loop if the backend ever reports a total it cannot actually serve.
const MAX_PAGES = 50;

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
    // Paged rather than a single pageSize=100 call, which silently stopped
    // listing products once the catalogue passed a hundred — the pages would
    // exist and simply never be advertised for crawling. The loop stops on
    // `total`, and is bounded so a backend reporting a wrong total cannot
    // spin here.
    const first = await getProducts({ pageSize: PAGE_SIZE });
    const items = [...first.items];
    const pages = Math.min(Math.ceil(first.total / PAGE_SIZE), MAX_PAGES);
    for (let page = 2; page <= pages; page++) {
      items.push(...(await getProducts({ pageSize: PAGE_SIZE, page })).items);
    }
    productRoutes = items.map((p) => ({
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
