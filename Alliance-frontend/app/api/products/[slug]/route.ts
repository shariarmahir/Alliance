// TEMPORARY MOCK DATA — replace with FastAPI backend
import { NextResponse } from "next/server";
import { getProductBySlug } from "@/app/lib/mock-data";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const product = await getProductBySlug(slug);
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }
  return NextResponse.json(product);
}
