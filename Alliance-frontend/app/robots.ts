import type { MetadataRoute } from "next";
import { SITE_URL } from "@/app/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Admin is excluded because it is useless in results, not because it is
      // secret — robots.txt is public and advisory. The session gate is what
      // actually protects it.
      disallow: ["/api/", "/quote/", "/admin"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
