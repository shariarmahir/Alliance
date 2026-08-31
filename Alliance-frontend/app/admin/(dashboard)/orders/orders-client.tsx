"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Download, FileText, Mail, ReceiptText, Wallet } from "lucide-react";
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
  type PillTone,
} from "../admin-ui";
import { apiFetch, ApiError } from "@/app/lib/api-browser";
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
function PaymentDialog({ quotation }: { quotation: Quotation }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<"download" | "email" | null>(null);
  const confirmation = quotation.confirmation;
  const saved: PaymentStatus = confirmation?.paymentStatus ?? "pending";
  if (!confirmation) return null;
  // Derived server-side from the invoices; nothing on this screen sets it.
  const paid = saved === "received";

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
      onOpenChange={setOpen}
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

        {/* Derived from the order's invoices, not set here. The Orders
            screen used to carry its own payment status, which knew nothing
            about the receipts recorded against the invoices -- so an order
            paid in full still read PENDING. Payments are recorded where the
            money actually lands: on the invoice. */}
        <dl className="space-y-1.5 rounded-[10px] border border-slate-line px-3.5 py-3 text-[12.5px]">
          <div className="flex justify-between gap-4">
            <dt className="text-ink-muted">Invoiced</dt>
            <dd className="font-mono font-semibold text-ink">
              {formatPrice(confirmation.amountInvoiced ?? 0)}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ink-muted">Received</dt>
            <dd className="font-mono font-semibold text-ok">
              {formatPrice(confirmation.amountPaid ?? 0)}
            </dd>
          </div>
          <div className="flex justify-between gap-4 border-t border-hairline pt-1.5">
            <dt className="font-semibold text-ink">Outstanding</dt>
            <dd className="font-mono font-bold text-ink">
              {formatPrice(confirmation.amountOutstanding ?? 0)}
            </dd>
          </div>
        </dl>

        {(confirmation.amountInvoiced ?? 0) === 0 ? (
          <p className="text-[11.5px] leading-[1.6] text-[#8a94a6]">
            Nothing has been invoiced against this order yet, so there is no
            payment to record. Raise an invoice first.
          </p>
        ) : (
          <p className="text-[11.5px] leading-[1.6] text-[#8a94a6]">
            Record receipts on the invoice itself, where the amount, date,
            method and reference are kept.{" "}
            <Link
              href={`/admin/invoices?order=${encodeURIComponent(quotation.id)}`}
              className="font-semibold text-primary hover:underline"
            >
              Open this order&rsquo;s invoices
            </Link>
            .
          </p>
        )}

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
        </div>
      </DialogContent>
    </Dialog>
  );
}

// The order-progress columns: NOT CREATED until the first invoice/challan is
// raised against the order (from `hasX`, since a raised-for-zero document
// would otherwise look identical to none at all), then PARTIAL until the
// server-derived totals say the order is fully invoiced/delivered.
function docStatus(
  hasAny: boolean,
  complete: boolean
): { label: string; tone: PillTone } {
  if (!hasAny) return { label: "NOT CREATED", tone: "neutral" };
  return complete ? { label: "COMPLETE", tone: "ok" } : { label: "PARTIAL", tone: "warn" };
}

const DOT_TONE: Record<PillTone, string> = {
  ok: "bg-ok-dot",
  warn: "bg-accent",
  danger: "bg-[#c22]",
  info: "bg-primary",
  neutral: "bg-[#c8d0da]",
};

// A step's dot is grey until something has happened at all, amber while it's
// short of done, and green once it is — same vocabulary as the pill columns,
// compressed to fit next to the row's action buttons instead of taking a
// column of its own.
function StepDot({ tone, label }: { tone: PillTone; label: string }) {
  return (
    <span
      title={label}
      aria-label={label}
      className={`size-2.5 shrink-0 rounded-full ${DOT_TONE[tone]}`}
    />
  );
}

// Read-only order-progress meter: one dot per stage (invoice, challan,
// payment), lighting up as each is raised and then completed, with a check
// once every stage — and therefore the order itself — is done. Replaces the
// old Pending/Confirmed dropdown: the stage it set is now derived
// automatically from these same three signals (advance_stage_if_fulfilled on
// the backend), so there is nothing left for an admin to pick by hand.
function ProgressMeter({
  invoiceTone,
  challanTone,
  paid,
  complete,
}: {
  invoiceTone: PillTone;
  challanTone: PillTone;
  paid: boolean;
  complete: boolean;
}) {
  return (
    <div className="flex items-center gap-2.5 rounded-md border border-[#dde3ea] px-2.5 py-1.5">
      <StepDot tone={invoiceTone} label="Invoice" />
      <StepDot tone={challanTone} label="Challan" />
      <StepDot tone={paid ? "ok" : "warn"} label="Payment" />
      {complete ? (
        <CheckCircle2 className="size-3.5 text-ok" aria-label="Order complete" />
      ) : (
        <span className="text-[10.5px] font-semibold text-ink-muted">In progress</span>
      )}
    </div>
  );
}

function OrderRow({
  quotation,
  hasInvoice,
  hasChallan,
  onChanged,
}: {
  quotation: Quotation;
  hasInvoice: boolean;
  hasChallan: boolean;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const confirmation = quotation.confirmation;
  if (!confirmation) return null;

  const stage = clampStage(confirmation.deliveryStage ?? 0);
  const paid = confirmation.paymentStatus === "received";
  const invoiceComplete = (confirmation.amountInvoiced ?? 0) >= confirmation.grandTotal;
  const invoicePill = docStatus(hasInvoice, invoiceComplete);
  const challanPill = docStatus(hasChallan, confirmation.deliveryComplete ?? false);

  async function cancel() {
    setBusy(true);
    try {
      await apiFetch(
        `/api/admin/quotations/${encodeURIComponent(quotation.id)}/status`,
        { method: "PATCH", body: { status: "cancelled" } }
      );
      toast.success(`Order ${confirmation!.refNumber} cancelled.`);
      onChanged();
    } catch (error) {
      // The backend refuses while invoices or challans stand against the
      // order and names them, including when they are past withdrawal and
      // the order can never be cancelled. Swallowing that left an admin
      // clicking a button that silently did nothing, with no way to learn
      // which document was in the way. Matches the Quotations screen.
      toast.error(
        error instanceof ApiError ? error.message : "Could not cancel this order.",
        { duration: 8000 }
      );
    } finally {
      setBusy(false);
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
        <Pill tone={invoicePill.tone}>{invoicePill.label}</Pill>
      </td>
      <td className={TD}>
        <Pill tone={challanPill.tone}>{challanPill.label}</Pill>
      </td>
      <td className={TD}>
        <div className="flex flex-wrap items-center gap-2">
          <ProgressMeter
            invoiceTone={invoicePill.tone}
            challanTone={challanPill.tone}
            paid={paid}
            complete={stage >= MAX_STAGE}
          />
          <PaymentDialog quotation={quotation} />
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
  invoicedOrderIds,
  challanedOrderIds,
}: {
  initialOrders: Quotation[];
  payments: PaymentAnalytics;
  invoicedOrderIds: string[];
  challanedOrderIds: string[];
}) {
  const invoicedSet = new Set(invoicedOrderIds);
  const challanedSet = new Set(challanedOrderIds);
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
            <table className="w-full min-w-320 text-[12.5px]">
              <thead className="bg-surface">
                <tr>
                  <th className={TH}>REFERENCE</th>
                  <th className={TH}>CUSTOMER</th>
                  <th className={TH}>ITEMS</th>
                  <th className={TH}>TOTAL</th>
                  <th className={TH}>ISSUED</th>
                  <th className={TH}>STATUS</th>
                  <th className={TH}>PAYMENT</th>
                  <th className={TH}>INVOICE</th>
                  <th className={TH}>CHALLAN</th>
                  <th className={TH}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((quotation) => (
                  <OrderRow
                    key={quotation.id}
                    quotation={quotation}
                    hasInvoice={invoicedSet.has(quotation.id)}
                    hasChallan={challanedSet.has(quotation.id)}
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
