"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Download, FileText, Mail, ReceiptText, BadgeCheck, Wallet } from "lucide-react";
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
import { downloadQuotationPdf } from "@/app/lib/quotation-pdf";
import { downloadReceiptPdf, receiptPdfToBase64 } from "@/app/lib/challan-pdf";
import { DELIVERY_STAGES, MAX_STAGE, clampStage } from "@/app/lib/delivery";
import { PaymentsPanel } from "./payments-panel";
import type { PaymentAnalytics } from "@/app/lib/admin-data";
import type { Quotation, PaymentStatus } from "@/app/lib/types";

// Every row is an accepted price request. Its order state (Pending or
// Confirmed) is stored as the confirmation's stage index, which is what the
// backend compares to decide whether to email the customer. Carried as a
// string here because FilterBar is keyed on strings.
type StageFilter = string;

// Payment is three related actions — record it, then produce or send the
// receipt — so they live behind one control rather than three competing for
// room in the row. Recording is a real decision (it gates the receipt, and a
// receipt asserts money arrived), which a dropdown that fires on change makes
// too easy to do by mistake.
function PaymentDialog({
  quotation,
  onChanged,
}: {
  quotation: Quotation;
  onChanged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<"save" | "download" | "email" | null>(null);
  const confirmation = quotation.confirmation;
  const saved: PaymentStatus = confirmation?.paymentStatus ?? "pending";
  const [choice, setChoice] = useState<PaymentStatus>(saved);

  if (!confirmation) return null;
  const paid = saved === "received";
  const dirty = choice !== saved;

  async function save() {
    setBusy("save");
    try {
      await apiFetch(
        `/api/admin/quotations/${encodeURIComponent(quotation.id)}/payment`,
        { method: "PATCH", body: { status: choice } }
      );
      toast.success(
        choice === "received" ? "Payment marked received." : "Payment marked pending.",
        {
          description:
            choice === "received"
              ? "The money receipt is now available to download or send."
              : undefined,
        }
      );
      onChanged();
    } catch {
      toast.error("Could not update the payment status.");
    } finally {
      setBusy(null);
    }
  }

  async function download() {
    setBusy("download");
    try {
      await downloadReceiptPdf(quotation);
    } catch {
      toast.error("Could not generate the receipt.");
    } finally {
      setBusy(null);
    }
  }

  async function sendEmail() {
    setBusy("email");
    const toastId = toast.loading("Preparing the receipt...");
    try {
      // Rendered here and posted, so the customer receives the same file the
      // download button produces rather than a server-side approximation.
      const { base64, fileName } = await receiptPdfToBase64(quotation);
      toast.loading(`Sending to ${quotation.details.email}...`, { id: toastId });
      await apiFetch(
        `/api/admin/quotations/${encodeURIComponent(quotation.id)}/receipt/email`,
        { method: "POST", body: { pdfBase64: base64, fileName } }
      );
      toast.success("Receipt sent", {
        id: toastId,
        description: `Delivered to ${quotation.details.email}.`,
        duration: 7000,
      });
      setOpen(false);
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Could not send the receipt.",
        { id: toastId }
      );
    } finally {
      setBusy(null);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // Reopening must show what is stored, not an abandoned edit.
        if (next) setChoice(saved);
        setOpen(next);
      }}
    >
      <DialogTrigger
        render={
          <button
            type="button"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-[#dde3ea] px-2.5 py-1.5 text-[11.5px] font-semibold text-ink-soft transition-colors hover:border-primary hover:text-primary"
          >
            <Wallet className="size-3.5" /> Payment
          </button>
        }
      />
      <DialogContent className="max-h-[85vh] w-full max-w-lg overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-[17px] font-bold text-ink">Payment</DialogTitle>
          <DialogDescription className="font-mono text-[11.5px] text-[#8a94a6]">
            {confirmation.refNumber} &middot;{" "}
            {quotation.details.companyName || quotation.details.fullName}
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between gap-4 rounded-[10px] border border-slate-line bg-surface px-3.5 py-3">
          <span className="text-[12.5px] font-semibold text-ink">Order value</span>
          <span className="font-mono text-[15px] font-bold text-ink">
            {formatPrice(confirmation.grandTotal)}
          </span>
        </div>

        <fieldset className="space-y-2">
          <legend className="mb-2 text-[12.5px] font-semibold text-ink">Payment status</legend>
          {(
            [
              { value: "pending", label: "Pending", hint: "Payment has not arrived yet." },
              {
                value: "received",
                label: "Received",
                hint: "Records the payment date and unlocks the money receipt.",
              },
            ] as const
          ).map((option) => (
            <label
              key={option.value}
              className={`flex cursor-pointer items-start gap-3 rounded-[10px] border px-3.5 py-3 transition-colors ${
                choice === option.value
                  ? "border-primary bg-tint"
                  : "border-slate-line hover:border-[#c8d0da]"
              }`}
            >
              <input
                type="radio"
                name={`payment-${quotation.id}`}
                value={option.value}
                checked={choice === option.value}
                onChange={() => setChoice(option.value)}
                className="mt-0.5 size-3.5 accent-primary"
              />
              <span className="min-w-0">
                <span className="block text-[12.5px] font-semibold text-ink">{option.label}</span>
                <span className="block text-[11.5px] leading-normal text-[#8a94a6]">
                  {option.hint}
                </span>
              </span>
            </label>
          ))}
        </fieldset>

        {paid && confirmation.paymentReceivedAt && (
          <p className="text-[11.5px] text-[#8a94a6]">
            Recorded on{" "}
            <strong className="text-ink">
              {new Date(confirmation.paymentReceivedAt).toLocaleDateString("en-GB")}
            </strong>
            . The receipt prints this date, not today&rsquo;s.
          </p>
        )}

        {!paid && (
          <p className="text-[11.5px] leading-[1.6] text-[#8a94a6]">
            A receipt states that money was received, so it becomes available once the
            payment is recorded.
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-2 border-t border-hairline pt-4">
          {paid && (
            <>
              <button
                type="button"
                onClick={download}
                disabled={busy !== null}
                className="inline-flex items-center gap-2 rounded-[9px] border border-slate-line bg-white px-4 py-2.5 text-[13px] font-bold text-ink transition-colors hover:border-primary hover:text-primary disabled:opacity-60"
              >
                <Download className="size-4" />
                {busy === "download" ? "Preparing..." : "Download Receipt"}
              </button>
              <button
                type="button"
                onClick={sendEmail}
                disabled={busy !== null}
                className="inline-flex items-center gap-2 rounded-[9px] border border-slate-line bg-white px-4 py-2.5 text-[13px] font-bold text-ink transition-colors hover:border-primary hover:text-primary disabled:opacity-60"
              >
                <Mail className="size-4" />
                {busy === "email" ? "Sending..." : "Send Email"}
              </button>
            </>
          )}
          <button
            type="button"
            onClick={save}
            disabled={busy !== null || !dirty}
            className="btn-sheen inline-flex items-center gap-2 rounded-[9px] border border-white/40 bg-accent/90 px-4 py-2.5 text-[13px] font-bold text-ink transition-all hover:-translate-y-0.5 hover:bg-accent disabled:translate-y-0 disabled:opacity-60"
          >
            <BadgeCheck className="size-4" />
            {busy === "save" ? "Saving..." : dirty ? "Save" : "Saved"}
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
        {/* Section B: once the total ordered quantity has been delivered the
            order's delivery status is Completed. That is derived from the
            challans, not from the stage dropdown, so it reports what has
            actually shipped rather than what someone last selected. */}
        {confirmation.deliveryComplete ? (
          <Pill tone="ok">COMPLETED</Pill>
        ) : (
          <Pill tone={stage >= MAX_STAGE ? "ok" : "warn"}>
            {DELIVERY_STAGES[stage].label.toUpperCase()}
          </Pill>
        )}
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
          <PaymentDialog quotation={quotation} onChanged={onChanged} />
          {/* These open the real Prepare windows on the Challans and Invoices
              screens, carrying this order so the window opens on it.
              They used to render a client-side PDF instead, which created no
              record on either screen and numbered itself by rewriting the
              quotation ref -- AIT/M/Q-0003 became AIT/M/I-0003, while the
              real series issues I-0001 upward, so two different invoices
              could carry the same number. */}
          <Link
            href={`/admin/challans?order=${encodeURIComponent(quotation.id)}`}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-[#dde3ea] px-2.5 py-1.5 text-[11.5px] font-semibold text-ink-soft transition-colors hover:border-primary hover:text-primary"
          >
            <FileText className="size-3.5" /> Prepare Challan
          </Link>
          <Link
            href={`/admin/invoices?order=${encodeURIComponent(quotation.id)}`}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-[#dde3ea] px-2.5 py-1.5 text-[11.5px] font-semibold text-ink-soft transition-colors hover:border-primary hover:text-primary"
          >
            <ReceiptText className="size-3.5" /> Prepare Invoice
          </Link>
          <RowButton tone="danger" disabled={busy} onClick={cancel}>
            Cancel
          </RowButton>
        </div>
      </td>
    </tr>
  );
}

export function OrdersClient({
  initialOrders,
  payments,
}: {
  initialOrders: Quotation[];
  payments: PaymentAnalytics;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<StageFilter>("all");
  // Bumped on every row change. router.refresh() re-renders the rows from the
  // server, but the payments panel holds its own fetched copy, so it needs an
  // explicit signal or its totals would sit stale until a manual reload.
  const [version, setVersion] = useState(0);
  // router.refresh() is a server round-trip. Marking it a transition keeps the
  // current rows interactive while it lands, instead of blanking them, and
  // gives us `pending` to show that figures are being brought up to date.
  const [pending, startTransition] = useTransition();

  function handleChanged() {
    startTransition(() => router.refresh());
    setVersion((v) => v + 1);
  }

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
        <div
          className={`grid gap-4 transition-opacity duration-200 sm:grid-cols-3 ${
            pending ? "opacity-60" : "opacity-100"
          }`}
        >
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

      {initialOrders.length > 0 && (
        <PaymentsPanel initial={payments} version={version} />
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
                    onChanged={handleChanged}
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
