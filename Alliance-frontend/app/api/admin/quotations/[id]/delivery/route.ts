import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readQuotation, updateDeliveryStage } from "@/app/lib/admin-operations";
import { MAX_STAGE } from "@/app/lib/delivery";
import { requireAreaSession, isSessionResponse } from "../../../_auth";

// PATCH /api/admin/quotations/[id]/delivery — advances the delivery stage
// shown on the customer's tracking page. Without this the tracking page has
// no real data to display, which is why it used to simulate one.

const StageSchema = z.object({
  stage: z.number().int().min(0).max(MAX_STAGE),
});

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAreaSession("quotations");
  if (isSessionResponse(session)) return session;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = StageSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", fields: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const quotation = await readQuotation(id);
  if (!quotation?.confirmation) {
    return NextResponse.json(
      { error: "This quotation has not been confirmed, so it has no delivery to track." },
      { status: 400 }
    );
  }

  const updated = await updateDeliveryStage(quotation.confirmation.trackingId, parsed.data.stage);
  return NextResponse.json({ quotation: updated });
}
