import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/api/", "/order/", "/quote/"] },
    sitemap: "https://www.alliance.example/sitemap.xml",
  };
}
