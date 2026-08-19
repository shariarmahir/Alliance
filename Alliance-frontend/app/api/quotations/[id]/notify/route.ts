import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Resend } from "resend";
import { readQuotation } from "@/app/lib/admin-operations";
import { buildPriceRequestEmailHtml } from "@/app/lib/quotation-email";

// POST /api/quotations/[id]/notify — fired right after a customer's "Send
// Quotation" submit (see app/(site)/quote/page.tsx), so the company inbox
// gets the un-priced request as a PDF the moment it lands, without waiting
// for anyone to open the admin dashboard. Best-effort: the customer's flow
// never blocks or fails on this, same reasoning as the admin's confirm-and-
// email send.
const COMPANY_EMAIL = "info@auto-bd.com";

// Same sandbox restriction as the admin's issued-quotation email: an
// unverified Resend domain rejects any recipient but the account owner's own
// address. Until auto-bd.com verifies, this send is a no-op rather than a
// visible failure — the request itself is already saved via /api/quotations.
const DOMAIN_VERIFIED = process.env.RESEND_DOMAIN_VERIFIED === "true";

const FROM_ADDRESS = DOMAIN_VERIFIED
  ? `AutoLink Integrated Technologies <${COMPANY_EMAIL}>`
  : "AutoLink Integrated Technologies <onboarding@resend.dev>";

const NotifySchema = z.object({
  pdfBase64: z.string().min(1),
  fileName: z.string().min(1),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await request.json();
  const parsed = NotifySchema.safeParse(body);
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

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !DOMAIN_VERIFIED) {
    // Not an error the customer should ever see — email is a courtesy copy,
    // not part of the request being recorded. Domain verification and the
    // API key are operator setup steps, not something a customer submission
    // should fail on.
    return NextResponse.json({ ok: false, skipped: true });
  }

  const resend = new Resend(apiKey);
  const { items, details } = quotation;
  const totalUnits = items.reduce((sum, i) => sum + i.quantity, 0);

  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: COMPANY_EMAIL,
    replyTo: details.email,
    subject: `New price request from ${details.companyName || details.fullName}`,
    html: buildPriceRequestEmailHtml({
      quotationId: quotation.id,
      fullName: details.fullName,
      email: details.email,
      phone: details.phone,
      companyName: details.companyName,
      country: details.country,
      itemCount: items.length,
      totalUnits,
      notes: details.notes,
    }),
    attachments: [
      {
        filename: parsed.data.fileName,
        content: parsed.data.pdfBase64,
      },
    ],
  });

  if (error) {
    return NextResponse.json({ ok: false, error: error.message ?? "Could not send the email." });
  }

  return NextResponse.json({ ok: true });
}
