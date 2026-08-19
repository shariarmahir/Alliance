import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { Resend } from "resend";
import { readQuotation } from "@/app/lib/admin-operations";
import { buildQuotationEmailHtml } from "@/app/lib/quotation-email";
import { requireAreaSession, isSessionResponse } from "../../../_auth";

// POST /api/admin/quotations/[id]/email — emails the already-issued PDF
// (generated client-side, same as the download button) to the customer's
// address on file. The PDF itself is generated in the browser via jsPDF
// (see quotation-pdf.ts, which relies on window/document for image
// downscaling) and handed here as base64 rather than rebuilt server-side.

// Every quotation sent to a customer is copied to the company inbox.
const COMPANY_EMAIL = "info@auto-bd.com";

// Resend's unverified-domain sandbox rejects the whole request (403) if ANY
// recipient — to, cc or bcc — is an address other than the account owner's.
// So both the custom From and the company CC stay off until auto-bd.com is
// verified at resend.com/domains; set RESEND_DOMAIN_VERIFIED=true then and
// both switch on together, no code change needed.
const DOMAIN_VERIFIED = process.env.RESEND_DOMAIN_VERIFIED === "true";

const FROM_ADDRESS = DOMAIN_VERIFIED
  ? `AutoLink Integrated Technologies <${COMPANY_EMAIL}>`
  : "AutoLink Integrated Technologies <onboarding@resend.dev>";

const EmailSchema = z.object({
  pdfBase64: z.string().min(1),
  fileName: z.string().min(1),
  // Echoed back from the confirm response the client just received. Blob
  // reads are served from a CDN that briefly lags a write, so re-reading the
  // record here can return the pre-confirmation copy and wrongly report the
  // quotation as unissued — the first send after confirming used to fail for
  // exactly that reason. These fields let the send proceed on what was just
  // written, with the stored record used only as a fallback.
  confirmation: z
    .object({
      refNumber: z.string().min(1),
      subject: z.string().min(1),
      issuedDate: z.string().min(1),
      grandTotal: z.number(),
      trackingId: z.string().min(1),
      lineCount: z.number().int().min(1),
    })
    .optional(),
});

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAreaSession("quotations");
  if (isSessionResponse(session)) return session;

  const { id } = await params;
  const body = await request.json();
  const parsed = EmailSchema.safeParse(body);
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

  // Prefer what the caller just confirmed; fall back to the stored copy for
  // callers that re-send an already-issued quotation without echoing it.
  const stored = quotation.confirmation;
  const issued = parsed.data.confirmation
    ? {
        refNumber: parsed.data.confirmation.refNumber,
        subject: parsed.data.confirmation.subject,
        issuedDate: parsed.data.confirmation.issuedDate,
        grandTotal: parsed.data.confirmation.grandTotal,
        trackingId: parsed.data.confirmation.trackingId,
        lineCount: parsed.data.confirmation.lineCount,
      }
    : stored
      ? {
          refNumber: stored.refNumber,
          subject: stored.subject,
          issuedDate: stored.issuedDate,
          grandTotal: stored.grandTotal,
          trackingId: stored.trackingId,
          lineCount: stored.lines.length,
        }
      : null;

  if (!issued) {
    return NextResponse.json({ error: "Quotation has not been issued yet" }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "Email is not configured on the server (missing RESEND_API_KEY)." },
      { status: 503 }
    );
  }

  const resend = new Resend(apiKey);
  const { details } = quotation;

  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: details.email,
    ...(DOMAIN_VERIFIED ? { cc: COMPANY_EMAIL } : {}),
    replyTo: COMPANY_EMAIL,
    subject: issued.subject,
    html: buildQuotationEmailHtml({
      recipientName: details.fullName,
      companyName: details.companyName,
      refNumber: issued.refNumber,
      subject: issued.subject,
      issuedDate: issued.issuedDate,
      itemCount: issued.lineCount,
      grandTotal: issued.grandTotal,
      trackingId: issued.trackingId,
    }),
    attachments: [
      {
        filename: parsed.data.fileName,
        content: parsed.data.pdfBase64,
      },
    ],
  });

  if (error) {
    return NextResponse.json({ error: error.message ?? "Could not send the email." }, { status: 502 });
  }

  return NextResponse.json({ ok: true });
}
