"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PackagePlus, CheckCircle2, Truck, PackageCheck } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogTrigger,
} from "@/app/components/ui/dialog";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import { apiFetch, apiUpload, ApiError } from "@/app/lib/api-browser";
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
import { DocumentActions } from "../document-actions";
import { OrderSummary, composeDeliveryAddress } from "../order-summary";
import {
  ViewChallanDialog,
  EditChallanDialog,
} from "./challan-dialogs";
import type { Challan, ChallanStatus, OrderBalanceLine } from "@/app/lib/admin-data";
import type { Quotation } from "@/app/lib/types";

const STATUS_PILL: Record<ChallanStatus, { label: string; tone: PillTone }> = {
  pending: { label: "PENDING", tone: "warn" },
  dispatched: { label: "DISPATCHED", tone: "info" },
  delivered: { label: "DELIVERED", tone: "ok" },
  cancelled: { label: "CANCELLED", tone: "danger" },
};

type LineDraft = {
  slug: string;
  name: string;
  specifications: string;
  unit: string;
  quantity: string;
  ordered: number;
  delivered: number;
  balance: number;
};

// Prepare Challan. The quantity columns are the point: ordered, already
// delivered, and what is left, so an admin shipping the second of three
// partial deliveries can see exactly what remains.
// `presetOrderId` comes from the ?order= deep link on a confirmed row, so
// Section C's "Prepare Challan" opens on that order instead of dropping the
// admin on a list to find it again.
function PrepareChallanDialog({
  orders,
  presetOrderId,
}: {
  orders: Quotation[];
  presetOrderId?: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [orderId, setOrderId] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [address, setAddress] = useState("");
  const [remarks, setRemarks] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  // Tracks which preset has been consumed, so closing the dialog does not
  // reopen it — the query string stays in the URL after the first open.
  const [consumed, setConsumed] = useState<string | null>(null);

  if (presetOrderId && consumed !== presetOrderId) {
    setConsumed(presetOrderId);
    setOpen(true);
    void pickOrder(presetOrderId);
  }

  async function pickOrder(id: string) {
    setOrderId(id);
    setLines([]);
    if (!id) return;
    const order = orders.find((o) => o.id === id);
    // Was the bare country, which put "Bangladesh" in the delivery address
    // field — complete-looking enough to dispatch against, and useless to a
    // driver. A price request collects no street address, so this composes
    // what the record actually holds and leaves the rest to be typed.
    setAddress(composeDeliveryAddress(order));
    setLoading(true);
    try {
      const balances = await apiFetch<OrderBalanceLine[]>(
        `/api/admin/quotations/${encodeURIComponent(id)}/balances`
      );
      setLines(
        balances.map((b) => ({
          slug: b.slug,
          name: b.name,
          specifications: b.specifications,
          unit: b.unit,
          quantity: String(b.balance),
          ordered: b.ordered,
          delivered: b.delivered,
          balance: b.balance,
        }))
      );
    } catch {
      toast.error("Could not load the order lines.");
    } finally {
      setLoading(false);
    }
  }

  const shipping = lines.filter((l) => Number(l.quantity) > 0);
  const overShipped = lines.some((l) => Number(l.quantity) > l.balance);

  async function save() {
    setBusy(true);
    try {
      await apiFetch("/api/admin/challans", {
        method: "POST",
        body: {
          quotationId: orderId,
          deliveryAddress: address,
          remarks,
          lines: shipping.map((l) => ({
            slug: l.slug,
            name: l.name,
            specifications: l.specifications,
            unit: l.unit,
            quantity: Number(l.quantity),
          })),
        },
      });
      toast.success("Challan saved to Pending.");
      setOpen(false);
      setOrderId("");
      setLines([]);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Could not save the challan."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button
            type="button"
            className="btn-sheen inline-flex items-center gap-2 rounded-[9px] border border-white/40 bg-accent/90 px-4 py-2.5 text-[13px] font-bold text-ink transition-all hover:-translate-y-0.5 hover:bg-accent"
          >
            <PackagePlus className="size-4" /> Prepare Challan
          </button>
        }
      />
      <DialogContent className="max-h-[85vh] w-full max-w-3xl overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-[17px] font-bold text-ink">Prepare challan</DialogTitle>
          <DialogDescription className="text-[12px] text-[#8a94a6]">
            Quantities default to the full remaining balance. Ship less to leave the rest
            for a later challan.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label>Confirmed order</Label>
          <Select value={orderId} onValueChange={(v) => pickOrder(v ?? "")}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select a confirmed order" />
            </SelectTrigger>
            <SelectContent>
              {orders.map((o) => (
                <SelectItem key={o.id} value={o.id}>
                  {o.confirmation?.refNumber} &middot;{" "}
                  {o.details.companyName || o.details.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Item 3: customer, PO/WO reference and quotation ref load with the
            order. Terms are omitted — a challan carries no prices. */}
        {orderId && <OrderSummary order={orders.find((o) => o.id === orderId)} />}

        {loading && <p className="text-[12px] text-[#8a94a6]">Loading order lines...</p>}

        {lines.length > 0 && (
          <>
            <div className="overflow-hidden rounded-[10px] border border-slate-line">
              <table className="w-full text-[12.5px]">
                <thead className="bg-surface">
                  <tr>
                    <th className={TH}>ITEM</th>
                    <th className={TH}>ORDERED</th>
                    <th className={TH}>DELIVERED</th>
                    <th className={TH}>BALANCE</th>
                    <th className={TH}>THIS DELIVERY</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => {
                    const over = Number(l.quantity) > l.balance;
                    return (
                      <tr key={`${l.slug}-${i}`} className={ROW}>
                        <td className={`${TD} text-ink`}>{l.name || l.slug}</td>
                        <td className={`${TD} font-mono text-ink-muted`}>{l.ordered}</td>
                        <td className={`${TD} font-mono text-ink-muted`}>{l.delivered}</td>
                        <td className={`${TD} font-mono font-semibold text-ink`}>
                          {l.balance}
                        </td>
                        <td className={TD}>
                          <Input
                            type="number"
                            min="0"
                            max={l.balance}
                            value={l.quantity}
                            aria-invalid={over}
                            onChange={(e) => {
                              const next = [...lines];
                              next[i] = { ...next[i], quantity: e.target.value };
                              setLines(next);
                            }}
                            className={`w-24 ${over ? "border-[#e04545]" : ""}`}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {overShipped && (
              <p className="rounded-md border border-[#f6cfcf] bg-[#fef6f6] px-3.5 py-2.5 text-[12px] text-[#7a2f2f]">
                One or more quantities exceed what is still owed on this order.
              </p>
            )}

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label>Delivery address</Label>
                {/* Multi-line: a delivery address is several lines, and the
                    single-line input silently hid everything past the first. */}
                <textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  rows={4}
                  className="w-full rounded-md border border-[#dde3ea] px-3 py-2 text-[13px] text-ink outline-none focus:border-primary"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Remarks</Label>
                <Input value={remarks} onChange={(e) => setRemarks(e.target.value)} />
              </div>
            </div>
          </>
        )}

        <div className="flex justify-end gap-2 border-t border-hairline pt-4">
          <button
            type="button"
            onClick={save}
            disabled={busy || shipping.length === 0 || overShipped}
            className="btn-sheen inline-flex items-center gap-2 rounded-[9px] border border-white/40 bg-accent/90 px-4 py-2.5 text-[13px] font-bold text-ink transition-all hover:-translate-y-0.5 hover:bg-accent disabled:translate-y-0 disabled:opacity-60"
          >
            {busy ? "Saving..." : "Save as Pending"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DispatchDialog({ challan, onDone }: { challan: Challan; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [vehicle, setVehicle] = useState(challan.vehicleNumber);
  const [driver, setDriver] = useState(challan.driverInfo);
  const [receiver, setReceiver] = useState(challan.receiverName);
  // Section B lists Remarks among the dispatch details. The backend has
  // always stored it; the dialog collected four of the five fields.
  const [remarks, setRemarks] = useState(challan.remarks ?? "");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await apiFetch(`/api/admin/challans/${encodeURIComponent(challan.id)}/dispatch`, {
        method: "POST",
        body: {
          vehicleNumber: vehicle,
          driverInfo: driver,
          receiverName: receiver,
          remarks,
        },
      });
      toast.success("Marked dispatched.");
      setOpen(false);
      onDone();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not dispatch.");
    } finally {
      setBusy(false);
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
            <Truck className="size-3.5" /> Dispatch
          </button>
        }
      />
      <DialogContent className="w-full max-w-md sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[17px] font-bold text-ink">Dispatch</DialogTitle>
          <DialogDescription className="font-mono text-[11.5px] text-[#8a94a6]">
            {challan.challanNumber}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Vehicle number</Label>
            <Input value={vehicle} onChange={(e) => setVehicle(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Driver / transport</Label>
            <Input value={driver} onChange={(e) => setDriver(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Receiver / contact person</Label>
            <Input value={receiver} onChange={(e) => setReceiver(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Remarks</Label>
            {/* Multi-line: dispatch notes are instructions to whoever
                receives the goods, not a single short value. */}
            <textarea
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              rows={2}
              placeholder="Handling notes, gate pass, delivery window..."
              className="w-full rounded-[8px] border border-slate-line bg-white px-3 py-2 text-[13px] text-ink outline-none transition-colors focus:border-primary"
            />
          </div>
        </div>

        <div className="flex justify-end border-t border-hairline pt-4">
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="btn-sheen inline-flex items-center gap-2 rounded-[9px] border border-white/40 bg-accent/90 px-4 py-2.5 text-[13px] font-bold text-ink transition-all hover:-translate-y-0.5 hover:bg-accent disabled:translate-y-0 disabled:opacity-60"
          >
            {busy ? "Saving..." : "Mark dispatched"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function DeliverDialog({ challan, onDone }: { challan: Challan; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      const form = new FormData();
      if (file) form.set("file", file);
      await apiUpload(
        `/api/admin/challans/${encodeURIComponent(challan.id)}/deliver`,
        form
      );
      toast.success("Marked delivered.");
      setOpen(false);
      onDone();
    } catch (error) {
      toast.error(error instanceof ApiError ? error.message : "Could not confirm delivery.");
    } finally {
      setBusy(false);
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
            <PackageCheck className="size-3.5" /> Delivered
          </button>
        }
      />
      <DialogContent className="w-full max-w-md sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[17px] font-bold text-ink">Confirm delivery</DialogTitle>
          <DialogDescription className="text-[12px] text-[#8a94a6]">
            Attach the customer-signed challan if you have it. The order completes on its
            own once every line has shipped.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-1.5">
          <Label>Signed challan (optional)</Label>
          <Input
            type="file"
            accept=".pdf,image/jpeg,image/png,image/webp"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>

        <div className="flex justify-end border-t border-hairline pt-4">
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="btn-sheen inline-flex items-center gap-2 rounded-[9px] border border-white/40 bg-accent/90 px-4 py-2.5 text-[13px] font-bold text-ink transition-all hover:-translate-y-0.5 hover:bg-accent disabled:translate-y-0 disabled:opacity-60"
          >
            {busy ? "Saving..." : "Mark delivered"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ChallanRow({ challan, onChanged }: { challan: Challan; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const pill = STATUS_PILL[challan.status];
  const units = challan.lines.reduce((sum, l) => sum + l.quantity, 0);

  async function approve() {
    setBusy(true);
    try {
      await apiFetch(`/api/admin/challans/${encodeURIComponent(challan.id)}/approve`, {
        method: "POST",
      });
      toast.success("Challan approved and numbered.");
      onChanged();
    } catch {
      toast.error("Could not approve the challan.");
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    setBusy(true);
    try {
      await apiFetch(`/api/admin/challans/${encodeURIComponent(challan.id)}/status`, {
        method: "PATCH",
        body: { status: "cancelled" },
      });
      toast.success("Challan cancelled. Its quantities are back on the order.");
      onChanged();
    } catch (error) {
      // The backend refuses moves the workflow does not allow, and its
      // reason is more use than "could not cancel".
      toast.error(
        error instanceof ApiError ? error.message : "Could not cancel the challan."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr className={ROW}>
      <td className={`${TD} font-mono text-[12px] font-semibold text-ink`}>
        {challan.challanNumber ?? <span className="text-[#8a94a6]">Draft</span>}
      </td>
      <td className={`${TD} text-ink-soft`}>
        {challan.customerName}
        <span className="block font-mono text-[11px] text-[#8a94a6]">{challan.refNumber}</span>
      </td>
      <td className={`${TD} font-mono text-ink-soft`}>{challan.lines.length}</td>
      <td className={`${TD} font-mono font-semibold text-ink`}>{units}</td>
      <td className={`${TD} font-mono text-[11.5px] text-ink-muted`}>
        {challan.vehicleNumber || "—"}
      </td>
      <td className={TD}>
        <Pill tone={pill.tone}>{pill.label}</Pill>
      </td>
      <td className={TD}>
        {/* View, Edit, Preview, Print or Cancel before finalisation — Preview
            and Print are DocumentActions, below. */}
        <div className="flex flex-wrap items-center gap-2">
          <ViewChallanDialog challan={challan} />
          {challan.challanNumber === null && (
            <>
              <EditChallanDialog challan={challan} onDone={onChanged} />
              <button
                type="button"
                onClick={approve}
                disabled={busy}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-[#dde3ea] px-2.5 py-1.5 text-[11.5px] font-semibold text-ink-soft transition-colors hover:border-primary hover:text-primary disabled:opacity-60"
              >
                <CheckCircle2 className="size-3.5" /> Approve
              </button>
            </>
          )}
          {challan.challanNumber !== null && challan.status === "pending" && (
            <>
              <DispatchDialog challan={challan} onDone={onChanged} />
            </>
          )}
          {challan.status === "dispatched" && (
            <DeliverDialog challan={challan} onDone={onChanged} />
          )}
          {challan.signedDocumentUrl && (
            <a
              href={challan.signedDocumentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[11.5px] font-semibold text-primary hover:underline"
            >
              Signed copy
            </a>
          )}
          {/* The challan travels with the goods, so Print matters more here
              than on the invoice — and it must be printable before dispatch,
              which is why a draft renders too. */}
          <DocumentActions
            path={`/api/admin/challans/${encodeURIComponent(challan.id)}/pdf`}
            fileName={`${challan.challanNumber ?? "challan-draft"}.pdf`}
            label="Challan PDF"
          />
          {/* Only while the goods are still here. Once a challan is
              dispatched the stock has left the building, so cancelling it
              would put quantity back on the order that nobody can ship. */}
          {challan.status === "pending" && (
            <RowButton tone="danger" disabled={busy} onClick={cancel}>
              Cancel
            </RowButton>
          )}
        </div>
      </td>
    </tr>
  );
}

export function ChallansClient({
  initialChallans,
  orders,
  presetOrderId,
}: {
  initialChallans: Challan[];
  orders: Quotation[];
  presetOrderId?: string;
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | ChallanStatus>("pending");
  const [pending, startTransition] = useTransition();

  const onChanged = () => startTransition(() => router.refresh());
  const count = (s: ChallanStatus) => initialChallans.filter((c) => c.status === s).length;
  const visible =
    filter === "all" ? initialChallans : initialChallans.filter((c) => c.status === filter);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Delivery challans"
        subtitle="One order can ship across several challans. Balances update as each is delivered."
      >
        <div className="flex flex-wrap items-center gap-3">
          <FilterBar
            value={filter}
            onChange={setFilter}
            options={[
              { value: "pending", label: "Pending", count: count("pending") },
              { value: "dispatched", label: "Dispatched", count: count("dispatched") },
              { value: "delivered", label: "Delivered", count: count("delivered") },
              { value: "cancelled", label: "Cancelled", count: count("cancelled") },
              { value: "all", label: "All", count: initialChallans.length },
            ]}
          />
          <PrepareChallanDialog orders={orders} presetOrderId={presetOrderId} />
        </div>
      </PageHeader>

      {initialChallans.length > 0 && (
        <div
          className={`grid gap-4 transition-opacity duration-200 sm:grid-cols-3 ${
            pending ? "opacity-60" : "opacity-100"
          }`}
        >
          {[
            { label: "Awaiting dispatch", value: String(count("pending")), tone: "bg-accent" },
            { label: "In transit", value: String(count("dispatched")), tone: "bg-primary" },
            { label: "Delivered", value: String(count("delivered")), tone: "bg-ok-dot" },
          ].map((s) => (
            <Panel key={s.label} className="overflow-hidden">
              <span className={`block h-0.75 ${s.tone}`} />
              <div className="p-4.5">
                <p className="mb-2 text-[12px] font-medium text-[#64748b]">{s.label}</p>
                <p className="font-mono text-[22px] font-bold tracking-[-0.02em] text-ink">
                  {s.value}
                </p>
              </div>
            </Panel>
          ))}
        </div>
      )}

      {visible.length === 0 ? (
        <EmptyState>
          {initialChallans.length === 0
            ? "No challans yet. Prepare one from a confirmed order."
            : "No challans in this view."}
        </EmptyState>
      ) : (
        <Panel className="overflow-hidden">
          <div className="scrollbar-slim overflow-x-auto">
            <table className="w-full min-w-260 text-[12.5px]">
              <thead className="bg-surface">
                <tr>
                  <th className={TH}>CHALLAN NO.</th>
                  <th className={TH}>CUSTOMER</th>
                  <th className={TH}>LINES</th>
                  <th className={TH}>UNITS</th>
                  <th className={TH}>VEHICLE</th>
                  <th className={TH}>STATUS</th>
                  <th className={TH}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((challan) => (
                  <ChallanRow key={challan.id} challan={challan} onChanged={onChanged} />
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
}
