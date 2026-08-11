import "server-only";
import fs from "fs/promises";
import path from "path";
import type { Category, Product, StockStatus } from "./types";

// The only module that writes to data/*.json and public/images/{products,categories,hero}/*.
//
// KNOWN LIMITATION: these are real filesystem writes under public/ and data/,
// which work in local dev and traditional Node hosting but will NOT work on
// read-only-filesystem serverless hosts (e.g. Vercel). Acceptable for now —
// the real backend (FastAPI) replaces this layer later.

const DATA_DIR = path.join(process.cwd(), "data");
const PRODUCTS_IMAGE_DIR = path.join(process.cwd(), "public", "images", "products");
const CATEGORIES_IMAGE_DIR = path.join(process.cwd(), "public", "images", "categories");
const HERO_IMAGE_DIR = path.join(process.cwd(), "public", "images", "hero");

export type HeroImageEntry = { slot: number; path: string };

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

export async function readProducts(): Promise<Product[]> {
  const raw = await fs.readFile(path.join(DATA_DIR, "products.json"), "utf-8");
  return JSON.parse(raw);
}

export async function writeProducts(products: Product[]): Promise<void> {
  await fs.writeFile(path.join(DATA_DIR, "products.json"), JSON.stringify(products, null, 2) + "\n");
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
  const dir = path.join(PRODUCTS_IMAGE_DIR, categorySlug);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(path.join(dir, filename), buffer);
  return `/images/products/${categorySlug}/${filename}`; // public URL path
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export async function readCategories(): Promise<Category[]> {
  const raw = await fs.readFile(path.join(DATA_DIR, "categories.json"), "utf-8");
  return JSON.parse(raw);
}

export async function writeCategories(categories: Category[]): Promise<void> {
  await fs.writeFile(path.join(DATA_DIR, "categories.json"), JSON.stringify(categories, null, 2) + "\n");
}

export async function addCategory(category: Category): Promise<void> {
  const categories = await readCategories();
  categories.push(category);
  await writeCategories(categories);
}

export async function saveCategoryIcon(slug: string, filename: string, buffer: Buffer): Promise<string> {
  await fs.mkdir(CATEGORIES_IMAGE_DIR, { recursive: true });
  const ext = path.extname(filename) || ".svg";
  const finalName = `${slug}${ext}`;
  await fs.writeFile(path.join(CATEGORIES_IMAGE_DIR, finalName), buffer);
  return `/images/categories/${finalName}`;
}

// ---------------------------------------------------------------------------
// Hero images
// ---------------------------------------------------------------------------

export async function readHeroImages(): Promise<HeroImageEntry[]> {
  const raw = await fs.readFile(path.join(DATA_DIR, "hero-images.json"), "utf-8");
  return JSON.parse(raw);
}

export async function writeHeroImages(entries: HeroImageEntry[]): Promise<void> {
  await fs.writeFile(path.join(DATA_DIR, "hero-images.json"), JSON.stringify(entries, null, 2) + "\n");
}

export async function saveHeroImage(slot: number, filename: string, buffer: Buffer): Promise<string> {
  await fs.mkdir(HERO_IMAGE_DIR, { recursive: true });
  const ext = path.extname(filename) || ".jpg";
  const finalName = `image${slot}${ext}`;
  await fs.writeFile(path.join(HERO_IMAGE_DIR, finalName), buffer);
  const publicPath = `/images/hero/${finalName}`;

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
