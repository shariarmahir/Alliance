import { api, getOrDefault, getOrNull } from "@/app/lib/api-client";
import type { Brand, Category, Product } from "@/app/lib/types";

// Storefront catalog reads, backed by the FastAPI service. Replaces
// mock-data.ts and the read half of admin-catalog.ts — the public pages and
// the admin screens now share one products table, so admin edits show up on
// the storefront immediately.

export type ProductListResponse = {
  items: Product[];
  total: number;
  page: number;
  pageSize: number;
};

export type ProductQuery = {
  category?: string;
  brand?: string;
  q?: string;
  stock?: string;
  sort?: string;
  page?: number;
  pageSize?: number;
};

function toQueryString(query: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== "") params.set(key, String(value));
  }
  const encoded = params.toString();
  return encoded ? `?${encoded}` : "";
}

export async function getProducts(query: ProductQuery = {}): Promise<ProductListResponse> {
  const search = toQueryString({ ...query, pageSize: query.pageSize ?? 24 });
  return getOrDefault<ProductListResponse>(`/api/products${search}`, {
    items: [],
    total: 0,
    page: 1,
    pageSize: query.pageSize ?? 24,
  });
}

export async function getProduct(slug: string): Promise<Product | null> {
  return getOrNull<Product>(`/api/products/${encodeURIComponent(slug)}`);
}

export async function getCategories(): Promise<Category[]> {
  return getOrDefault<Category[]>("/api/categories", []);
}

export async function getBrands(): Promise<Brand[]> {
  return getOrDefault<Brand[]>("/api/brands", []);
}

export type HeroImageEntry = { slot: number; path: string };

export async function getHeroImages(): Promise<HeroImageEntry[]> {
  return getOrDefault<HeroImageEntry[]>("/api/hero-images", []);
}

export type TopSeller = { product: Product; quantitySold: number };

// Real sales data now — the previous weekRank/monthRank/yearRank fields were
// fabricated and no longer exist. An empty list is a valid answer (nothing
// sold in the window), so callers must render a sensible empty state.
export async function getTopSellers(
  period: "week" | "month" | "year" = "month",
  limit = 8
): Promise<TopSeller[]> {
  return getOrDefault<TopSeller[]>(`/api/top-sellers?period=${period}&limit=${limit}`, []);
}

// Related products for a detail page: same category, excluding the product
// being viewed. Backed by a normal filtered query rather than a bespoke
// endpoint, since the catalog is small.
export async function getRelatedProducts(product: Product, limit = 4): Promise<Product[]> {
  const { items } = await getProducts({
    category: product.categorySlug,
    pageSize: limit + 1,
  });
  return items.filter((p) => p.slug !== product.slug).slice(0, limit);
}

export async function submitQuotation(payload: {
  items: unknown[];
  details: unknown;
}): Promise<{ id: string }> {
  return api.post<{ id: string }>("/api/quotations", payload);
}

export async function getQuotation(id: string) {
  return getOrNull(`/api/quotations/${encodeURIComponent(id)}`);
}
