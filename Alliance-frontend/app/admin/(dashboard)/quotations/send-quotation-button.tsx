"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Mail } from "lucide-react";
import { apiFetch, ApiError } from "@/app/lib/api-browser";
import { quotationPdfToBase64 } from "@/app/lib/quotation-pdf";
import type { Quotation } from "@/app/lib/types";

// Step 9-10 of the client's workflow: e-mail the prepared quotation, and let
// a *successful* send be what moves it to Submitted.
//
// The status change lives on the server, keyed to delivery rather than to
// this click — a failed send leaves the quotation in Pending so it still
// shows up as owing the customer an answer. Claiming Submitted on a send
// that bounced is the one outcome worse than not sending at all.

export function SendQuotationButton({
  quotation,
  onSent,
}: {
  quotation: Quotation;
  onSent: () => void;
}) {
  const router = useRouter();
  const [sending, setSending] = useState(false);

  async function send() {
    if (!quotation.confirmation) {
      toast.error("Prepare the quotation before sending it.");
      return;
    }
    setSending(true);
    const toastId = toast.loading("Preparing the quotation PDF...");
    try {
      // Rendered from the same builder the download button uses, so the
      // customer receives exactly the document the admin reviewed.
      const { base64, fileName } = await quotationPdfToBase64(quotation);

      toast.loading(`Sending to ${quotation.details.email}...`, { id: toastId });
      const result = await apiFetch<{ sent: boolean; attached: boolean }>(
        `/api/admin/quotations/${encodeURIComponent(quotation.id)}/email`,
        { method: "POST", body: { pdfBase64: base64, fileName } }
      );

      toast.success("Quotation sent", {
        id: toastId,
        description: result.attached
          ? `Delivered to ${quotation.details.email}. Moved to Submitted.`
          : `Delivered to ${quotation.details.email}, but the PDF could not be attached.`,
        duration: 8000,
      });
      onSent();
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Could not send the quotation.",
        {
          id: toastId,
          description: "It stays in Pending, so you can retry the send.",
          duration: 7000,
        }
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={send}
      disabled={sending}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-primary bg-[#eaf4fb] px-2.5 py-1.5 text-[11.5px] font-semibold text-primary transition-colors hover:bg-primary hover:text-white disabled:opacity-60"
    >
      <Mail className="size-3.5" /> {sending ? "Sending..." : "Send E-mail"}
    </button>
  );
}
