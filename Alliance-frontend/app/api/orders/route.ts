import { NextResponse } from "next/server";
import { z } from "zod";
import { addOrder } from "@/app/lib/admin-operations";
import type { Order } from "@/app/lib/types";

// POST /api/orders — kept for admin-side order records. The customer flow no
// longer creates orders directly (see app/(site)/track/quote/[id]/page.tsx):
// an admin's quotation confirmation is the order now.

const QuoteItemSchema = z.object({
  slug: z.string().min(1),
  partNumber: z.string().min(1),
  name: z.string().min(1),
  brand: z.string(),
  image: z.string(),
  price: z.number(),
  quantity: z.number().int().min(1),
});

const DeliveryAddressSchema = z.object({
  name: z.string().min(1),
  line: z.string().min(1),
  city: z.string().min(1),
  country: z.string().min(1),
  phone: z.string().min(1),
});

const OrderSchema = z.object({
  orderNumber: z.string().min(1),
  trackingId: z.string().min(1),
  items: z.array(QuoteItemSchema).min(1),
  subtotal: z.number(),
  shippingCost: z.number(),
  grandTotal: z.number(),
  deliveryOption: z.enum(["standard", "express", "air"]),
  deliveryOptionName: z.string().min(1),
  deliveryEta: z.string().min(1),
  preferredDate: z.string().min(1),
  address: DeliveryAddressSchema,
  placedAt: z.string().min(1),
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = OrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", fields: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const order: Order = { ...parsed.data, status: "pending" };
  await addOrder(order);

  return NextResponse.json({ order }, { status: 201 });
}
