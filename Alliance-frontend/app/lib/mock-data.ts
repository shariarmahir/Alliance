// TEMPORARY MOCK DATA — replace with FastAPI backend
//
// Phase 2 migration: `products` and `categories` now read from real JSON files
// under data/ (written to by the admin catalog write layer, app/lib/admin-catalog.ts)
// instead of hardcoded arrays. Every export below keeps its original name and
// signature so existing consumers need zero changes.
//
// Caveat: because this module reads the files once at module load, a
// long-lived dev server process only picks up admin writes on the next
// request that re-evaluates the module (Next.js App Router re-evaluates
// server modules per request for non-cached paths, which is sufficient here).
import "server-only";
import fs from "fs";
import path from "path";
import type { Brand, Category, FaqItem, Product, Review } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");

function readJson<T>(file: string): T {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), "utf-8"));
}

// ---------------------------------------------------------------------------
// Brands (not admin-manageable this phase — stays hardcoded)
// ---------------------------------------------------------------------------

export const brands: Brand[] = [
  { slug: "allen-bradley", name: "Allen Bradley", logo: "/images/brands/allen-bradley.svg" },
  { slug: "siemens", name: "Siemens", logo: "/images/brands/siemens.svg" },
  { slug: "mitsubishi", name: "Mitsubishi", logo: "/images/brands/mitsubishi.svg" },
  { slug: "omron", name: "Omron", logo: "/images/brands/omron.svg" },
  { slug: "schneider-electric", name: "Schneider Electric", logo: "/images/brands/schneider-electric.svg" },
  { slug: "danfoss", name: "Danfoss", logo: "/images/brands/danfoss.svg" },
];

// ---------------------------------------------------------------------------
// Products & Categories — read from data/*.json (seeded from the original
// hardcoded arrays; mutated by the admin catalog write layer from this point on)
// ---------------------------------------------------------------------------

export const products: Product[] = readJson<Product[]>("products.json");
export const categories: Category[] = readJson<Category[]>("categories.json");

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------

export const reviews: Review[] = [
  {
    id: "rev-1",
    author: "Rezaul Karim",
    country: "Bangladesh",
    rating: 5,
    text: "Alliance sourced a discontinued Allen Bradley module for us within a week. Excellent communication throughout.",
  },
  {
    id: "rev-2",
    author: "Ahmed Al-Farsi",
    country: "UAE",
    rating: 5,
    text: "Fast quotation turnaround and the parts arrived exactly as specified. Will order again for our next plant expansion.",
  },
  {
    id: "rev-3",
    author: "Michael Turner",
    country: "USA",
    rating: 4,
    text: "Good pricing on Siemens drives compared to local distributors. Shipping took a bit longer than expected but support kept us updated.",
  },
  {
    id: "rev-4",
    author: "James Whitfield",
    country: "UK",
    rating: 5,
    text: "Their technical team helped us cross-reference an obsolete part number to a current equivalent. Saved us a costly redesign.",
  },
  {
    id: "rev-5",
    author: "Klaus Bergmann",
    country: "Germany",
    rating: 4,
    text: "Reliable supplier for HMI panels. Documentation and warranty terms were clear and honored without issue.",
  },
  {
    id: "rev-6",
    author: "Priya Nair",
    country: "India",
    rating: 5,
    text: "Ordered sensors and contactors in bulk for a factory retrofit. Everything arrived well packaged and on schedule.",
  },
];

// ---------------------------------------------------------------------------
// FAQ
// ---------------------------------------------------------------------------

export const faqs: FaqItem[] = [
  {
    question: "Do you ship internationally?",
    answer:
      "Yes. Alliance ships worldwide from our Dhaka, Bangladesh facility via air and sea freight, with door-to-door courier options available for smaller orders.",
  },
  {
    question: "How does the quotation process work?",
    answer:
      "Select a product, choose your quantity, and submit a quotation request with your contact details. Our team reviews stock and pricing and you'll receive a formal quote to confirm before we process your order.",
  },
  {
    question: "What warranty do your products carry?",
    answer:
      "Most parts carry a standard 2-year manufacturer warranty covering defects in materials and workmanship. Extended warranty terms are available on request for select product lines.",
  },
  {
    question: "What payment terms do you offer?",
    answer:
      "We accept bank transfer (T/T), letter of credit (L/C) for larger orders, and major payment cards for smaller quotations. Payment terms are confirmed at order confirmation.",
  },
  {
    question: "What are your typical lead times?",
    answer:
      "In-stock items typically ship within 1-2 business days. Special-order or low-stock items may take 1-3 weeks depending on manufacturer availability — lead time is confirmed on your quotation.",
  },
  {
    question: "What is your returns policy?",
    answer:
      "Unused parts in original packaging may be returned within 14 days of delivery for eligible products. Contact our support team with your order number to initiate a return.",
  },
];

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

export function getProductBySlug(slug: string): Product | undefined {
  return products.find((p) => p.slug === slug);
}

export function getProductsByCategory(slug: string): Product[] {
  return products.filter((p) => p.categorySlug === slug);
}

export function getTopSelling(period: "week" | "month" | "year"): Product[] {
  const rankKey = period === "week" ? "weekRank" : period === "month" ? "monthRank" : "yearRank";
  return products
    .filter((p) => p[rankKey] !== undefined)
    .sort((a, b) => (a[rankKey] as number) - (b[rankKey] as number))
    .slice(0, 6);
}

export function getRelatedProducts(slug: string): Product[] {
  const product = getProductBySlug(slug);
  if (!product) return [];
  return products
    .filter((p) => p.slug !== slug && p.categorySlug === product.categorySlug)
    .slice(0, 4);
}
