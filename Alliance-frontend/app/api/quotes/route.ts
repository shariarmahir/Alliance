// TEMPORARY MOCK DATA — replace with FastAPI backend
import { NextResponse } from "next/server";
import { z } from "zod";
import { getProductBySlug } from "@/app/lib/mock-data";

const QuoteSchema = z.object({
  productSlug: z.string().min(1),
  quantity: z.coerce.number().int().min(1),
  name: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(6),
  company: z.string().min(1),
  country: z.string().min(2),
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = QuoteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", fields: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const product = getProductBySlug(parsed.data.productSlug);
  if (!product) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }
  const quote = {
    id: crypto.randomUUID(),
    productSlug: product.slug,
    quantity: parsed.data.quantity,
    unitPrice: product.price,
    totalPrice: Math.round(product.price * parsed.data.quantity * 100) / 100,
    name: parsed.data.name,
    email: parsed.data.email,
    phone: parsed.data.phone,
    company: parsed.data.company,
    country: parsed.data.country,
    createdAt: new Date().toISOString(),
  };
  return NextResponse.json(quote, { status: 201 });
}
