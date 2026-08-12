"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { formatPrice } from "@/app/lib/utils";
import type { Order, OrderStatus } from "@/app/lib/types";

const STATUS_BADGE: Record<OrderStatus, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  pending: { label: "Pending", variant: "default" },
  confirmed: { label: "Confirmed", variant: "secondary" },
  cancelled: { label: "Cancelled", variant: "destructive" },
};

const FILTERS: { value: "all" | OrderStatus; label: string }[] = [
  { value: "all", label: "All" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Confirmed" },
  { value: "cancelled", label: "Cancelled" },
];

function OrderRow({ order, onChanged }: { order: Order; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);

  async function setStatus(status: OrderStatus) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/orders/${order.orderNumber}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Could not update order status.");
        return;
      }
      toast.success(`Order ${order.orderNumber} marked ${status}.`);
      onChanged();
    } catch {
      toast.error("Could not update order status.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr className="bg-card transition-colors duration-200 hover:bg-muted/50">
      <td className="px-4 py-3 font-medium text-foreground">{order.orderNumber}</td>
      <td className="px-4 py-3 text-muted-foreground">{order.address.name}</td>
      <td className="px-4 py-3 text-muted-foreground">{order.items.length}</td>
      <td className="px-4 py-3 font-medium text-foreground">{formatPrice(order.grandTotal)}</td>
      <td className="px-4 py-3 text-muted-foreground">{new Date(order.placedAt).toLocaleDateString()}</td>
      <td className="px-4 py-3">
        <Badge variant={STATUS_BADGE[order.status].variant} className="transition-colors duration-200">{STATUS_BADGE[order.status].label}</Badge>
      </td>
      <td className="px-4 py-3">
        {order.status === "pending" && (
          <div className="flex items-center gap-2">
            <Button type="button" size="sm" variant="secondary" disabled={busy} onClick={() => setStatus("confirmed")}>
              Confirm
            </Button>
            <Button type="button" size="sm" variant="destructive" disabled={busy} onClick={() => setStatus("cancelled")}>
              Cancel
            </Button>
          </div>
        )}
      </td>
    </tr>
  );
}

export function OrdersClient({ initialOrders }: { initialOrders: Order[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | OrderStatus>("all");

  function refresh() {
    router.refresh();
  }

  const filtered = filter === "all" ? initialOrders : initialOrders.filter((o) => o.status === filter);
  const sorted = [...filtered].sort((a, b) => new Date(b.placedAt).getTime() - new Date(a.placedAt).getTime());

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Orders</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review submitted orders and confirm or cancel them.
        </p>
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as "all" | OrderStatus)}>
        <TabsList>
          {FILTERS.map((f) => (
            <TabsTrigger key={f.value} value={f.value}>
              {f.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {sorted.length === 0 ? (
        <div className="rounded-xl border border-dashed border-foreground/15 p-10 text-center text-sm text-muted-foreground">
          No orders in this view yet.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">Order #</th>
                <th className="px-4 py-3 font-medium">Customer</th>
                <th className="px-4 py-3 font-medium">Items</th>
                <th className="px-4 py-3 font-medium">Total</th>
                <th className="px-4 py-3 font-medium">Placed</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {sorted.map((order) => (
                <OrderRow key={order.orderNumber} order={order} onChanged={refresh} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
