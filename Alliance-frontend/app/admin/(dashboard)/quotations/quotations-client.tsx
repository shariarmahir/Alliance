"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye } from "lucide-react";
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
import type { Quotation, QuotationStatus } from "@/app/lib/types";

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

function ageLabel(submittedAt: string): { label: string; breached: boolean } {
  const ms = Date.now() - new Date(submittedAt).getTime();
  const hours = Math.floor(ms / 3_600_000);
  const minutes = Math.floor((ms % 3_600_000) / 60_000);
  return {
    label: hours > 0 ? `${hours} h ${String(minutes).padStart(2, "0")} m` : `${minutes} m`,
    breached: ms > SLA_HOURS * 3_600_000,
  };
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
            Submitted {new Date(d.submittedAt).toLocaleString("en-GB")}
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
                    <p className="truncate font-mono text-[11px] text-[#8a94a6]">
                      {item.partNumber} · {item.quantity} × {formatPrice(item.price)}
                    </p>
                  </div>
                  <p className="shrink-0 font-mono text-[12.5px] font-semibold text-ink">
                    {formatPrice(item.price * item.quantity)}
                  </p>
                </div>
              ))}
            </div>
            <p className="mt-2 text-right text-[13px] font-semibold text-ink">
              Estimated total:{" "}
              <span className="font-mono">{formatPrice(quotation.total)}</span>
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

function QuotationRow({ quotation, onChanged }: { quotation: Quotation; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);

  async function setStatus(status: QuotationStatus) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/quotations/${quotation.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Could not update quotation status.");
        return;
      }
      toast.success(`Quotation for ${quotation.details.companyName} marked ${status}.`);
      onChanged();
    } catch {
      toast.error("Could not update quotation status.");
    } finally {
      setBusy(false);
    }
  }

  const pending = quotation.status === "pending";
  const age = ageLabel(quotation.details.submittedAt);
  const pill = STATUS_PILL[quotation.status];

  return (
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
      <td className={`${TD} font-mono font-semibold text-ink`}>{formatPrice(quotation.total)}</td>
      <td
        className={`${TD} font-mono text-[11.5px] ${
          pending && age.breached ? "font-semibold text-[#c22]" : "text-ink-muted"
        }`}
      >
        {pending ? age.label : new Date(quotation.details.submittedAt).toLocaleDateString("en-GB")}
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
          {pending && (
            <>
              <RowButton tone="ok" disabled={busy} onClick={() => setStatus("confirmed")}>
                Confirm
              </RowButton>
              <RowButton tone="danger" disabled={busy} onClick={() => setStatus("cancelled")}>
                Cancel
              </RowButton>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

export function QuotationsClient({ initialQuotations }: { initialQuotations: Quotation[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | QuotationStatus>("all");

  const count = (s: QuotationStatus) => initialQuotations.filter((q) => q.status === s).length;
  const breached = initialQuotations.filter(
    (q) => q.status === "pending" && ageLabel(q.details.submittedAt).breached
  ).length;

  // Oldest first while pending — the ones closest to breaching the SLA need
  // answering first; everything else reads newest first.
  const sorted = [
    ...(filter === "all" ? initialQuotations : initialQuotations.filter((q) => q.status === filter)),
  ].sort((a, b) => {
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
            { value: "all", label: "All", count: initialQuotations.length },
            { value: "pending", label: "Pending", count: count("pending") },
            { value: "confirmed", label: "Confirmed", count: count("confirmed") },
            { value: "cancelled", label: "Cancelled", count: count("cancelled") },
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

      {sorted.length === 0 ? (
        <EmptyState>No price requests in this view yet.</EmptyState>
      ) : (
        <Panel className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead className="bg-surface">
                <tr>
                  <th className={TH}>CONTACT</th>
                  <th className={TH}>COMPANY</th>
                  <th className={TH}>ITEMS</th>
                  <th className={TH}>EST. TOTAL</th>
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
