"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FilePlus2, CheckCircle2, Wallet } from "lucide-react";
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
import { formatPrice } from "@/app/lib/utils";
import { apiFetch, ApiError } from "@/app/lib/api-browser";
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
import {
  ViewInvoiceDialog,
  EditInvoiceDialog,
  SendInvoiceButton,
} from "./invoice-dialogs";
import type {
  Invoice,
  InvoiceStatus,
  OrderBalanceLine,
} from "@/app/lib/admin-data";
import type { Quotation } from "@/app/lib/types";

const STATUS_PILL: Record<InvoiceStatus, { label: string; tone: PillTone }> = {
  pending: { label: "PENDING", tone: "warn" },
  submitted: { label: "SUBMITTED", tone: "info" },
  partially_paid: { label: "PARTIALLY PAID", tone: "warn" },
  paid: { label: "PAID", tone: "ok" },
  completed: { label: "COMPLETED", tone: "ok" },
  cancelled: { label: "CANCELLED", tone: "danger" },
};

type LineDraft = {
  slug: string;
  name: string;
  specifications: string;
  unit: string;
  quantity: string;
  unitPrice: string;
  max: number;
};

// Prepare Invoice: loads the confirmed order's lines, defaults each quantity
// to what is still unbilled, and computes the money as the admin types.
function PrepareInvoiceDialog({ orders }: { orders: Quotation[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [orderId, setOrderId] = useState("");
  const [lines, setLines] = useState<LineDraft[]>([]);
  const [discount, setDiscount] = useState("0");
  const [taxRate, setTaxRate] = useState("0");
  const [otherCharges, setOtherCharges] = useState("0");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);

  async function pickOrder(id: string) {
    setOrderId(id);
    setLines([]);
    if (!id) return;
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
          // Defaults to what is left to bill, which is the common case.
          quantity: String(b.uninvoiced),
          unitPrice: String(b.unitPrice),
          max: b.uninvoiced,
        }))
      );
    } catch {
      toast.error("Could not load the order lines.");
    } finally {
      setLoading(false);
    }
  }

  const billable = lines.filter((l) => Number(l.quantity) > 0);
  const subtotal = billable.reduce(
    (sum, l) => sum + Number(l.quantity) * Number(l.unitPrice || 0),
    0
  );
  const taxable = Math.max(0, subtotal - Number(discount || 0));
  const taxAmount = taxable * (Number(taxRate || 0) / 100);
  const grandTotal = taxable + taxAmount + Number(otherCharges || 0);

  async function save() {
    setBusy(true);
    try {
      await apiFetch("/api/admin/invoices", {
        method: "POST",
        body: {
          quotationId: orderId,
          lines: billable.map((l) => ({
            slug: l.slug,
            name: l.name,
            specifications: l.specifications,
            unit: l.unit,
            quantity: Number(l.quantity),
            unitPrice: Number(l.unitPrice || 0),
          })),
          discount: Number(discount || 0),
          taxRate: Number(taxRate || 0),
          otherCharges: Number(otherCharges || 0),
          notes,
        },
      });
      toast.success("Invoice saved to Pending.");
      setOpen(false);
      setOrderId("");
      setLines([]);
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Could not save the invoice."
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
            <FilePlus2 className="size-4" /> Prepare Invoice
          </button>
        }
      />
      <DialogContent className="max-h-[85vh] w-full max-w-3xl overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-[17px] font-bold text-ink">Prepare invoice</DialogTitle>
          <DialogDescription className="text-[12px] text-[#8a94a6]">
            Everything is loaded from the confirmed order. Quantities default to what is
            still unbilled.
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

        {loading && <p className="text-[12px] text-[#8a94a6]">Loading order lines...</p>}

        {lines.length > 0 && (
          <>
            <div className="overflow-hidden rounded-[10px] border border-slate-line">
              <table className="w-full text-[12.5px]">
                <thead className="bg-surface">
                  <tr>
                    <th className={TH}>ITEM</th>
                    <th className={TH}>UNBILLED</th>
                    <th className={TH}>QTY</th>
                    <th className={TH}>UNIT PRICE</th>
                    <th className={TH}>AMOUNT</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((l, i) => (
                    <tr key={`${l.slug}-${i}`} className={ROW}>
                      <td className={`${TD} text-ink`}>{l.name || l.slug}</td>
                      <td className={`${TD} font-mono text-ink-muted`}>{l.max}</td>
                      <td className={TD}>
                        <Input
                          type="number"
                          min="0"
                          max={l.max}
                          value={l.quantity}
                          onChange={(e) => {
                            const next = [...lines];
                            next[i] = { ...next[i], quantity: e.target.value };
                            setLines(next);
                          }}
                          className="w-20"
                        />
                      </td>
                      <td className={TD}>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={l.unitPrice}
                          onChange={(e) => {
                            const next = [...lines];
                            next[i] = { ...next[i], unitPrice: e.target.value };
                            setLines(next);
                          }}
                          className="w-28"
                        />
                      </td>
                      <td className={`${TD} font-mono font-semibold text-ink`}>
                        {formatPrice(Number(l.quantity || 0) * Number(l.unitPrice || 0))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label>Discount</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={discount}
                  onChange={(e) => setDiscount(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>VAT / Tax (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.01"
                  value={taxRate}
                  onChange={(e) => setTaxRate(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Other charges</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={otherCharges}
                  onChange={(e) => setOtherCharges(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>

            <div className="rounded-[10px] border border-slate-line bg-surface p-4">
              {[
                ["Subtotal", subtotal],
                ["Discount", -Number(discount || 0)],
                [`VAT / Tax (${Number(taxRate || 0)}%)`, taxAmount],
                ["Other charges", Number(otherCharges || 0)],
              ].map(([label, value]) => (
                <div key={String(label)} className="flex justify-between py-1 text-[12.5px]">
                  <span className="text-ink-soft">{label}</span>
                  <span className="font-mono text-ink">{formatPrice(Number(value))}</span>
                </div>
              ))}
              <div className="mt-2 flex justify-between border-t border-slate-line pt-2">
                <span className="text-[13px] font-bold text-ink">Grand total</span>
                <span className="font-mono text-[15px] font-bold text-ink">
                  {formatPrice(grandTotal)}
                </span>
              </div>
            </div>
          </>
        )}

        <div className="flex justify-end gap-2 border-t border-hairline pt-4">
          <button
            type="button"
            onClick={save}
            disabled={busy || billable.length === 0}
            className="btn-sheen inline-flex items-center gap-2 rounded-[9px] border border-white/40 bg-accent/90 px-4 py-2.5 text-[13px] font-bold text-ink transition-all hover:-translate-y-0.5 hover:bg-accent disabled:translate-y-0 disabled:opacity-60"
          >
            {busy ? "Saving..." : "Save as Pending"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RecordPaymentDialog({ invoice, onDone }: { invoice: Invoice; onDone: () => void }) {
  const [open, setOpen] = useState(false);
  const outstanding = Math.max(0, invoice.grandTotal - invoice.amountPaid);
  const [amount, setAmount] = useState(String(outstanding));
  const [method, setMethod] = useState("");
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
    setBusy(true);
    try {
      await apiFetch(`/api/admin/invoices/${encodeURIComponent(invoice.id)}/payments`, {
        method: "POST",
        body: { amount: Number(amount), method, reference },
      });
      toast.success("Payment recorded.");
      setOpen(false);
      onDone();
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Could not record the payment."
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
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-[#dde3ea] px-2.5 py-1.5 text-[11.5px] font-semibold text-ink-soft transition-colors hover:border-primary hover:text-primary"
          >
            <Wallet className="size-3.5" /> Payment
          </button>
        }
      />
      <DialogContent className="w-full max-w-md sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[17px] font-bold text-ink">Record payment</DialogTitle>
          <DialogDescription className="font-mono text-[11.5px] text-[#8a94a6]">
            {invoice.invoiceNumber} &middot; {formatPrice(outstanding)} outstanding
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Amount received</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Method</Label>
            <Input
              value={method}
              placeholder="Bank transfer, cheque, cash"
              onChange={(e) => setMethod(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Reference</Label>
            <Input
              value={reference}
              placeholder="Transaction or cheque number"
              onChange={(e) => setReference(e.target.value)}
            />
          </div>
        </div>

        <div className="flex justify-end border-t border-hairline pt-4">
          <button
            type="button"
            onClick={save}
            disabled={busy || Number(amount) <= 0}
            className="btn-sheen inline-flex items-center gap-2 rounded-[9px] border border-white/40 bg-accent/90 px-4 py-2.5 text-[13px] font-bold text-ink transition-all hover:-translate-y-0.5 hover:bg-accent disabled:translate-y-0 disabled:opacity-60"
          >
            {busy ? "Saving..." : "Record payment"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InvoiceRow({ invoice, onChanged }: { invoice: Invoice; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const pill = STATUS_PILL[invoice.status];
  const outstanding = Math.max(0, invoice.grandTotal - invoice.amountPaid);

  async function approve() {
    setBusy(true);
    try {
      await apiFetch(`/api/admin/invoices/${encodeURIComponent(invoice.id)}/approve`, {
        method: "POST",
      });
      toast.success("Invoice approved and numbered.");
      onChanged();
    } catch {
      toast.error("Could not approve the invoice.");
    } finally {
      setBusy(false);
    }
  }

  async function setStatus(status: InvoiceStatus) {
    setBusy(true);
    try {
      await apiFetch(`/api/admin/invoices/${encodeURIComponent(invoice.id)}/status`, {
        method: "PATCH",
        body: { status },
      });
      onChanged();
    } catch {
      toast.error("Could not update the invoice.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <tr className={ROW}>
      <td className={`${TD} font-mono text-[12px] font-semibold text-ink`}>
        {invoice.invoiceNumber ?? <span className="text-[#8a94a6]">Draft</span>}
      </td>
      <td className={`${TD} text-ink-soft`}>
        {invoice.customerName}
        <span className="block font-mono text-[11px] text-[#8a94a6]">
          {invoice.refNumber}
        </span>
      </td>
      <td className={`${TD} font-mono text-ink-soft`}>{invoice.lines.length}</td>
      <td className={`${TD} font-mono font-semibold text-ink`}>
        {formatPrice(invoice.grandTotal)}
      </td>
      <td className={`${TD} font-mono text-ink-soft`}>{formatPrice(outstanding)}</td>
      <td className={TD}>
        <Pill tone={pill.tone}>{pill.label}</Pill>
      </td>
      <td className={TD}>
        {/* Item 12: from Pending the user can View, Edit, Cancel, Preview
            and Print. Items 17-19 add Send, which is what moves an approved
            invoice to Submitted. */}
        <div className="flex flex-wrap items-center gap-2">
          <ViewInvoiceDialog invoice={invoice} />
          {invoice.invoiceNumber === null ? (
            <>
              {/* Corrections belong before approval — after it, the number
                  is on a document the customer may already hold. */}
              <EditInvoiceDialog invoice={invoice} onDone={onChanged} />
              <button
                type="button"
                onClick={approve}
                disabled={busy}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-[#dde3ea] px-2.5 py-1.5 text-[11.5px] font-semibold text-ink-soft transition-colors hover:border-primary hover:text-primary disabled:opacity-60"
              >
                <CheckCircle2 className="size-3.5" /> Approve
              </button>
            </>
          ) : (
            <>
              {invoice.status === "pending" && (
                <SendInvoiceButton invoice={invoice} onDone={onChanged} />
              )}
              <RecordPaymentDialog invoice={invoice} onDone={onChanged} />
              {invoice.status === "paid" && (
                <RowButton tone="ok" disabled={busy} onClick={() => setStatus("completed")}>
                  Complete
                </RowButton>
              )}
            </>
          )}
          {/* Available on a draft too, so the figures can be checked on
              paper before a number is committed to. The document says
              DRAFT across it until then. */}
          <DocumentActions
            path={`/api/admin/invoices/${encodeURIComponent(invoice.id)}/pdf`}
            fileName={`${invoice.invoiceNumber ?? "invoice-draft"}.pdf`}
          />
          {invoice.status !== "cancelled" && invoice.status !== "completed" && (
            <RowButton tone="danger" disabled={busy} onClick={() => setStatus("cancelled")}>
              Cancel
            </RowButton>
          )}
        </div>
      </td>
    </tr>
  );
}

export function InvoicesClient({
  initialInvoices,
  orders,
}: {
  initialInvoices: Invoice[];
  orders: Quotation[];
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | InvoiceStatus>("pending");
  const [pending, startTransition] = useTransition();

  const onChanged = () => startTransition(() => router.refresh());
  const count = (s: InvoiceStatus) => initialInvoices.filter((i) => i.status === s).length;
  const visible =
    filter === "all" ? initialInvoices : initialInvoices.filter((i) => i.status === filter);

  const outstanding = initialInvoices
    .filter((i) => i.status !== "cancelled")
    .reduce((sum, i) => sum + Math.max(0, i.grandTotal - i.amountPaid), 0);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Invoices"
        subtitle="Raised against confirmed orders. Approve to assign the formal number."
      >
        <div className="flex flex-wrap items-center gap-3">
          <FilterBar
            value={filter}
            onChange={setFilter}
            options={[
              { value: "pending", label: "Pending", count: count("pending") },
              { value: "submitted", label: "Submitted", count: count("submitted") },
              { value: "partially_paid", label: "Partially Paid", count: count("partially_paid") },
              { value: "paid", label: "Paid", count: count("paid") },
              { value: "cancelled", label: "Cancelled", count: count("cancelled") },
              { value: "all", label: "All", count: initialInvoices.length },
            ]}
          />
          <PrepareInvoiceDialog orders={orders} />
        </div>
      </PageHeader>

      {initialInvoices.length > 0 && (
        <div
          className={`grid gap-4 transition-opacity duration-200 sm:grid-cols-3 ${
            pending ? "opacity-60" : "opacity-100"
          }`}
        >
          {[
            { label: "Invoices", value: String(initialInvoices.length), tone: "bg-primary" },
            { label: "Awaiting approval", value: String(count("pending")), tone: "bg-accent" },
            { label: "Outstanding", value: formatPrice(outstanding), tone: "bg-ok-dot" },
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
          {initialInvoices.length === 0
            ? "No invoices yet. Prepare one from a confirmed order."
            : "No invoices in this view."}
        </EmptyState>
      ) : (
        <Panel className="overflow-hidden">
          <div className="scrollbar-slim overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead className="bg-surface">
                <tr>
                  <th className={TH}>INVOICE NO.</th>
                  <th className={TH}>CUSTOMER</th>
                  <th className={TH}>ITEMS</th>
                  <th className={TH}>TOTAL</th>
                  <th className={TH}>OUTSTANDING</th>
                  <th className={TH}>STATUS</th>
                  <th className={TH}>ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((invoice) => (
                  <InvoiceRow key={invoice.id} invoice={invoice} onChanged={onChanged} />
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
}
