"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Download } from "lucide-react";
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
import { apiFetch } from "@/app/lib/api-browser";
import { downloadQuotationPdf } from "@/app/lib/quotation-pdf";
import { DELIVERY_STAGES, clampStage } from "@/app/lib/delivery";
import type { Quotation } from "@/app/lib/types";

// Every row here is a confirmed quotation, so "status" in the order sense is
// its delivery progress rather than the quotation status — filtering by
// stage is what an admin actually wants to slice by on this screen. The
// stage index is carried as a string because FilterBar is keyed on strings.
type StageFilter = string;

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

  async function setStage(next: number) {
    setBusy(true);
    try {
      await apiFetch(
        `/api/admin/quotations/${encodeURIComponent(quotation.id)}/delivery`,
        { method: "PATCH", body: { stage: next } }
      );
      toast.success(`Marked ${DELIVERY_STAGES[next].label.toLowerCase()}.`);
      onChanged();
    } catch {
      toast.error("Could not update the delivery stage.");
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
        <Pill tone={stage >= DELIVERY_STAGES.length - 1 ? "ok" : "info"}>
          {DELIVERY_STAGES[stage].label.toUpperCase()}
        </Pill>
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
  const delivered = count(DELIVERY_STAGES.length - 1);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Orders"
        subtitle="Confirmed quotations. Track delivery progress and issue documents."
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
            { label: "Open orders", value: String(initialOrders.length - delivered), tone: "bg-accent" },
            { label: "Delivered", value: String(delivered), tone: "bg-ok-dot" },
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
                  <th className={TH}>DELIVERY</th>
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
