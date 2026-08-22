"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, Download, Trash2 } from "lucide-react";
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
import { downloadQuotationPdf } from "@/app/lib/quotation-pdf";
import { DELIVERY_STAGES, clampStage } from "@/app/lib/delivery";
import { useClientNow } from "@/app/lib/use-client-now";
import { apiFetch, ApiError } from "@/app/lib/api-browser";
import type { Quotation, QuotationStatus } from "@/app/lib/types";

// Internal delivery-stage tracker (pending/confirmed/shipped/delivered). This
// is not customer-facing — there is no public tracking page — it exists so
// staff can see and update where an order actually is.
function DeliveryStageSelect({
  quotation,
  onChanged,
}: {
  quotation: Quotation;
  onChanged: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const stage = clampStage(quotation.confirmation?.deliveryStage);

  async function setStage(next: number) {
    setBusy(true);
    try {
      await apiFetch(
        `/api/admin/quotations/${encodeURIComponent(quotation.id)}/delivery`,
        { method: "PATCH", body: { stage: next } }
      );
      toast.success(`Delivery marked "${DELIVERY_STAGES[next].label}".`);
      onChanged();
    } catch {
      toast.error("Could not update the delivery stage.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <select
      value={stage}
      disabled={busy}
      onChange={(e) => setStage(Number(e.target.value))}
      aria-label="Delivery stage"
      className="shrink-0 rounded-md border border-[#dde3ea] bg-white px-2 py-1.5 text-[11.5px] font-semibold text-ink-soft outline-none transition-colors hover:border-primary focus:border-primary disabled:opacity-60"
    >
      {DELIVERY_STAGES.map((s, i) => (
        <option key={s.label} value={i}>
          {s.label}
        </option>
      ))}
    </select>
  );
}

// The storefront promises a quote within 4 working hours; the Overview's
// "Price requests needing an answer" panel uses the same threshold.
const SLA_HOURS = 4;

const STATUS_PILL: Record<QuotationStatus, { label: string; tone: PillTone }> = {
  pending: { label: "PENDING", tone: "warn" },
  confirmed: { label: "CONFIRMED", tone: "ok" },
  cancelled: { label: "CANCELLED", tone: "danger" },
};

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
  onPanelOpenChange,
  onChanged,
}: {
  quotation: Quotation;
  sequence: number;
  panelOpen: boolean;
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
    } catch {
      toast.error("Could not update quotation status.");
    } finally {
      setBusy(false);
    }
  }

  const pending = quotation.status === "pending";
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
          pending && age.breached ? "font-semibold text-[#c22]" : "text-ink-muted"
        }`}
      >
        {pending ? age.label : formatSubmittedDate(quotation.details.submittedAt)}
      </td>
      <td className={TD}>
        {pending && age.breached ? (
          <Pill tone="danger">SLA BREACH</Pill>
        ) : (
          <Pill tone={pill.tone}>{pill.label}</Pill>
        )}
      </td>
      <td className={TD}>
        <div className="flex flex-wrap items-center gap-2">
          <QuotationDetailDialog quotation={quotation} />
          {quotation.status !== "cancelled" && (
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
          {quotation.confirmation && (
            <button
              type="button"
              onClick={download}
              disabled={downloading}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-[#dde3ea] px-2.5 py-1.5 text-[11.5px] font-semibold text-ink-soft transition-colors hover:border-primary hover:text-primary disabled:opacity-60"
            >
              <Download className="size-3.5" /> {downloading ? "..." : "Download PDF"}
            </button>
          )}
          {pending && (
            <CancelConfirmDialog
              quotation={quotation}
              label="Cancel"
              disabled={busy}
              onConfirm={() => setStatus("cancelled")}
            />
          )}
          {quotation.status === "confirmed" && (
            <DeliveryStageSelect quotation={quotation} onChanged={onChanged} />
          )}
          {quotation.status === "confirmed" && (
            <CancelConfirmDialog
              quotation={quotation}
              label="Remove"
              disabled={busy}
              onConfirm={() => setStatus("cancelled")}
            />
          )}
        </div>
      </td>
    </tr>
    {panelOpen && quotation.status !== "cancelled" && (
      <ConfirmQuotationPanel
        quotation={quotation}
        sequence={sequence}
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

export function QuotationsClient({ initialQuotations }: { initialQuotations: Quotation[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | QuotationStatus>("pending");
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
          (q) => q.status === "pending" && ageLabel(q.details.submittedAt, now).breached
        ).length;

  // Oldest first while pending — the ones closest to breaching the SLA need
  // answering first; everything else reads newest first.
  const visible =
    filter === "all"
      ? initialQuotations
      : initialQuotations.filter(
          // A quotation with its panel open stays listed even once its new
          // status no longer matches the tab, so finishing the paperwork —
          // download, then email — never yanks the form off the screen.
          (q) => q.status === filter || q.id === openPanelId
        );

  const sorted = [...visible].sort((a, b) => {
    const at = new Date(a.details.submittedAt).getTime();
    const bt = new Date(b.details.submittedAt).getTime();
    if (a.status === "pending" && b.status === "pending") return at - bt;
    if (a.status === "pending") return -1;
    if (b.status === "pending") return 1;
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
            { value: "pending", label: "Pending", count: count("pending") },
            { value: "confirmed", label: "Confirmed", count: count("confirmed") },
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
            <table className="w-full text-[12.5px]">
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
