import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { updateQuotationStatus } from "@/app/lib/admin-operations";
import { requireAreaSession, isSessionResponse } from "../../../_auth";

const StatusSchema = z.object({ status: z.enum(["pending", "confirmed", "cancelled"]) });

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAreaSession("quotations");
  if (isSessionResponse(session)) return session;

  const { id } = await params;
  const body = await request.json();
  const parsed = StatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", fields: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  try {
    const quotation = await updateQuotationStatus(id, parsed.data.status);
    return NextResponse.json({ quotation });
  } catch {
    return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
  }
}
