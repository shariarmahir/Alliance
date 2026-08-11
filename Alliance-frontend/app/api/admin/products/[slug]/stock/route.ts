import { NextRequest, NextResponse } from "next/server";
import { readProducts, updateProductStock } from "@/app/lib/admin-catalog";
import { requireAdminSession, isSessionResponse } from "../../../_auth";

export const runtime = "nodejs";

// PATCH /api/admin/products/[slug]/stock — body { stockQty: number, delta?: boolean }.
// delta: true means "stock in +N / stock out -N" (adjust current), delta: false/omitted
// means "set exact quantity".
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const session = await requireAdminSession();
  if (isSessionResponse(session)) return session;

  const { slug } = await params;
  const body = await request.json().catch(() => null);

  if (!body || typeof body.stockQty !== "number" || Number.isNaN(body.stockQty)) {
    return NextResponse.json({ error: "stockQty must be a number." }, { status: 400 });
  }

  const delta: boolean = body.delta === true;

  const products = await readProducts();
  const product = products.find((p) => p.slug === slug);
  if (!product) {
    return NextResponse.json({ error: `Product not found: ${slug}` }, { status: 404 });
  }

  const nextQty = delta ? product.stockQty + body.stockQty : body.stockQty;
  if (nextQty < 0) {
    return NextResponse.json({ error: "Stock quantity cannot go below zero." }, { status: 400 });
  }

  const updated = await updateProductStock(slug, nextQty);

  return NextResponse.json({ product: updated });
}
