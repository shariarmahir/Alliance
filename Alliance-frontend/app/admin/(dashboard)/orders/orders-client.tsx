"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
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
import { apiFetch } from "@/app/lib/api-browser";
import type { Order, OrderStatus } from "@/app/lib/types";

const STATUS_PILL: Record<OrderStatus, { label: string; tone: PillTone }> = {
  pending: { label: "PENDING", tone: "warn" },
  confirmed: { label: "CONFIRMED", tone: "ok" },
  cancelled: { label: "CANCELLED", tone: "danger" },
};

function OrderRow({ order, onChanged }: { order: Order; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);

  async function setStatus(status: OrderStatus) {
    setBusy(true);
    try {
      await apiFetch(
        `/api/admin/orders/${encodeURIComponent(order.orderNumber)}/status`,
        { method: "PATCH", body: { status } }
      );
      toast.success(`Order ${order.orderNumber} marked ${status}.`);
      onChanged();
    } catch {
      toast.error("Could not update order status.");
    } finally {
      setBusy(false);
    }
  }

  const pill = STATUS_PILL[order.status];

  return (
    <tr className={ROW}>
      <td className={`${TD} font-mono text-[12px] font-semibold text-ink`}>{order.orderNumber}</td>
      <td className={`${TD} text-ink-soft`}>
        {order.address.name}
        <span className="block text-[11px] text-[#8a94a6]">{order.address.country}</span>
      </td>
      <td className={`${TD} font-mono text-ink-soft`}>{order.items.length}</td>
      <td className={`${TD} font-mono font-semibold text-ink`}>{formatPrice(order.grandTotal)}</td>
      <td className={`${TD} font-mono text-[11.5px] text-ink-muted`}>
        {new Date(order.placedAt).toLocaleDateString("en-GB")}
      </td>
      <td className={TD}>
        <Pill tone={pill.tone}>{pill.label}</Pill>
      </td>
      <td className={TD}>
        {order.status === "pending" && (
          <div className="flex flex-wrap items-center gap-2">
            <RowButton tone="ok" disabled={busy} onClick={() => setStatus("confirmed")}>
              Confirm
            </RowButton>
            <RowButton tone="danger" disabled={busy} onClick={() => setStatus("cancelled")}>
              Cancel
            </RowButton>
          </div>
        )}
      </td>
    </tr>
  );
}

export function OrdersClient({ initialOrders }: { initialOrders: Order[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | OrderStatus>("all");

  const count = (s: OrderStatus) => initialOrders.filter((o) => o.status === s).length;
  const sorted = [...(filter === "all" ? initialOrders : initialOrders.filter((o) => o.status === filter))].sort(
    (a, b) => new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime()
  );

  const confirmedValue = initialOrders
    .filter((o) => o.status === "confirmed")
    .reduce((sum, o) => sum + o.grandTotal, 0);

  return (
    <div className="space-y-4">
      <PageHeader title="Orders" subtitle="Review submitted orders and confirm or cancel them.">
        <FilterBar
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All", count: initialOrders.length },
            { value: "pending", label: "Pending", count: count("pending") },
            { value: "confirmed", label: "Confirmed", count: count("confirmed") },
            { value: "cancelled", label: "Cancelled", count: count("cancelled") },
          ]}
        />
      </PageHeader>

      {initialOrders.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: "Awaiting review", value: String(count("pending")), tone: "bg-accent" },
            { label: "Confirmed", value: String(count("confirmed")), tone: "bg-ok-dot" },
            { label: "Confirmed value", value: formatPrice(confirmedValue), tone: "bg-primary" },
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
        <EmptyState>No orders in this view yet.</EmptyState>
      ) : (
        <Panel className="overflow-hidden">
          <div className="scrollbar-slim overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead className="bg-surface">
                <tr>
                  <th className={TH}>ORDER</th>
                  <th className={TH}>CUSTOMER</th>
                  <th className={TH}>ITEMS</th>
                  <th className={TH}>TOTAL</th>
                  <th className={TH}>PLACED</th>
                  <th className={TH}>STATUS</th>
                  <th className={TH}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((order) => (
                  <OrderRow key={order.orderNumber} order={order} onChanged={() => router.refresh()} />
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
}
