import "server-only";
import path from "path";
import { put } from "@vercel/blob";
import { readBlobJson, writeBlobJson } from "./blob-store";
import type { Category, Product, StockStatus } from "./types";

// The only module that writes to Blob-backed data/*.json and Blob-backed
// binary images (formerly public/images/{products,categories,hero}/*) — see
// app/lib/blob-store.ts for why fs writes don't work on Vercel.

export type HeroImageEntry = { slot: number; path: string };

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export async function readProducts(): Promise<Product[]> {
  return readBlobJson<Product[]>("products.json");
}

export async function writeProducts(products: Product[]): Promise<void> {
  await writeBlobJson("products.json", products);
  await syncCategoryProductCounts(products);
}

// Keeps each category's stored productCount in sync with the actual product
// list after any product write (single add, bulk import, stock change never
// affects counts but is harmless to recompute). Both the admin Categories
// tab and the storefront category grid read productCount directly from
// categories.json, so this is the one place that needs to stay accurate.
async function syncCategoryProductCounts(products: Product[]): Promise<void> {
  const categories = await readCategories();
  let changed = false;
  for (const category of categories) {
    const count = products.filter((p) => p.categorySlug === category.slug).length;
    if (category.productCount !== count) {
      category.productCount = count;
      changed = true;
    }
  }
  if (changed) await writeCategories(categories);
}

export async function addProduct(product: Product): Promise<void> {
  const products = await readProducts();
  products.push(product);
  await writeProducts(products);
}

export async function updateProductStock(slug: string, stockQty: number): Promise<Product> {
  const products = await readProducts();
  const product = products.find((p) => p.slug === slug);
  if (!product) throw new Error(`Product not found: ${slug}`);
  product.stockQty = stockQty;
  product.stock = deriveStockStatus(stockQty);
  await writeProducts(products);
  return product;
}

export function deriveStockStatus(qty: number): StockStatus {
  if (qty <= 0) return "out-of-stock";
  if (qty < 10) return "low-stock";
  return "in-stock";
}

// Default stockQty for a parsed bulk-import stock status (spec-defined backfill rule).
export function defaultStockQtyForStatus(status: StockStatus): number {
  if (status === "in-stock") return 50;
  if (status === "low-stock") return 5;
  return 0;
}

export async function saveProductImage(categorySlug: string, filename: string, buffer: Buffer): Promise<string> {
  const blob = await put(`images/products/${categorySlug}/${filename}`, buffer, {
    access: "public",
    allowOverwrite: true,
  });
  return blob.url;
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export async function readCategories(): Promise<Category[]> {
  return readBlobJson<Category[]>("categories.json");
}

export async function writeCategories(categories: Category[]): Promise<void> {
  await writeBlobJson("categories.json", categories);
}

export async function addCategory(category: Category): Promise<void> {
  const categories = await readCategories();
  categories.push(category);
  await writeCategories(categories);
}

export async function saveCategoryIcon(slug: string, filename: string, buffer: Buffer): Promise<string> {
  const ext = path.extname(filename) || ".svg";
  const finalName = `${slug}${ext}`;
  const blob = await put(`images/categories/${finalName}`, buffer, {
    access: "public",
    allowOverwrite: true,
  });
  return blob.url;
}

// ---------------------------------------------------------------------------
// Hero images
// ---------------------------------------------------------------------------

export async function readHeroImages(): Promise<HeroImageEntry[]> {
  return readBlobJson<HeroImageEntry[]>("hero-images.json");
}

export async function writeHeroImages(entries: HeroImageEntry[]): Promise<void> {
  await writeBlobJson("hero-images.json", entries);
}

export async function saveHeroImage(slot: number, filename: string, buffer: Buffer): Promise<string> {
  const ext = path.extname(filename) || ".jpg";
  const finalName = `image${slot}${ext}`;
  // Cache-bust: Blob's allowOverwrite reuses the same pathname per slot, so a
  // replacement upload needs a distinct query param or the browser/Next's
  // image optimizer will keep serving the old cached bytes.
  const blob = await put(`images/hero/${finalName}`, buffer, {
    access: "public",
    allowOverwrite: true,
  });
  const publicPath = `${blob.url}?v=${Date.now()}`;

  const entries = await readHeroImages();
  const existing = entries.find((e) => e.slot === slot);
  if (existing) {
    existing.path = publicPath;
  } else {
    entries.push({ slot, path: publicPath });
  }
  entries.sort((a, b) => a.slot - b.slot);
  await writeHeroImages(entries);
  return publicPath;
}

// ---------------------------------------------------------------------------
// Slug helpers
// ---------------------------------------------------------------------------

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Appends a numeric suffix (-2, -3, ...) on collision rather than erroring,
// since product/category names can legitimately repeat (e.g. same name,
// different variant) — per spec's error-handling section.
export function uniqueSlug(base: string, existingSlugs: Set<string>): string {
  let candidate = base;
  let n = 2;
  while (existingSlugs.has(candidate)) {
    candidate = `${base}-${n}`;
    n++;
  }
  return candidate;
}
