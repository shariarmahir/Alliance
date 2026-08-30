"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Eye, Download, Trash2, Receipt, Truck } from "lucide-react";
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
  TH,
  TD,
  ROW,
  type PillTone,
} from "../admin-ui";
import { ConfirmQuotationTrigger, ConfirmQuotationPanel } from "./confirm-dialog";
import { WorkOrderDialog } from "./work-order-dialog";
import { OrderHistoryDialog } from "./order-history-dialog";
import { OrderDocumentsDialog } from "./order-documents-dialog";
import { SendQuotationButton } from "./send-quotation-button";
import { PurgeOrderDialog } from "./purge-order-dialog";
import { NextStep } from "./workflow-stage";
import { downloadQuotationPdf } from "@/app/lib/quotation-pdf";
import { useClientNow } from "@/app/lib/use-client-now";
import { apiFetch, ApiError } from "@/app/lib/api-browser";
import type { Quotation, QuotationStatus } from "@/app/lib/types";

// The storefront promises a quote within 4 working hours; the Overview's
// "Price requests needing an answer" panel uses the same threshold.
const SLA_HOURS = 4;

const STATUS_PILL: Record<QuotationStatus, { label: string; tone: PillTone }> = {
  // Untouched work: a warning tone because it is the queue that needs action.
  inbox: { label: "NEW", tone: "warn" },
  // Their tab says "Pending" and so does their workflow, so the pill says it
  // too — PREPARED made one record look like two different things.
  pending: { label: "PENDING", tone: "info" },
  submitted: { label: "SUBMITTED", tone: "info" },
  confirmed: { label: "CONFIRMED", tone: "ok" },
  cancelled: { label: "CANCELLED", tone: "danger" },
};

// Everything short of a decision. A request stays visible in the working
// queue as it moves through preparation and sending, so acting on one never
// makes it vanish mid-workflow.
const OPEN_STATUSES: QuotationStatus[] = ["inbox", "pending", "submitted"];

const LEAD_TIME_LABEL: Record<string, string> = {
  standard: "Standard",
  urgent: "Urgent",
  flexible: "Flexible",
};

const CONTACT_LABEL: Record<string, string> = {
  email: "Email",
  phone: "Phone",
  whatsapp: "WhatsApp",
};

// now is passed in rather than read from Date.now() here: the elapsed time
// (and the resulting SLA-breach flag) would otherwise differ between the
// server's render and the client's, which React treats as a hydration
// mismatch on this row every single load.
function ageLabel(submittedAt: string, now: number): { label: string; breached: boolean } {
  const ms = now - new Date(submittedAt).getTime();
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  return {
    label: hours > 0 ? `${hours} h ${String(minutes).padStart(2, "0")} m` : `${minutes} m`,
    breached: ms > SLA_HOURS * 3_600_000,
  };
}

// Fixed to the business's own timezone (matches admin-topbar.tsx) rather than
// the viewer's local zone: the server renders in UTC and a browser in Dhaka
// would otherwise disagree with it, which is the same hydration problem as
// the elapsed-time label above.
function formatSubmittedDate(iso: string): string {
  return new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dhaka" }).format(new Date(iso));
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <p className="text-[12.5px]">
      <span className="text-ink-muted">{label}:</span>{" "}
      <span className="text-ink">{value || "—"}</span>
    </p>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h3 className="mono-label mb-2 text-[10px] text-[#8a94a6]">{children}</h3>;
}

function QuotationDetailDialog({ quotation }: { quotation: Quotation }) {
  const d = quotation.details;
  return (
    <Dialog>
      <DialogTrigger
        render={
          <button
            type="button"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-[#dde3ea] px-2.5 py-1.5 text-[11.5px] font-semibold text-ink-soft transition-colors hover:border-primary hover:text-primary"
          >
            <Eye className="size-3.5" /> View
          </button>
        }
      />
      <DialogContent className="max-h-[85vh] w-full max-w-2xl overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-[17px] font-bold text-ink">Quotation details</DialogTitle>
          <DialogDescription className="font-mono text-[11.5px] text-[#8a94a6]">
            Submitted {formatSubmittedDate(d.submittedAt)}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div>
            <SectionLabel>ITEMS</SectionLabel>
            <div className="overflow-hidden rounded-[10px] border border-slate-line">
              {quotation.items.map((item) => (
                <div
                  key={item.slug}
                  className="flex items-center justify-between gap-4 border-b border-[#f2f4f7] px-3 py-2.5 last:border-b-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[12.5px] font-semibold text-ink">{item.name}</p>
                    <p className="truncate font-mono text-[11px] text-[#8a94a6]">{item.partNumber}</p>
                  </div>
                  <p className="shrink-0 font-mono text-[12.5px] font-semibold text-ink">
                    Qty {item.quantity}
                  </p>
                </div>
              ))}
            </div>
            {/* No price here on purpose: this is the customer's request, and
                pricing is set by the admin when issuing the confirmation. */}
            <p className="mt-2 text-right text-[12.5px] text-ink-muted">
              {quotation.confirmation ? (
                <>
                  Quoted total:{" "}
                  <span className="font-mono font-semibold text-ink">
                    {formatPrice(quotation.confirmation.grandTotal)}
                  </span>
                </>
              ) : (
                "Not priced yet — set prices when issuing the order confirmation."
              )}
            </p>
          </div>

          <div>
            <SectionLabel>CONTACT</SectionLabel>
            <div className="grid gap-1.5 sm:grid-cols-2">
              <DetailField label="Name" value={d.fullName} />
              <DetailField label="Job title" value={d.jobTitle} />
              <DetailField label="Email" value={d.email} />
              <DetailField label="Phone" value={d.phone} />
            </div>
          </div>

          <div>
            <SectionLabel>COMPANY</SectionLabel>
            <div className="grid gap-1.5 sm:grid-cols-2">
              <DetailField label="Company" value={d.companyName} />
              <DetailField label="Country" value={d.country} />
              <DetailField label="Tax ID" value={d.taxId} />
              <DetailField label="Website" value={d.companyWebsite} />
            </div>
          </div>

          <div>
            <SectionLabel>PREFERENCES</SectionLabel>
            <div className="grid gap-1.5 sm:grid-cols-2">
              <DetailField label="Preferred contact" value={CONTACT_LABEL[d.preferredContact]} />
              <DetailField label="Lead time" value={LEAD_TIME_LABEL[d.leadTime]} />
            </div>
            {d.notes && <p className="mt-2 text-[12.5px] text-ink-soft">{d.notes}</p>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Cancelling drops the issued confirmation (ref number, prices, tracking ID)
// — see updateQuotationStatus in admin-operations.ts — so it asks first
// rather than acting on a single stray click.
function CancelConfirmDialog({
  quotation,
  label,
  disabled,
  onConfirm,
}: {
  quotation: Quotation;
  label: string;
  disabled: boolean;
  onConfirm: () => void;
}) {
  const [open, setOpen] = useState(false);
  const issued = !!quotation.confirmation;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button
            type="button"
            disabled={disabled}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-[#e04545]/30 px-2.5 py-1.5 text-[11.5px] font-semibold text-[#c22] transition-colors hover:border-[#e04545] hover:bg-[#fdecec] disabled:opacity-50"
          >
            {label}
          </button>
        }
      />
      <DialogContent className="w-full max-w-md sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[17px] font-bold text-ink">{label} this request?</DialogTitle>
          <DialogDescription className="text-[12.5px] leading-[1.65] text-ink-muted">
            {quotation.details.companyName} — {quotation.details.fullName}
            {issued && (
              <>
                <br />
                <span className="text-[#7a2f2f]">
                  This also deletes the issued confirmation{" "}
                  <strong className="font-mono">{quotation.confirmation!.refNumber}</strong>, including
                  its pricing and tracking number. You would need to re-issue it.
                </span>
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-end gap-2 border-t border-hairline pt-4">
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-md border border-slate-line bg-white px-4 py-2 text-[12.5px] font-semibold text-ink transition-colors hover:border-primary hover:text-primary"
          >
            Keep it
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onConfirm();
            }}
            className="rounded-md border border-[#e04545] bg-[#c22] px-4 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-[#a11]"
          >
            Yes, {label.toLowerCase()}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function QuotationRow({
  quotation,
  sequence,
  panelOpen,
  canPurge,
  catalogPrices,
  onPanelOpenChange,
  onChanged,
}: {
  quotation: Quotation;
  sequence: number;
  panelOpen: boolean;
  canPurge: boolean;
  catalogPrices: Record<string, number>;
  onPanelOpenChange: (open: boolean) => void;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [downloading, setDownloading] = useState(false);

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

  async function setStatus(status: QuotationStatus) {
    setBusy(true);
    try {
      await apiFetch(
        `/api/admin/quotations/${encodeURIComponent(quotation.id)}/status`,
        { method: "PATCH", body: { status } }
      );
      toast.success(`Quotation for ${quotation.details.companyName} marked ${status}.`);
      onChanged();
    } catch (error) {
      // The backend refuses to retract a confirmation that invoices or
      // challans were built from, and names them. That reason is far more
      // use to an admin than a generic failure.
      toast.error(
        error instanceof ApiError ? error.message : "Could not update quotation status.",
        { duration: 8000 }
      );
    } finally {
      setBusy(false);
    }
  }

  // Open = awaiting a decision, whether or not it has been quoted yet. Drives
  // the SLA clock and the Cancel action: quoting a request does not close it,
  // so the promise to answer it still stands.
  const open = OPEN_STATUSES.includes(quotation.status);
  // null until mounted, so the server and the first client render agree (both
  // show the placeholder); the real elapsed time then fills in a moment
  // later, which is invisible in practice.
  const now = useClientNow();
  const age = now === null ? { label: "—", breached: false } : ageLabel(quotation.details.submittedAt, now);
  const pill = STATUS_PILL[quotation.status];

  return (
    <>
    <tr className={ROW}>
      <td className={`${TD} text-ink`}>
        {quotation.details.fullName}
        <span className="block text-[11px] text-[#8a94a6]">{quotation.details.email}</span>
      </td>
      <td className={`${TD} text-ink-soft`}>
        {quotation.details.companyName}
        <span className="block text-[11px] text-[#8a94a6]">{quotation.details.country}</span>
      </td>
      <td className={`${TD} font-mono text-ink-soft`}>{quotation.items.length}</td>
      <td className={`${TD} font-mono font-semibold text-ink`}>
        {quotation.confirmation ? (
          <>
            {formatPrice(quotation.confirmation.grandTotal)}
            <span className="block font-mono text-[10px] font-normal text-[#8a94a6]">
              {quotation.confirmation.refNumber}
            </span>
          </>
        ) : (
          // Unpriced until issued — the catalogue figure is not a quote.
          <span className="font-normal text-[#c8d0da]">—</span>
        )}
      </td>
      <td
        className={`${TD} font-mono text-[11.5px] ${
          open && age.breached ? "font-semibold text-[#c22]" : "text-ink-muted"
        }`}
      >
        {open ? age.label : formatSubmittedDate(quotation.details.submittedAt)}
      </td>
      <td className={TD}>
        {open && age.breached ? (
          <Pill tone="danger">SLA BREACH</Pill>
        ) : (
          <Pill tone={pill.tone}>{pill.label}</Pill>
        )}
        {/* The client's workflow is a chain; naming the next arrow means an
            admin can read it off the row instead of knowing it by heart. */}
        <NextStep quotation={quotation} />
      </td>
      <td className={TD}>
        {/* Actions are stage-specific, per the client's workflow document.
            Showing every action on every row is what let a request jump
            from Inbox straight to Order Confirmed, leaving Pending and
            Submitted permanently empty and the audit trail with a hole in
            it. Each stage now offers only its own next step. */}
        <div className="flex flex-wrap items-center gap-2">
          <QuotationDetailDialog quotation={quotation} />

          {/* Inbox: Prepare. Pending/Submitted: Edit the prepared offer.
              The same panel serves both — what differs is that Prepare
              saves to Pending, and only Confirm accepts the order. */}
          {(quotation.status === "inbox" ||
            quotation.status === "pending" ||
            quotation.status === "submitted") && (
            <ConfirmQuotationTrigger
              quotation={quotation}
              open={panelOpen}
              onToggle={() => {
                // Closing (not opening) is when the list needs to catch up —
                // the panel may have issued a confirmation while it was open,
                // which the row hasn't reflected yet.
                if (panelOpen) onChanged();
                onPanelOpenChange(!panelOpen);
              }}
            />
          )}

          {/* Once prepared, the formal document can be previewed at any
              stage — before sending, and after confirmation. */}
          {quotation.confirmation && (
            <button
              type="button"
              onClick={download}
              disabled={downloading}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-[#dde3ea] px-2.5 py-1.5 text-[11.5px] font-semibold text-ink-soft transition-colors hover:border-primary hover:text-primary disabled:opacity-60"
            >
              <Download className="size-3.5" />
              {downloading ? "..." : quotation.status === "pending" ? "Preview PDF" : "Quotation PDF"}
            </button>
          )}

          {/* Pending only: a prepared offer that has not gone out yet. A
              successful send is what moves it to Submitted. */}
          {quotation.status === "pending" && quotation.confirmation && (
            <SendQuotationButton quotation={quotation} onSent={onChanged} />
          )}

          {/* Item 13 sits between Customer Confirmation and Order Confirmed
              in the client's chain, and the PO usually arrives with the
              customer's acceptance -- so it can be filed while the quotation
              is still Submitted, not only after confirming. */}
          {quotation.status === "submitted" && (
            <WorkOrderDialog quotation={quotation} />
          )}

          {/* Order Confirmed: the customer's own paperwork, and the two
              documents raised against it. */}
          {quotation.status === "confirmed" && (
            <>
              <WorkOrderDialog quotation={quotation} />
              <OrderDocumentsDialog quotation={quotation} />
              {/* Carries the order id, so the prepare window opens on this
                  order rather than leaving the admin to find it again in a
                  list — which is how an invoice ends up against the wrong
                  customer once there are more than a few confirmed orders. */}
              <Link
                href={`/admin/invoices?order=${encodeURIComponent(quotation.id)}`}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-[#dde3ea] px-2.5 py-1.5 text-[11.5px] font-semibold text-ink-soft transition-colors hover:border-primary hover:text-primary"
              >
                <Receipt className="size-3.5" /> Prepare Invoice
              </Link>
              <Link
                href={`/admin/challans?order=${encodeURIComponent(quotation.id)}`}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-[#dde3ea] px-2.5 py-1.5 text-[11.5px] font-semibold text-ink-soft transition-colors hover:border-primary hover:text-primary"
              >
                <Truck className="size-3.5" /> Prepare Challan
              </Link>
            </>
          )}

          {/* The full paper trail, once there is one worth reading. */}
          {quotation.confirmation && <OrderHistoryDialog quotation={quotation} />}

          {open && (
            <CancelConfirmDialog
              quotation={quotation}
              label="Cancel"
              disabled={busy}
              onConfirm={() => setStatus("cancelled")}
            />
          )}
          {/* Delivery progress is managed on the Orders screen, where a
              confirmed quotation lives as an order — this screen is about
              answering price requests, not running deliveries. */}
          {quotation.status === "confirmed" && (
            <CancelConfirmDialog
              quotation={quotation}
              label="Remove"
              disabled={busy}
              onConfirm={() => setStatus("cancelled")}
            />
          )}
          {/* The escape hatch, super admin only. Sits beside Remove rather
              than replacing it: the ordinary cancel is the right action
              almost always, and this one cannot be undone. */}
          {canPurge && quotation.status === "confirmed" && (
            <PurgeOrderDialog
              quotation={quotation}
              disabled={busy}
              onPurged={onChanged}
            />
          )}
        </div>
      </td>
    </tr>
    {panelOpen && quotation.status !== "cancelled" && (
      <ConfirmQuotationPanel
        quotation={quotation}
        sequence={sequence}
        catalogPrices={catalogPrices}
        onClose={() => {
          onChanged();
          onPanelOpenChange(false);
        }}
      />
    )}
    </>
  );
}

// Bulk, permanent, and irreversible — so the dialog names what actually goes
// rather than asking a vague "are you sure?".
function ClearCancelledBanner({
  count,
  onCleared,
}: {
  count: number;
  onCleared: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function clearAll() {
    setBusy(true);
    try {
      const result = await apiFetch<{ removed: number }>(
        "/api/admin/quotations/cancelled",
        { method: "DELETE" }
      );
      toast.success(
        `${result.removed} cancelled request${result.removed === 1 ? "" : "s"} deleted.`
      );
      setOpen(false);
      onCleared();
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Could not clear the cancelled requests."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-[#f0d0d0] bg-[#fef6f6] px-4 py-3">
      <p className="text-[12.5px] text-[#7a2f2f]">
        {count} cancelled request{count === 1 ? "" : "s"} stored. Clearing removes{" "}
        {count === 1 ? "it" : "them"} permanently.
      </p>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger
          render={
            <button
              type="button"
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-[#e04545] bg-white px-3 py-1.5 text-[11.5px] font-semibold text-[#c22] transition-colors hover:bg-[#c22] hover:text-white"
            >
              <Trash2 className="size-3.5" /> All Clear
            </button>
          }
        />
        <DialogContent className="w-full max-w-md sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-[17px] font-bold text-ink">
              Delete {count} cancelled request{count === 1 ? "" : "s"}?
            </DialogTitle>
            <DialogDescription className="text-[12.5px] leading-[1.65] text-ink-muted">
              They are erased from the database, not hidden — there is no undo and
              no archive to recover them from.
              <br />
              <span className="text-[#7a2f2f]">
                Your Overview totals and trend charts count every request ever
                submitted, so those numbers will drop by {count}.
              </span>
              <br />
              Only cancelled requests are affected. Pending and confirmed ones
              are left alone.
            </DialogDescription>
          </DialogHeader>

          <div className="flex justify-end gap-2 border-t border-hairline pt-4">
            <button
              type="button"
              onClick={() => setOpen(false)}
              disabled={busy}
              className="rounded-md border border-slate-line bg-white px-4 py-2 text-[12.5px] font-semibold text-ink transition-colors hover:border-primary hover:text-primary disabled:opacity-60"
            >
              Keep them
            </button>
            <button
              type="button"
              onClick={clearAll}
              disabled={busy}
              className="rounded-md border border-[#e04545] bg-[#c22] px-4 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-[#a11] disabled:opacity-60"
            >
              {busy ? "Deleting..." : `Yes, delete ${count}`}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function QuotationsClient({
  initialQuotations,
  canPurge,
  catalogPrices,
}: {
  initialQuotations: Quotation[];
  canPurge: boolean;
  catalogPrices: Record<string, number>;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | QuotationStatus>("inbox");
  // The row whose confirmation panel is open, if any. Tracked up here rather
  // than inside the row because issuing a confirmation moves the quotation out
  // of the Pending filter: without pinning it, the row — and the open panel
  // with it — would be filtered away mid-edit, which reads as the form
  // crashing. See `visible` in the list below.
  const [openPanelId, setOpenPanelId] = useState<string | null>(null);

  // null until mounted — see ageLabel's own comment. The breach count is a
  // one-line summary, so a beat of "0" while it fills in is unnoticeable.
  const now = useClientNow();

  const count = (s: QuotationStatus) => initialQuotations.filter((q) => q.status === s).length;
  // Next ref sequence, so a freshly opened confirm form pre-fills a number
  // that doesn't clash with the ones already issued.
  const nextSequence = initialQuotations.filter((q) => q.confirmation).length + 1;
  const breached =
    now === null
      ? 0
      : initialQuotations.filter(
          (q) =>
            OPEN_STATUSES.includes(q.status) &&
            ageLabel(q.details.submittedAt, now).breached
        ).length;

  // Each tab is one workflow stage, so it shows exactly that stage. The
  // stages are now distinct steps an admin moves a request through, rather
  // than one "open" bucket, and lumping them together would hide where a
  // request actually is.
  const matchesFilter = (q: Quotation) => q.status === filter;

  const visible =
    filter === "all"
      ? initialQuotations
      : initialQuotations.filter(
          // A quotation with its panel open stays listed even once its new
          // status no longer matches the tab, so finishing the paperwork —
          // download, then email — never yanks the form off the screen.
          (q) => matchesFilter(q) || q.id === openPanelId
        );

  const sorted = [...visible].sort((a, b) => {
    const at = new Date(a.details.submittedAt).getTime();
    const bt = new Date(b.details.submittedAt).getTime();
    const aOpen = OPEN_STATUSES.includes(a.status);
    const bOpen = OPEN_STATUSES.includes(b.status);
    if (aOpen && bOpen) return at - bt;
    if (aOpen) return -1;
    if (bOpen) return 1;
    return bt - at;
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Price requests"
        subtitle="Review submitted quotation requests and confirm or cancel them."
      >
        <FilterBar
          value={filter}
          onChange={setFilter}
          options={[
            { value: "inbox", label: "Inbox", count: count("inbox") },
            { value: "pending", label: "Pending", count: count("pending") },
            { value: "submitted", label: "Submitted", count: count("submitted") },
            { value: "confirmed", label: "Order Confirmed", count: count("confirmed") },
            { value: "cancelled", label: "Cancelled", count: count("cancelled") },
            { value: "all", label: "All", count: initialQuotations.length },
          ]}
        />
      </PageHeader>

      {breached > 0 && (
        <div className="flex items-center gap-2.5 rounded-[10px] border border-[#f6cfcf] bg-[#fef6f6] px-4 py-3">
          <Pill tone="danger">{breached} SLA</Pill>
          <p className="text-[12.5px] text-[#7a2f2f]">
            {breached} price request{breached === 1 ? " is" : "s are"} past the {SLA_HOURS}-hour
            promise. Oldest shown first.
          </p>
        </div>
      )}

      {/* Only on the Cancelled tab: elsewhere the button would be next to
          records it does not touch, which invites a misread of what it clears. */}
      {filter === "cancelled" && count("cancelled") > 0 && (
        <ClearCancelledBanner
          count={count("cancelled")}
          onCleared={() => router.refresh()}
        />
      )}

      {sorted.length === 0 ? (
        <EmptyState>No price requests in this view yet.</EmptyState>
      ) : (
        <Panel className="overflow-hidden">
          <div className="scrollbar-slim overflow-x-auto">
            <table className="w-full min-w-260 text-[12.5px]">
              <thead className="bg-surface">
                <tr>
                  <th className={TH}>CONTACT</th>
                  <th className={TH}>COMPANY</th>
                  <th className={TH}>ITEMS</th>
                  <th className={TH}>QUOTED TOTAL</th>
                  <th className={TH}>AGE</th>
                  <th className={TH}>STATUS</th>
                  <th className={TH}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((quotation) => (
                  <QuotationRow
                    key={quotation.id}
                    quotation={quotation}
                    sequence={nextSequence}
                    panelOpen={openPanelId === quotation.id}
                    canPurge={canPurge}
                    catalogPrices={catalogPrices}
                    onPanelOpenChange={(open) =>
                      setOpenPanelId(open ? quotation.id : null)
                    }
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
