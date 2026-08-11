// TEMPORARY MOCK DATA — replace with FastAPI backend
import { NextResponse } from "next/server";
import { z } from "zod";
import { addBusinessDays } from "@/app/lib/utils";

const OrderSchema = z.object({
  quoteId: z.string().min(1),
  deliveryOption: z.enum(["standard", "express"]),
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = OrderSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", fields: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const days = parsed.data.deliveryOption === "express" ? 3 : 10;
  const orderNumber = `ALC-${Date.now().toString(36).toUpperCase()}`;
  const trackingId = `TRK-${crypto.randomUUID().slice(0, 8).toUpperCase()}`;
  const order = {
    id: crypto.randomUUID(),
    orderNumber,
    quoteId: parsed.data.quoteId,
    deliveryOption: parsed.data.deliveryOption,
    estimatedDeliveryDate: addBusinessDays(new Date(), days).toISOString(),
    trackingId,
    createdAt: new Date().toISOString(),
  };
  return NextResponse.json(order, { status: 201 });
}
