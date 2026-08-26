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
import { formatPrice } from "@/app/lib/utils";
import { apiFetch, ApiError } from "@/app/lib/api-browser";
import type { Invoice } from "@/app/lib/admin-data";

// Item 12 of the client's specification: from Pending, an invoice can be
// Viewed, Edited, Cancelled, Previewed and Printed. Preview and Print are in
// DocumentActions; View and Edit are here.

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

export function ViewInvoiceDialog({ invoice }: { invoice: Invoice }) {
  const outstanding = invoice.grandTotal - invoice.amountPaid;

  return (
    <Dialog>
      <DialogTrigger className={BTN}>
        <Eye className="size-3.5" /> View
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-[17px] font-bold text-ink">
            {invoice.invoiceNumber ?? "Draft invoice"}
          </DialogTitle>
          <DialogDescription className="text-[12.5px] text-ink-muted">
            {invoice.customerName}
            {invoice.refNumber ? ` · ${invoice.refNumber}` : ""}
            {invoice.poNumber ? ` · PO ${invoice.poNumber}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[65vh] space-y-5 overflow-y-auto">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-hairline text-left">
                <th className="mono-label pb-2 text-[10px] text-ink-muted">Description</th>
                <th className="mono-label pb-2 text-right text-[10px] text-ink-muted">Qty</th>
                <th className="mono-label pb-2 text-right text-[10px] text-ink-muted">Unit Price</th>
                <th className="mono-label pb-2 text-right text-[10px] text-ink-muted">Total</th>
              </tr>
            </thead>
            <tbody>
              {invoice.lines.map((line) => (
                <tr key={line.slug} className="border-b border-hairline">
                  <td className="py-2 text-ink">
                    {line.name}
                    {line.specifications && (
                      <span className="block text-[11px] text-ink-muted">
                        {line.specifications}
                      </span>
                    )}
                  </td>
                  <td className="py-2 text-right font-mono text-ink-soft">
                    {line.quantity} {line.unit}
                  </td>
                  <td className="py-2 text-right font-mono text-ink-soft">
                    {formatPrice(line.unitPrice)}
                  </td>
                  <td className="py-2 text-right font-mono font-semibold text-ink">
                    {formatPrice(line.total)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Subtotal -> Discount -> VAT -> Other Charges -> Grand Total, the
              order the specification lists and compute_totals applies. */}
          <table className="ml-auto w-full max-w-xs text-[12.5px]">
            <tbody>
              <tr>
                <td className="py-1 text-ink-muted">Subtotal</td>
                <td className="py-1 text-right font-mono text-ink">{formatPrice(invoice.subtotal)}</td>
              </tr>
              {invoice.discount > 0 && (
                <tr>
                  <td className="py-1 text-ink-muted">Discount</td>
                  <td className="py-1 text-right font-mono text-ink">
                    −{formatPrice(invoice.discount)}
                  </td>
                </tr>
              )}
              {invoice.taxAmount > 0 && (
                <tr>
                  <td className="py-1 text-ink-muted">VAT / Tax ({invoice.taxRate}%)</td>
                  <td className="py-1 text-right font-mono text-ink">
                    {formatPrice(invoice.taxAmount)}
                  </td>
                </tr>
              )}
              {invoice.otherCharges > 0 && (
                <tr>
                  <td className="py-1 text-ink-muted">Other charges</td>
                  <td className="py-1 text-right font-mono text-ink">
                    {formatPrice(invoice.otherCharges)}
                  </td>
                </tr>
              )}
              <tr className="border-t border-hairline">
                <td className="pt-2 font-bold text-ink">Grand total</td>
                <td className="pt-2 text-right font-mono font-bold text-ink">
                  {formatPrice(invoice.grandTotal)}
                </td>
              </tr>
              {invoice.amountPaid > 0 && (
                <>
                  <tr>
                    <td className="py-1 text-ink-muted">Received</td>
                    <td className="py-1 text-right font-mono text-[#12a366]">
                      {formatPrice(invoice.amountPaid)}
                    </td>
                  </tr>
                  <tr>
                    <td className="py-1 font-semibold text-ink">Outstanding</td>
                    <td className="py-1 text-right font-mono font-semibold text-[#cc9400]">
                      {formatPrice(outstanding)}
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>

          {invoice.payments.length > 0 && (
            <div>
              <h3 className="mono-label mb-2 text-[10.5px] text-ink-muted">Payments received</h3>
              <table className="w-full text-[12px]">
                <tbody>
                  {invoice.payments.map((p) => (
                    <tr key={p.id} className="border-b border-hairline">
                      <td className="py-1.5 font-mono text-ink-soft">{when(p.receivedAt)}</td>
                      <td className="py-1.5 text-ink-soft">{p.method || "—"}</td>
                      <td className="py-1.5 text-ink-muted">{p.reference || "—"}</td>
                      <td className="py-1.5 text-right font-mono font-semibold text-ink">
                        {formatPrice(p.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 border-t border-hairline pt-4 text-[12px]">
            <div className="flex justify-between">
              <dt className="text-ink-muted">Created</dt>
              <dd className="font-mono text-ink-soft">{when(invoice.createdAt)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-muted">Approved</dt>
              <dd className="font-mono text-ink-soft">{when(invoice.approvedAt)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-muted">Submitted</dt>
              <dd className="font-mono text-ink-soft">{when(invoice.submittedAt)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-ink-muted">Completed</dt>
              <dd className="font-mono text-ink-soft">{when(invoice.completedAt)}</dd>
            </div>
          </dl>

          {invoice.notes && (
            <p className="rounded-md bg-[#f7f9fb] p-3 text-[12px] text-ink-soft">{invoice.notes}</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Editing is pending-only, which the backend enforces too — an approved
// invoice carries a formal number the customer may already hold, so changing
// its figures would leave two different documents with one number.
export function EditInvoiceDialog({
  invoice,
  onDone,
}: {
  invoice: Invoice;
  onDone: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [quantities, setQuantities] = useState<Record<string, string>>(() =>
    Object.fromEntries(invoice.lines.map((l) => [l.slug, String(l.quantity)]))
  );
  const [prices, setPrices] = useState<Record<string, string>>(() =>
    Object.fromEntries(invoice.lines.map((l) => [l.slug, String(l.unitPrice)]))
  );
  const [discount, setDiscount] = useState(String(invoice.discount));
  const [taxRate, setTaxRate] = useState(String(invoice.taxRate));
  const [otherCharges, setOtherCharges] = useState(String(invoice.otherCharges));

  const lines = invoice.lines.map((l) => ({
    ...l,
    qty: Number(quantities[l.slug] ?? 0),
    price: Number(prices[l.slug] ?? 0),
  }));
  const subtotal = lines.reduce((sum, l) => sum + l.qty * l.price, 0);
  const taxable = Math.max(0, subtotal - Number(discount || 0));
  const taxAmount = taxable * (Number(taxRate || 0) / 100);
  const grandTotal = taxable + taxAmount + Number(otherCharges || 0);

  async function save() {
    setBusy(true);
    try {
      await apiFetch(`/api/admin/invoices/${encodeURIComponent(invoice.id)}`, {
        method: "PATCH",
        body: {
          lines: lines.map((l) => ({
            slug: l.slug,
            name: l.name,
            specifications: l.specifications,
            unit: l.unit,
            quantity: l.qty,
            unitPrice: l.price,
          })),
          discount: Number(discount || 0),
          taxRate: Number(taxRate || 0),
          otherCharges: Number(otherCharges || 0),
        },
      });
      toast.success("Invoice updated.");
      setOpen(false);
      onDone();
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Could not update the invoice."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className={BTN}>
        <Pencil className="size-3.5" /> Edit
      </DialogTrigger>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="text-[17px] font-bold text-ink">Edit invoice</DialogTitle>
          <DialogDescription className="text-[12.5px] text-ink-muted">
            {invoice.customerName} · corrections must be made before approval.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[55vh] overflow-y-auto">
          <table className="w-full text-[12.5px]">
            <thead>
              <tr className="border-b border-hairline text-left">
                <th className="mono-label pb-2 text-[10px] text-ink-muted">Description</th>
                <th className="mono-label pb-2 text-right text-[10px] text-ink-muted">Qty</th>
                <th className="mono-label pb-2 text-right text-[10px] text-ink-muted">Unit Price</th>
                <th className="mono-label pb-2 text-right text-[10px] text-ink-muted">Total</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => (
                <tr key={line.slug} className="border-b border-hairline">
                  <td className="py-2 text-ink">{line.name}</td>
                  <td className="py-2 text-right">
                    <input
                      type="number"
                      min={0}
                      value={quantities[line.slug] ?? ""}
                      onChange={(e) =>
                        setQuantities({ ...quantities, [line.slug]: e.target.value })
                      }
                      className="w-20 rounded border border-[#dde3ea] px-2 py-1 text-right font-mono text-[12px] outline-none focus:border-primary"
                    />
                  </td>
                  <td className="py-2 text-right">
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={prices[line.slug] ?? ""}
                      onChange={(e) => setPrices({ ...prices, [line.slug]: e.target.value })}
                      className="w-28 rounded border border-[#dde3ea] px-2 py-1 text-right font-mono text-[12px] outline-none focus:border-primary"
                    />
                  </td>
                  <td className="py-2 text-right font-mono font-semibold text-ink">
                    {formatPrice(line.qty * line.price)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Three number inputs side by side leave ~90px each on a phone,
            which is narrower than the figures they hold. */}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="mono-label mb-1 block text-[10px] text-ink-muted">Discount</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={discount}
              onChange={(e) => setDiscount(e.target.value)}
              className="w-full rounded border border-[#dde3ea] px-2 py-1.5 text-right font-mono text-[12.5px] outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="mono-label mb-1 block text-[10px] text-ink-muted">VAT / Tax %</label>
            <input
              type="number"
              min={0}
              max={100}
              step="0.01"
              value={taxRate}
              onChange={(e) => setTaxRate(e.target.value)}
              className="w-full rounded border border-[#dde3ea] px-2 py-1.5 text-right font-mono text-[12.5px] outline-none focus:border-primary"
            />
          </div>
          <div>
            <label className="mono-label mb-1 block text-[10px] text-ink-muted">Other charges</label>
            <input
              type="number"
              min={0}
              step="0.01"
              value={otherCharges}
              onChange={(e) => setOtherCharges(e.target.value)}
              className="w-full rounded border border-[#dde3ea] px-2 py-1.5 text-right font-mono text-[12.5px] outline-none focus:border-primary"
            />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between border-t border-hairline pt-4">
          <div className="text-[13px]">
            <span className="text-ink-muted">Grand total </span>
            <span className="font-mono text-[15px] font-bold text-ink">
              {formatPrice(grandTotal)}
            </span>
          </div>
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
              disabled={busy}
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

// Item 17-19: send, then Submitted. The status moves on a confirmed send.
export function SendInvoiceButton({
  invoice,
  onDone,
}: {
  invoice: Invoice;
  onDone: () => void;
}) {
  const router = useRouter();
  const [sending, setSending] = useState(false);

  async function send() {
    setSending(true);
    const toastId = toast.loading("Sending the invoice...");
    try {
      await apiFetch(`/api/admin/invoices/${encodeURIComponent(invoice.id)}/send`, {
        method: "POST",
      });
      toast.success("Invoice sent", {
        id: toastId,
        description: `${invoice.invoiceNumber} delivered. Moved to Submitted.`,
        duration: 7000,
      });
      onDone();
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Could not send the invoice.",
        { id: toastId, description: "It stays pending, so you can retry." }
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={send}
      disabled={sending}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-primary bg-[#eaf4fb] px-2.5 py-1.5 text-[11.5px] font-semibold text-primary transition-colors hover:bg-primary hover:text-white disabled:opacity-60"
    >
      <Send className="size-3.5" /> {sending ? "Sending..." : "Send E-mail"}
    </button>
  );
}
