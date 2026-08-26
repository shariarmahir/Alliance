"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Download, Printer } from "lucide-react";
import { API_BASE_URL, apiDownload, ApiError } from "@/app/lib/api-browser";

// Print and Download for the Invoice and Challan documents, which the
// client's specification requires on both.
//
// Both read the same server-rendered PDF, so what a customer receives by
// e-mail, what prints, and what downloads are one document. Rendering a
// separate print stylesheet would be a second layout to keep in step, and
// the two would drift the first time either changed.

const BTN =
  "inline-flex shrink-0 items-center gap-1.5 rounded-md border border-[#dde3ea] px-2.5 py-1.5 " +
  "text-[11.5px] font-semibold text-ink-soft transition-colors hover:border-primary " +
  "hover:text-primary disabled:opacity-60";

export function DocumentActions({
  path,
  fileName,
  label = "PDF",
}: {
  /** API path of the PDF, e.g. `/api/admin/invoices/{id}/pdf`. */
  path: string;
  fileName: string;
  label?: string;
}) {
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    try {
      await apiDownload(path, fileName);
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Could not generate the document."
      );
    } finally {
      setBusy(false);
    }
  }

  // Opened in a tab rather than fetched into a hidden iframe: the browser's
  // own PDF viewer already has a print button, and a blob in an iframe is
  // blocked outright by some browsers' PDF handling.
  function print() {
    window.open(`${API_BASE_URL}${path}`, "_blank", "noopener,noreferrer");
  }

  return (
    <>
      <button type="button" onClick={download} disabled={busy} className={BTN}>
        <Download className="size-3.5" /> {busy ? "..." : label}
      </button>
      <button type="button" onClick={print} className={BTN}>
        <Printer className="size-3.5" /> Print
      </button>
    </>
  );
}
