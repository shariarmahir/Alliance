"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Download, FileText, Mail, ReceiptText, BadgeCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/app/components/ui/dialog";
import { formatPrice } from "@/app/lib/utils";
import {
  PageHeader,
  Panel,
  EmptyState,
  FilterBar,
  Pill,
  RowButton,
  TH,
  TD,
  ROW,
} from "../admin-ui";
import { apiFetch, ApiError } from "@/app/lib/api-browser";
import {
  downloadQuotationPdf,
  downloadConfirmedOrderInvoice,
  invoicePdfToBase64,
  invoiceRefNumber,
} from "@/app/lib/quotation-pdf";
import {
  downloadChallanPdf,
  challanPdfToBase64,
  quotationToChallan,
  downloadReceiptPdf,
} from "@/app/lib/challan-pdf";
import { DELIVERY_STAGES, MAX_STAGE, clampStage } from "@/app/lib/delivery";
import type { Quotation, PaymentStatus } from "@/app/lib/types";

// Every row is an accepted price request. Its order state (Pending or
// Confirmed) is stored as the confirmation's stage index, which is what the
// backend compares to decide whether to email the customer. Carried as a
// string here because FilterBar is keyed on strings.
type StageFilter = string;

// The invoice is the quotation document retitled and issued against the
// confirmed order, so there is nothing to fill in here either — the dialog
// shows what will be sent and keeps the two actions apart, since an emailed
// invoice cannot be recalled.
function CreateInvoiceDialog({ quotation }: { quotation: Quotation }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<"download" | "email" | null>(null);

  const confirmation = quotation.confirmation;
  if (!confirmation) return null;
  const ref = invoiceRefNumber(quotation);

  async function download() {
    setBusy("download");
    try {
      await downloadConfirmedOrderInvoice(quotation);
    } catch {
      toast.error("Could not generate the invoice.");
    } finally {
      setBusy(null);
    }
  }

  async function sendEmail() {
    setBusy("email");
    const toastId = toast.loading("Preparing the invoice...");
    try {
      const { base64, fileName } = await invoicePdfToBase64(quotation);
      toast.loading(`Sending to ${quotation.details.email}...`, { id: toastId });
      await apiFetch(
        `/api/admin/quotations/${encodeURIComponent(quotation.id)}/invoice/email`,
        { method: "POST", body: { pdfBase64: base64, fileName } }
      );
      toast.success("Invoice sent", {
        id: toastId,
        description: `${ref} delivered to ${quotation.details.email}.`,
        duration: 7000,
      });
      setOpen(false);
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Could not send the invoice.",
        { id: toastId }
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button
            type="button"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-[#dde3ea] px-2.5 py-1.5 text-[11.5px] font-semibold text-ink-soft transition-colors hover:border-primary hover:text-primary"
          >
            <ReceiptText className="size-3.5" /> Create Invoice
          </button>
        }
      />
      <DialogContent className="max-h-[85vh] w-full max-w-lg overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-[17px] font-bold text-ink">Invoice</DialogTitle>
          <DialogDescription className="font-mono text-[11.5px] text-[#8a94a6]">
            {ref} &middot; {quotation.details.companyName || quotation.details.fullName}
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-hidden rounded-[10px] border border-slate-line">
          {confirmation.lines.map((line, i) => (
            <div
              key={`${line.slug}-${i}`}
              className="flex items-center justify-between gap-4 border-b border-[#f2f4f7] px-3.5 py-2.5 last:border-b-0"
            >
              <div className="min-w-0">
                <p className="truncate text-[12.5px] font-semibold text-ink">{line.name}</p>
                <p className="font-mono text-[11px] text-[#8a94a6]">
                  {line.quantity} {line.unit} &times; {formatPrice(line.unitPrice)}
                </p>
              </div>
              <span className="shrink-0 font-mono text-[12.5px] font-semibold text-ink">
                {formatPrice(line.total)}
              </span>
            </div>
          ))}
          <div className="flex items-center justify-between gap-4 border-t border-slate-line bg-surface px-3.5 py-2.5">
            <span className="text-[12.5px] font-bold text-ink">Grand total</span>
            <span className="font-mono text-[13px] font-bold text-ink">
              {formatPrice(confirmation.grandTotal)}
            </span>
          </div>
        </div>

        <p className="text-[11.5px] leading-[1.6] text-[#8a94a6]">
          Emailing sends this invoice to{" "}
          <strong className="text-ink">{quotation.details.email}</strong>.
        </p>

        <div className="flex flex-wrap justify-end gap-2 border-t border-hairline pt-4">
          <button
            type="button"
            onClick={download}
            disabled={busy !== null}
            className="inline-flex items-center gap-2 rounded-[9px] border border-slate-line bg-white px-4 py-2.5 text-[13px] font-bold text-ink transition-colors hover:border-primary hover:text-primary disabled:opacity-60"
          >
            <Download className="size-4" />
            {busy === "download" ? "Preparing..." : "Download PDF"}
          </button>
          <button
            type="button"
            onClick={sendEmail}
            disabled={busy !== null}
            className="btn-sheen inline-flex items-center gap-2 rounded-[9px] border border-white/40 bg-accent/90 px-4 py-2.5 text-[13px] font-bold text-ink transition-all hover:-translate-y-0.5 hover:bg-accent disabled:opacity-60"
          >
            <Mail className="size-4" />
            {busy === "email" ? "Sending..." : "Send Email"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// The challan is produced from the confirmed order's own lines, so there is
// nothing to fill in — the dialog exists to show what will be sent and to
// separate the two actions, since emailing one is not undoable.
function CreateChallanDialog({ quotation }: { quotation: Quotation }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<"download" | "email" | null>(null);

  const spec = quotationToChallan(quotation);

  async function download() {
    setBusy("download");
    try {
      await downloadChallanPdf(quotation);
    } catch {
      toast.error("Could not generate the challan.");
    } finally {
      setBusy(null);
    }
  }

  async function sendEmail() {
    setBusy("email");
    const toastId = toast.loading("Preparing the challan...");
    try {
      // Rendered here and posted, so the customer receives the same file the
      // download button produces rather than a server-side approximation.
      const { base64, fileName } = await challanPdfToBase64(quotation);
      toast.loading(`Sending to ${quotation.details.email}...`, { id: toastId });
      await apiFetch(
        `/api/admin/quotations/${encodeURIComponent(quotation.id)}/challan/email`,
        { method: "POST", body: { pdfBase64: base64, fileName } }
      );
      toast.success("Challan sent", {
        id: toastId,
        description: `${spec.refNumber} delivered to ${quotation.details.email}.`,
        duration: 7000,
      });
      setOpen(false);
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Could not send the challan.",
        { id: toastId }
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button
            type="button"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-[#dde3ea] px-2.5 py-1.5 text-[11.5px] font-semibold text-ink-soft transition-colors hover:border-primary hover:text-primary"
          >
            <FileText className="size-3.5" /> Create Challan
          </button>
        }
      />
      <DialogContent className="max-h-[85vh] w-full max-w-lg overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-[17px] font-bold text-ink">Delivery challan</DialogTitle>
          <DialogDescription className="font-mono text-[11.5px] text-[#8a94a6]">
            {spec.refNumber} &middot; {spec.recipient.company}
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-hidden rounded-[10px] border border-slate-line">
          {spec.lines.map((line, i) => (
            <div
              key={`${line.name}-${i}`}
              className="flex items-start justify-between gap-4 border-b border-[#f2f4f7] px-3.5 py-3 last:border-b-0"
            >
              <div className="min-w-0">
                <p className="text-[12.5px] font-semibold text-ink">{line.name}</p>
                {line.bullets.length > 0 && (
                  <ul className="mt-1 space-y-0.5">
                    {line.bullets.map((b) => (
                      <li key={b} className="text-[11.5px] leading-[1.5] text-ink-muted">
                        &bull; {b}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <span className="shrink-0 font-mono text-[12.5px] font-semibold text-ink">
                {line.quantity}
              </span>
            </div>
          ))}
        </div>

        <p className="text-[11.5px] leading-[1.6] text-[#8a94a6]">
          No prices appear on a challan. Emailing sends this document to{" "}
          <strong className="text-ink">{quotation.details.email}</strong>.
        </p>

        <div className="flex flex-wrap justify-end gap-2 border-t border-hairline pt-4">
          <button
            type="button"
            onClick={download}
            disabled={busy !== null}
            className="inline-flex items-center gap-2 rounded-[9px] border border-slate-line bg-white px-4 py-2.5 text-[13px] font-bold text-ink transition-colors hover:border-primary hover:text-primary disabled:opacity-60"
          >
            <Download className="size-4" />
            {busy === "download" ? "Preparing..." : "Download PDF"}
          </button>
          <button
            type="button"
            onClick={sendEmail}
            disabled={busy !== null}
            className="btn-sheen inline-flex items-center gap-2 rounded-[9px] border border-white/40 bg-accent/90 px-4 py-2.5 text-[13px] font-bold text-ink transition-all hover:-translate-y-0.5 hover:bg-accent disabled:opacity-60"
          >
            <Mail className="size-4" />
            {busy === "email" ? "Sending..." : "Send Email"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function OrderRow({
  quotation,
  onChanged,
}: {
  quotation: Quotation;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [receipting, setReceipting] = useState(false);
  const confirmation = quotation.confirmation;
  if (!confirmation) return null;

  const stage = clampStage(confirmation.deliveryStage ?? 0);
  const paid = confirmation.paymentStatus === "received";

  async function setStage(next: number) {
    setBusy(true);
    try {
      await apiFetch(
        `/api/admin/quotations/${encodeURIComponent(quotation.id)}/delivery`,
        { method: "PATCH", body: { stage: next } }
      );
      toast.success(`Marked ${DELIVERY_STAGES[next].label.toLowerCase()}.`, {
        description:
          next === MAX_STAGE ? "A confirmation email has been sent to the customer." : undefined,
      });
      onChanged();
    } catch {
      toast.error("Could not update the order status.");
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    setBusy(true);
    try {
      await apiFetch(
        `/api/admin/quotations/${encodeURIComponent(quotation.id)}/status`,
        { method: "PATCH", body: { status: "cancelled" } }
      );
      toast.success(`Order ${confirmation!.refNumber} cancelled.`);
      onChanged();
    } catch {
      toast.error("Could not cancel this order.");
    } finally {
      setBusy(false);
    }
  }

  async function download() {
    setDownloading(true);
    try {
      await downloadQuotationPdf(quotation);
    } catch {
      toast.error("Could not generate the PDF.");
    } finally {
      setDownloading(false);
    }
  }

  async function setPayment(next: PaymentStatus) {
    setBusy(true);
    try {
      await apiFetch(
        `/api/admin/quotations/${encodeURIComponent(quotation.id)}/payment`,
        { method: "PATCH", body: { status: next } }
      );
      toast.success(
        next === "received" ? "Payment marked received." : "Payment marked pending."
      );
      onChanged();
    } catch {
      toast.error("Could not update the payment status.");
    } finally {
      setBusy(false);
    }
  }

  async function downloadReceipt() {
    setReceipting(true);
    try {
      await downloadReceiptPdf(quotation);
    } catch {
      toast.error("Could not generate the receipt.");
    } finally {
      setReceipting(false);
    }
  }

  return (
    <tr className={ROW}>
      <td className={`${TD} font-mono text-[12px] font-semibold text-ink`}>
        {confirmation.refNumber}
      </td>
      <td className={`${TD} text-ink-soft`}>
        {quotation.details.companyName || quotation.details.fullName}
        <span className="block text-[11px] text-[#8a94a6]">
          {quotation.details.country}
        </span>
      </td>
      <td className={`${TD} font-mono text-ink-soft`}>{confirmation.lines.length}</td>
      <td className={`${TD} font-mono font-semibold text-ink`}>
        {formatPrice(confirmation.grandTotal)}
      </td>
      <td className={`${TD} font-mono text-[11.5px] text-ink-muted`}>
        {new Date(confirmation.issuedAt).toLocaleDateString("en-GB")}
      </td>
      <td className={TD}>
        <Pill tone={stage >= MAX_STAGE ? "ok" : "warn"}>
          {DELIVERY_STAGES[stage].label.toUpperCase()}
        </Pill>
      </td>
      <td className={TD}>
        <Pill tone={paid ? "ok" : "warn"}>{paid ? "RECEIVED" : "PENDING"}</Pill>
      </td>
      <td className={TD}>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={stage}
            disabled={busy}
            onChange={(e) => setStage(Number(e.target.value))}
            className="rounded-md border border-[#dde3ea] bg-white px-2 py-1.5 text-[11.5px] font-semibold text-ink-soft outline-none transition-colors hover:border-primary focus:border-primary disabled:opacity-60"
          >
            {DELIVERY_STAGES.map((s, i) => (
              <option key={s.label} value={i}>
                {s.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={download}
            disabled={downloading}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-[#dde3ea] px-2.5 py-1.5 text-[11.5px] font-semibold text-ink-soft transition-colors hover:border-primary hover:text-primary disabled:opacity-60"
          >
            <Download className="size-3.5" /> {downloading ? "..." : "Download PDF"}
          </button>
          <select
            value={confirmation.paymentStatus ?? "pending"}
            disabled={busy}
            onChange={(e) => setPayment(e.target.value as PaymentStatus)}
            aria-label="Payment status"
            className="rounded-md border border-[#dde3ea] bg-white px-2 py-1.5 text-[11.5px] font-semibold text-ink-soft outline-none transition-colors hover:border-primary focus:border-primary disabled:opacity-60"
          >
            <option value="pending">Payment: Pending</option>
            <option value="received">Payment: Received</option>
          </select>
          {/* A receipt is proof money was taken, so it only exists once
              payment is actually recorded as received. */}
          {paid && (
            <button
              type="button"
              onClick={downloadReceipt}
              disabled={receipting}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-[#dde3ea] px-2.5 py-1.5 text-[11.5px] font-semibold text-ink-soft transition-colors hover:border-primary hover:text-primary disabled:opacity-60"
            >
              <BadgeCheck className="size-3.5" />
              {receipting ? "..." : "Download Receipt"}
            </button>
          )}
          <CreateChallanDialog quotation={quotation} />
          <CreateInvoiceDialog quotation={quotation} />
          <RowButton tone="danger" disabled={busy} onClick={cancel}>
            Cancel
          </RowButton>
        </div>
      </td>
    </tr>
  );
}

export function OrdersClient({ initialOrders }: { initialOrders: Quotation[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<StageFilter>("all");

  const stageOf = (q: Quotation) => clampStage(q.confirmation?.deliveryStage ?? 0);
  const count = (s: number) => initialOrders.filter((q) => stageOf(q) === s).length;

  const sorted = [
    ...(filter === "all"
      ? initialOrders
      : initialOrders.filter((q) => String(stageOf(q)) === filter)),
  ].sort(
    (a, b) =>
      new Date(b.confirmation?.issuedAt ?? 0).getTime() -
      new Date(a.confirmation?.issuedAt ?? 0).getTime()
  );

  const totalValue = initialOrders.reduce(
    (sum, q) => sum + (q.confirmation?.grandTotal ?? 0),
    0
  );
  const confirmed = count(MAX_STAGE);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Orders"
        subtitle="Accepted price requests. Confirm an order to notify the customer."
      >
        <FilterBar
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All", count: initialOrders.length },
            ...DELIVERY_STAGES.map((s, i) => ({
              value: String(i),
              label: s.label,
              count: count(i),
            })),
          ]}
        />
      </PageHeader>

      {initialOrders.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: "Awaiting confirmation", value: String(initialOrders.length - confirmed), tone: "bg-accent" },
            { label: "Confirmed", value: String(confirmed), tone: "bg-ok-dot" },
            { label: "Order value", value: formatPrice(totalValue), tone: "bg-primary" },
          ].map((s) => (
            <Panel key={s.label} className="overflow-hidden">
              <span className={`block h-0.75 ${s.tone}`} />
              <div className="p-4.5">
                <p className="mb-2 text-[12px] font-medium text-[#64748b]">{s.label}</p>
                <p className="font-mono text-[22px] font-bold tracking-[-0.02em] text-ink">{s.value}</p>
              </div>
            </Panel>
          ))}
        </div>
      )}

      {sorted.length === 0 ? (
        <EmptyState>
          No orders yet. Accepting a price request moves it here.
        </EmptyState>
      ) : (
        <Panel className="overflow-hidden">
          <div className="scrollbar-slim overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead className="bg-surface">
                <tr>
                  <th className={TH}>REFERENCE</th>
                  <th className={TH}>CUSTOMER</th>
                  <th className={TH}>ITEMS</th>
                  <th className={TH}>TOTAL</th>
                  <th className={TH}>ISSUED</th>
                  <th className={TH}>STATUS</th>
                  <th className={TH}>PAYMENT</th>
                  <th className={TH}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((quotation) => (
                  <OrderRow
                    key={quotation.id}
                    quotation={quotation}
                    onChanged={() => router.refresh()}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
}
