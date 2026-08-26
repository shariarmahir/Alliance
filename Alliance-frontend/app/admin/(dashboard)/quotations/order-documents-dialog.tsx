"use client";

import { useState } from "react";
import { toast } from "sonner";
import { FolderOpen, FileText, Receipt, Truck, Paperclip, PenLine } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/app/components/ui/dialog";
import { formatPrice } from "@/app/lib/utils";
import { apiFetch, apiDownload, ApiError, API_BASE_URL } from "@/app/lib/api-browser";
import type { Invoice, Challan } from "@/app/lib/admin-data";
import type { Quotation } from "@/app/lib/types";

// Section C's "View Documents": every file attached to one order in a single
// list — the customer's PO, each invoice, each challan, and any signed
// delivery copy that has come back.
//
// Distinct from Order History, which is the timeline of what happened. This
// is the filing cabinet: what can be opened and handed to someone.

const ROW =
  "flex items-center justify-between gap-3 rounded-md border border-[#e8edf3] px-3 py-2.5";

function DocumentRow({
  icon: Icon,
  title,
  meta,
  action,
}: {
  icon: typeof FileText;
  title: string;
  meta: string;
  action: React.ReactNode;
}) {
  return (
    <li className={ROW}>
      <span className="flex min-w-0 items-center gap-2.5">
        <Icon className="size-4 shrink-0 text-primary" />
        <span className="min-w-0">
          <span className="block truncate text-[12.5px] font-semibold text-ink">{title}</span>
          <span className="block truncate text-[11px] text-ink-muted">{meta}</span>
        </span>
      </span>
      {action}
    </li>
  );
}

function DownloadButton({ path, fileName }: { path: string; fileName: string }) {
  const [busy, setBusy] = useState(false);
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await apiDownload(path, fileName);
        } catch (error) {
          toast.error(
            error instanceof ApiError ? error.message : "Could not open the document."
          );
        } finally {
          setBusy(false);
        }
      }}
      className="shrink-0 rounded-md border border-[#dde3ea] px-2.5 py-1 text-[11.5px] font-semibold text-ink-soft transition-colors hover:border-primary hover:text-primary disabled:opacity-60"
    >
      {busy ? "..." : "Open"}
    </button>
  );
}

function LinkButton({ href }: { href: string }) {
  return (
    <a
      href={href.startsWith("http") ? href : `${API_BASE_URL}${href}`}
      target="_blank"
      rel="noreferrer"
      className="shrink-0 rounded-md border border-[#dde3ea] px-2.5 py-1 text-[11.5px] font-semibold text-ink-soft transition-colors hover:border-primary hover:text-primary"
    >
      Open
    </a>
  );
}

export function OrderDocumentsDialog({ quotation }: { quotation: Quotation }) {
  const [open, setOpen] = useState(false);
  const [invoices, setInvoices] = useState<Invoice[] | null>(null);
  const [challans, setChallans] = useState<Challan[] | null>(null);
  const [loading, setLoading] = useState(false);

  // Fetched on open: two extra queries per confirmed row on every page load
  // would be paid by everyone to serve the few who click.
  async function load(next: boolean) {
    setOpen(next);
    if (!next || invoices) return;
    setLoading(true);
    try {
      const [allInvoices, allChallans] = await Promise.all([
        apiFetch<Invoice[]>("/api/admin/invoices"),
        apiFetch<Challan[]>("/api/admin/challans"),
      ]);
      setInvoices(allInvoices.filter((i) => i.quotationId === quotation.id));
      setChallans(allChallans.filter((c) => c.quotationId === quotation.id));
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Could not load the documents."
      );
      setOpen(false);
    } finally {
      setLoading(false);
    }
  }

  const total =
    (quotation.confirmation ? 1 : 0) +
    (quotation.poDocumentUrl ? 1 : 0) +
    (invoices?.length ?? 0) +
    (challans?.length ?? 0) +
    (challans?.filter((c) => c.signedDocumentUrl).length ?? 0);

  return (
    <Dialog open={open} onOpenChange={load}>
      <DialogTrigger className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-[#dde3ea] px-2.5 py-1.5 text-[11.5px] font-semibold text-ink-soft transition-colors hover:border-primary hover:text-primary">
        <FolderOpen className="size-3.5" /> Documents
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="text-[17px] font-bold text-ink">Order documents</DialogTitle>
          <DialogDescription className="text-[12.5px] text-ink-muted">
            {quotation.details.companyName}
            {loading ? " · loading…" : total > 0 ? ` · ${total} document(s)` : ""}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p className="py-8 text-center text-[13px] text-ink-muted">Loading…</p>
        ) : (
          <ul className="max-h-[60vh] space-y-2 overflow-y-auto">
            {quotation.confirmation && (
              <DocumentRow
                icon={FileText}
                title={`Quotation ${quotation.confirmation.refNumber}`}
                meta={`${quotation.confirmation.issuedDate} · ${formatPrice(
                  quotation.confirmation.grandTotal
                )}`}
                action={
                  <DownloadButton
                    path={`/api/admin/quotations/${encodeURIComponent(quotation.id)}/pdf`}
                    fileName={`${quotation.confirmation.refNumber.replace(/\//g, "-")}.pdf`}
                  />
                }
              />
            )}

            {quotation.poDocumentUrl && (
              <DocumentRow
                icon={Paperclip}
                title={`Work Order / PO${quotation.poNumber ? ` ${quotation.poNumber}` : ""}`}
                meta="Supplied by the customer"
                action={<LinkButton href={quotation.poDocumentUrl} />}
              />
            )}

            {(invoices ?? []).map((invoice) => (
              <DocumentRow
                key={invoice.id}
                icon={Receipt}
                title={`Invoice ${invoice.invoiceNumber ?? "(draft)"}`}
                meta={`${invoice.status.replace("_", " ")} · ${formatPrice(invoice.grandTotal)}`}
                action={
                  <DownloadButton
                    path={`/api/admin/invoices/${encodeURIComponent(invoice.id)}/pdf`}
                    fileName={`${invoice.invoiceNumber ?? "invoice-draft"}.pdf`}
                  />
                }
              />
            ))}

            {(challans ?? []).map((challan) => (
              <DocumentRow
                key={challan.id}
                icon={Truck}
                title={`Challan ${challan.challanNumber ?? "(draft)"}`}
                meta={`${challan.status} · ${challan.lines.reduce(
                  (sum, l) => sum + l.quantity,
                  0
                )} unit(s)`}
                action={
                  <DownloadButton
                    path={`/api/admin/challans/${encodeURIComponent(challan.id)}/pdf`}
                    fileName={`${challan.challanNumber ?? "challan-draft"}.pdf`}
                  />
                }
              />
            ))}

            {/* The customer's countersigned copy is the proof of delivery, so
                it is listed separately from the challan it belongs to. */}
            {(challans ?? [])
              .filter((c) => c.signedDocumentUrl)
              .map((challan) => (
                <DocumentRow
                  key={`${challan.id}-signed`}
                  icon={PenLine}
                  title={`Signed copy · ${challan.challanNumber ?? "draft"}`}
                  meta="Received from the customer"
                  action={<LinkButton href={challan.signedDocumentUrl!} />}
                />
              ))}

            {total === 0 && (
              <li className="rounded-md border border-dashed border-[#e0e6ee] px-3 py-8 text-center text-[12.5px] text-ink-muted">
                Nothing attached yet. The quotation, PO, invoices and challans appear here
                as they are raised.
              </li>
            )}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
