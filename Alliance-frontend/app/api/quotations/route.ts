import { NextResponse } from "next/server";
import { z } from "zod";
import { addQuotation } from "@/app/lib/admin-operations";
import type { Quotation } from "@/app/lib/types";

// POST /api/quotations — replaces the old stale app/api/quotes/route.ts
// (single-product schema from an earlier flow). Mirrors the cart-based
// quotation the storefront already builds and writes to sessionStorage
// (see app/(site)/quote/page.tsx). Fire-and-forget from the UI's side.

const QuoteItemSchema = z.object({
  slug: z.string().min(1),
  partNumber: z.string().min(1),
  name: z.string().min(1),
  brand: z.string(),
  image: z.string(),
  price: z.number(),
  quantity: z.number().int().min(1),
});

const QuotationDetailsSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
  jobTitle: z.string(),
  companyName: z.string().min(1),
  country: z.string().min(1),
  taxId: z.string(),
  companyWebsite: z.string(),
  preferredContact: z.enum(["email", "phone", "whatsapp"]),
  leadTime: z.enum(["standard", "urgent", "flexible"]),
  notes: z.string(),
  submittedAt: z.string().min(1),
});

const QuotationRequestSchema = z.object({
  items: z.array(QuoteItemSchema).min(1),
  total: z.number(),
  details: QuotationDetailsSchema,
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = QuotationRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", fields: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const quotation: Quotation = {
    id: crypto.randomUUID(),
    items: parsed.data.items,
    total: parsed.data.total,
    details: parsed.data.details,
    status: "pending",
  };
  await addQuotation(quotation);

  return NextResponse.json({ quotation }, { status: 201 });
}
