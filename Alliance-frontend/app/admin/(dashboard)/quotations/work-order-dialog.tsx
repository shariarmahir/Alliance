"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileUp, Paperclip } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/app/components/ui/dialog";
import { apiFetch, apiUpload, ApiError, API_BASE_URL } from "@/app/lib/api-browser";
import type { Quotation } from "@/app/lib/types";

// Step 13 of the client's workflow: the customer's own Work Order / Purchase
// Order, stored against the confirmed record so the order carries the
// paperwork that authorised it.
//
// Number and document are saved separately because they arrive separately —
// a PO number is usually quoted by phone or e-mail days before the signed
// document turns up, and making the number wait on the file would leave the
// order looking unauthorised in the meantime.

export function WorkOrderDialog({ quotation }: { quotation: Quotation }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [poNumber, setPoNumber] = useState(quotation.poNumber ?? "");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  const hasDocument = Boolean(quotation.poDocumentUrl);

  async function save() {
    if (!poNumber.trim() && !file) {
      toast.error("Enter a PO number or attach the document.");
      return;
    }
    setBusy(true);
    try {
      if (poNumber.trim() && poNumber.trim() !== (quotation.poNumber ?? "")) {
        await apiFetch(`/api/admin/quotations/${encodeURIComponent(quotation.id)}/work-order`, {
          method: "PATCH",
          body: { poNumber: poNumber.trim() },
        });
      }
      if (file) {
        const form = new FormData();
        form.append("file", file);
        await apiUpload(
          `/api/admin/quotations/${encodeURIComponent(quotation.id)}/work-order`,
          form
        );
      }
      toast.success("Work Order / PO saved.");
      setFile(null);
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Could not save the Work Order."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        className={`inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11.5px] font-semibold transition-colors ${
          hasDocument || quotation.poNumber
            ? "border-[#dde3ea] text-ink-soft hover:border-primary hover:text-primary"
            : "border-accent bg-[#fff8e6] text-[#8a6400] hover:bg-accent hover:text-white"
        }`}
      >
        <FileUp className="size-3.5" />
        {quotation.poNumber ? `PO ${quotation.poNumber}` : "Upload Work Order/PO"}
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-[17px] font-bold text-ink">
            Work Order / Purchase Order
          </DialogTitle>
          <DialogDescription className="text-[12.5px] text-ink-muted">
            Store the customer&apos;s confirming document against this order.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="mono-label mb-1.5 block text-[10.5px] text-ink-muted">
              PO / WO Number
            </label>
            <input
              value={poNumber}
              onChange={(e) => setPoNumber(e.target.value)}
              placeholder="e.g. PO-2026-0142"
              className="w-full rounded-md border border-[#dde3ea] px-3 py-2 text-[13px] text-ink outline-none focus:border-primary"
            />
          </div>

          <div>
            <label className="mono-label mb-1.5 block text-[10.5px] text-ink-muted">
              Document {hasDocument && "(replaces the current file)"}
            </label>
            <input
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full rounded-md border border-[#dde3ea] px-3 py-2 text-[12.5px] text-ink-soft file:mr-3 file:rounded file:border-0 file:bg-[#eef4f9] file:px-3 file:py-1 file:text-[11.5px] file:font-semibold file:text-primary"
            />
            <p className="mt-1 text-[11px] text-ink-muted">PDF, JPG, PNG or WEBP, up to 15 MB.</p>
          </div>

          {hasDocument && (
            <a
              href={`${API_BASE_URL}${quotation.poDocumentUrl}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-primary hover:underline"
            >
              <Paperclip className="size-3.5" /> View the stored document
            </a>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-md border border-[#dde3ea] px-3.5 py-2 text-[12.5px] font-semibold text-ink-soft"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="rounded-md bg-primary px-3.5 py-2 text-[12.5px] font-semibold text-white disabled:opacity-60"
          >
            {busy ? "Saving..." : "Save"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
