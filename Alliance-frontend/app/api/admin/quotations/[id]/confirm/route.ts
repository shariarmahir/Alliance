import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { confirmQuotation, readQuotation } from "@/app/lib/admin-operations";
import { generateProductId, generateTrackingId } from "@/app/lib/order-confirmation";
import type { ConfirmedLine, OrderConfirmation } from "@/app/lib/types";
import { requireSuperAdminSession, isSessionResponse } from "../../../_auth";

// POST /api/admin/quotations/[id]/confirm — issues the order confirmation.
// The admin supplies the editable fields (ref, subject, date, per-line price
// and unit, terms); product IDs and the tracking number are generated here
// rather than accepted from the client so they can't be spoofed or collide.

const LineSchema = z.object({
  slug: z.string().min(1),
  specifications: z.string(),
  quantity: z.number().int().min(1),
  unit: z.string().min(1),
  unitPrice: z.number().min(0),
});

const TermsSchema = z.object({
  payment: z.string(),
  delivery: z.string(),
  offerValidity: z.string(),
  vatAit: z.string(),
  stock: z.string(),
  installationCharge: z.string(),
  warranty: z.string(),
});

const ConfirmSchema = z.object({
  refNumber: z.string().min(1),
  subject: z.string().min(1),
  issuedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected yyyy-mm-dd"),
  lines: z.array(LineSchema).min(1),
  terms: TermsSchema,
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSuperAdminSession();
  if (isSessionResponse(session)) return session;

  const { id } = await params;
  const body = await request.json();
  const parsed = ConfirmSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", fields: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const quotation = await readQuotation(id);
  if (!quotation) {
    return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
  }

  // Name/part number/image come from the original request, not the payload —
  // the admin can reprice a line but not silently swap what was ordered.
  const lines: ConfirmedLine[] = [];
  for (const line of parsed.data.lines) {
    const item = quotation.items.find((i) => i.slug === line.slug);
    if (!item) {
      return NextResponse.json(
        { error: `Line does not belong to this quotation: ${line.slug}` },
        { status: 400 }
      );
    }
    lines.push({
      productId: generateProductId(),
      slug: item.slug,
      partNumber: item.partNumber,
      name: item.name,
      image: item.image,
      specifications: line.specifications,
      quantity: line.quantity,
      unit: line.unit,
      unitPrice: line.unitPrice,
      total: line.quantity * line.unitPrice,
    });
  }

  const confirmation: OrderConfirmation = {
    refNumber: parsed.data.refNumber,
    subject: parsed.data.subject,
    issuedDate: parsed.data.issuedDate,
    // Re-issuing keeps the original tracking number so a customer who already
    // has the first PDF isn't left tracking a dead ID.
    trackingId: quotation.confirmation?.trackingId ?? generateTrackingId(),
    lines,
    grandTotal: lines.reduce((sum, l) => sum + l.total, 0),
    terms: parsed.data.terms,
    issuedAt: new Date().toISOString(),
  };

  const updated = await confirmQuotation(id, confirmation);
  return NextResponse.json({ quotation: updated });
}
