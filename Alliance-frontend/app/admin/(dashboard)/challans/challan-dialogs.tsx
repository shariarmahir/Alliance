"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, Pencil, Send } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/app/components/ui/dialog";
import { apiFetch, ApiError } from "@/app/lib/api-browser";
import type { Challan, OrderBalanceLine } from "@/app/lib/admin-data";

// "The user can View, Edit, Preview, Print, or Cancel the Pending Challan
// before finalization." Preview and Print live in DocumentActions; View and
// Edit are here.

const BTN =
  "inline-flex shrink-0 items-center gap-1.5 rounded-md border border-[#dde3ea] px-2.5 py-1.5 " +
  "text-[11.5px] font-semibold text-ink-soft transition-colors hover:border-primary " +
  "hover:text-primary disabled:opacity-60";

function when(at: string | null): string {
  if (!at) return "—";
  return new Date(at).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function ViewChallanDialog({ challan }: { challan: Challan }) {
  const shipped = challan.lines.reduce((sum, l) => sum + l.quantity, 0);

  return (
    <Dialog>
      <DialogTrigger className={BTN}>
        <Eye className="size-3.5" /> View
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-[17px] font-bold text-ink">
            {challan.challanNumber ?? "Draft challan"}
          </DialogTitle>
          <DialogDescription className="text-[12.5px] text-ink-muted">
            {challan.customerName}
            {challan.refNumber ? ` · ${challan.refNumber}` : ""}
            {challan.poNumber ? ` · PO ${challan.poNumber}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[65vh] space-y-5 overflow-y-auto">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-hairline text-left">
                <th className="mono-label pb-2 text-[10px] text-ink-muted">Description</th>
                <th className="mono-label pb-2 text-right text-[10px] text-ink-muted">Quantity</th>
              </tr>
            </thead>
            <tbody>
              {challan.lines.map((line) => (
                <tr key={line.slug} className="border-b border-hairline">
                  <td className="py-2 text-ink">
                    {line.name}
                    {line.specifications && (
                      <span className="block text-[11px] text-ink-muted">
                        {line.specifications}
                      </span>
                    )}
                  </td>
                  <td className="py-2 text-right font-mono font-semibold text-ink">
                    {line.quantity} {line.unit}
                  </td>
                </tr>
              ))}
              <tr>
                <td className="pt-2 font-bold text-ink">Total this delivery</td>
                <td className="pt-2 text-right font-mono font-bold text-ink">{shipped}</td>
              </tr>
            </tbody>
          </table>

          {challan.deliveryAddress && (
            <div>
              <h3 className="mono-label mb-1 text-[10.5px] text-ink-muted">Deliver to</h3>
              <p className="whitespace-pre-line text-[12.5px] text-ink-soft">
                {challan.deliveryAddress}
              </p>
            </div>
          )}

          {(challan.vehicleNumber || challan.driverInfo || challan.receiverName) && (
            <div>
              <h3 className="mono-label mb-2 text-[10.5px] text-ink-muted">Dispatch details</h3>
              <dl className="space-y-1 text-[12.5px]">
                {[
                  ["Vehicle", challan.vehicleNumber],
                  ["Driver / transport", challan.driverInfo],
                  ["Receiver", challan.receiverName],
                  ["Remarks", challan.remarks],
                ]
                  .filter(([, value]) => value)
                  .map(([label, value]) => (
                    <div key={label} className="flex justify-between gap-4">
                      <dt className="text-ink-muted">{label}</dt>
                      <dd className="text-right text-ink-soft">{value}</dd>
                    </div>
                  ))}
              </dl>
            </div>
          )}

          <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 border-t border-hairline pt-4 text-[12px]">
            <div className="flex justify-between">
              <dt className="text-ink-muted">Created</dt>
              <dd className="font-mono text-ink-soft">{when(challan.createdAt)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-muted">Approved</dt>
              <dd className="font-mono text-ink-soft">{when(challan.approvedAt)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-muted">Dispatched</dt>
              <dd className="font-mono text-ink-soft">{when(challan.dispatchedAt)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-muted">Delivered</dt>
              <dd className="font-mono text-ink-soft">{when(challan.deliveredAt)}</dd>
            </div>
          </dl>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Pending-only, matching the backend's own rule. Balances are fetched with
// this challan excluded, so its own quantities do not count against the
// remaining balance it is being checked against.
export function EditChallanDialog({
  challan,
  onDone,
}: {
  challan: Challan;
  onDone: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [balances, setBalances] = useState<OrderBalanceLine[] | null>(null);
  const [quantities, setQuantities] = useState<Record<string, string>>(() =>
    Object.fromEntries(challan.lines.map((l) => [l.slug, String(l.quantity)]))
  );
  const [address, setAddress] = useState(challan.deliveryAddress);

  async function load(next: boolean) {
    setOpen(next);
    if (!next || balances) return;
    try {
      setBalances(
        await apiFetch<OrderBalanceLine[]>(
          `/api/admin/quotations/${encodeURIComponent(challan.quotationId)}/balances` +
            `?exclude_challan=${encodeURIComponent(challan.id)}`
        )
      );
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Could not load the order balances."
      );
      setOpen(false);
    }
  }

  const rows = challan.lines.map((line) => {
    const balance = balances?.find((b) => b.slug === line.slug);
    const available = balance?.balance ?? line.quantity;
    const entered = Number(quantities[line.slug] ?? 0);
    return { ...line, available, entered, over: entered > available };
  });
  const anyOver = rows.some((r) => r.over);

  async function save() {
    setBusy(true);
    try {
      await apiFetch(`/api/admin/challans/${encodeURIComponent(challan.id)}`, {
        method: "PATCH",
        body: {
          lines: rows.map((r) => ({
            slug: r.slug,
            name: r.name,
            specifications: r.specifications,
            unit: r.unit,
            quantity: r.entered,
          })),
          deliveryAddress: address,
        },
      });
      toast.success("Challan updated.");
      setOpen(false);
      onDone();
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Could not update the challan."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={load}>
      <DialogTrigger className={BTN}>
        <Pencil className="size-3.5" /> Edit
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-[17px] font-bold text-ink">Edit challan</DialogTitle>
          <DialogDescription className="text-[12.5px] text-ink-muted">
            {challan.customerName} · corrections must be made before approval.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[55vh] overflow-y-auto">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-hairline text-left">
                <th className="mono-label pb-2 text-[10px] text-ink-muted">Description</th>
                <th className="mono-label pb-2 text-right text-[10px] text-ink-muted">Available</th>
                <th className="mono-label pb-2 text-right text-[10px] text-ink-muted">
                  This delivery
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.slug} className="border-b border-hairline">
                  <td className="py-2 text-ink">{row.name}</td>
                  <td className="py-2 text-right font-mono text-ink-soft">{row.available}</td>
                  <td className="py-2 text-right">
                    <input
                      type="number"
                      min={0}
                      max={row.available}
                      value={quantities[row.slug] ?? ""}
                      onChange={(e) =>
                        setQuantities({ ...quantities, [row.slug]: e.target.value })
                      }
                      className={`w-24 rounded border px-2 py-1 text-right font-mono text-[12px] outline-none ${
                        row.over ? "border-[#c22] text-[#c22]" : "border-[#dde3ea] focus:border-primary"
                      }`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-3">
          <label className="mono-label mb-1 block text-[10px] text-ink-muted">
            Delivery address
          </label>
          <textarea
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            rows={2}
            className="w-full rounded border border-[#dde3ea] px-2.5 py-1.5 text-[12.5px] text-ink outline-none focus:border-primary"
          />
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-hairline pt-4">
          {anyOver ? (
            <p className="text-[12px] font-semibold text-[#c22]">
              One or more lines exceed what the order still owes.
            </p>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-md border border-[#dde3ea] px-3.5 py-2 text-[12.5px] font-semibold text-ink-soft"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={busy || anyOver}
              className="rounded-md bg-primary px-3.5 py-2 text-[12.5px] font-semibold text-white disabled:opacity-60"
            >
              {busy ? "Saving..." : "Save changes"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function SendChallanButton({ challan }: { challan: Challan }) {
  const [sending, setSending] = useState(false);

  async function send() {
    setSending(true);
    const toastId = toast.loading("Sending the challan...");
    try {
      await apiFetch(`/api/admin/challans/${encodeURIComponent(challan.id)}/send`, {
        method: "POST",
      });
      toast.success("Challan sent", {
        id: toastId,
        description: `${challan.challanNumber} delivered to the customer.`,
      });
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Could not send the challan.",
        { id: toastId }
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <button type="button" onClick={send} disabled={sending} className={BTN}>
      <Send className="size-3.5" /> {sending ? "Sending..." : "E-mail"}
    </button>
  );
}
