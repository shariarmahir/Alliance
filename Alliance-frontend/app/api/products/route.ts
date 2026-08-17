// TEMPORARY MOCK DATA — replace with FastAPI backend
import { NextRequest, NextResponse } from "next/server";
import { getAllProducts } from "@/app/lib/mock-data";

const PAGE_SIZE = 24;

export async function GET(request: NextRequest) {
  const sp = request.nextUrl.searchParams;
  const category = sp.get("category");
  const brand = sp.get("brand");
  const q = sp.get("q")?.toLowerCase();
  const inStock = sp.get("inStock");
  const page = Math.max(1, Number(sp.get("page") ?? "1"));

  const products = await getAllProducts();
  let filtered = products;
  if (category) filtered = filtered.filter((p) => p.categorySlug === category);
  if (brand) filtered = filtered.filter((p) => p.brand === brand);
  if (inStock === "true") filtered = filtered.filter((p) => p.stock !== "out-of-stock");
  if (q) {
    filtered = filtered.filter(
      (p) => p.name.toLowerCase().includes(q) || p.partNumber.toLowerCase().includes(q)
    );
  }

  const start = (page - 1) * PAGE_SIZE;
  const paged = filtered.slice(start, start + PAGE_SIZE);

  return NextResponse.json({ products: paged, total: filtered.length, page, pageSize: PAGE_SIZE });
}
