import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { updateOrderStatus } from "@/app/lib/admin-operations";
import { requireSuperAdminSession, isSessionResponse } from "../../../_auth";

const StatusSchema = z.object({ status: z.enum(["pending", "confirmed", "cancelled"]) });

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ orderNumber: string }> }) {
  const session = await requireSuperAdminSession();
  if (isSessionResponse(session)) return session;

  const { orderNumber } = await params;
  const body = await request.json();
  const parsed = StatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", fields: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  try {
    const order = await updateOrderStatus(orderNumber, parsed.data.status);
    return NextResponse.json({ order });
  } catch {
    return NextResponse.json({ error: "Order not found" }, { status: 404 });
  }
}
