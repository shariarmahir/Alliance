"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
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
import { apiFetch, ApiError } from "@/app/lib/api-browser";
import type { Quotation } from "@/app/lib/types";

// The ordinary Remove refuses while invoices or challans stand against an
// order, and refuses permanently once those are paid or delivered — receipts
// and delivered goods are facts, and a cancelled document is not where they
// reconcile. That leaves genuinely bad records (a test order, a duplicate, a
// customer that never existed) with no way out.
//
// This is that way out, and it is the only irreversible action in the admin.
// It destroys the quotation, its confirmation, every invoice and challan
// raised against it, their lines, and every recorded receipt.
//
// Two things guard it. The customer's own reference has to be typed, so the
// destroyed order is the one the admin was looking at rather than whichever
// row a stray click landed on — a plain "are you sure" cannot tell those
// apart. And the amounts are shown before the button, because the figure
// leaving the books is the fact most worth seeing first.

export function PurgeOrderDialog({
  quotation,
  disabled,
  onPurged,
}: {
  quotation: Quotation;
  disabled: boolean;
  onPurged: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const confirmation = quotation.confirmation;
  // Falls back to the id for an order confirmed before refs existed, so the
  // dialog never asks the admin to type a blank string.
  const phrase = confirmation?.refNumber || quotation.id;
  const matches = typed.trim() === phrase;

  const invoiced = confirmation?.amountInvoiced ?? 0;
  const received = confirmation?.amountPaid ?? 0;

  async function purge() {
    if (!matches) return;
    setBusy(true);
    try {
      await apiFetch(`/api/admin/quotations/${encodeURIComponent(quotation.id)}`, {
        method: "DELETE",
        body: { reason: reason.trim() },
      });
      toast.success(`${phrase} deleted, with its invoices and challans.`);
      setOpen(false);
      setTyped("");
      setReason("");
      onPurged();
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Could not delete this order.",
        { duration: 8000 }
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // Reset on close: a half-typed reference left behind means the next
        // open starts one keystroke from destroying something.
        if (!next) {
          setTyped("");
          setReason("");
        }
      }}
    >
      <DialogTrigger
        render={
          <button
            type="button"
            disabled={disabled}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-[#7a2f2f]/40 bg-[#fdf3f3] px-2.5 py-1.5 text-[11.5px] font-semibold text-[#7a2f2f] transition-colors hover:border-[#7a2f2f] hover:bg-[#f7e4e4] disabled:opacity-50"
          >
            <Trash2 className="size-3.5" />
            Remove anyway
          </button>
        }
      />
      <DialogContent className="w-full max-w-md sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-[17px] font-bold text-ink">
            Delete this order permanently?
          </DialogTitle>
          <DialogDescription className="text-[12.5px] leading-[1.65] text-ink-muted">
            {quotation.details.companyName} — {quotation.details.fullName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-md border border-[#7a2f2f]/25 bg-[#fdf3f3] p-3">
            <p className="text-[12.5px] font-semibold leading-[1.6] text-[#7a2f2f]">
              This cannot be undone.
            </p>
            <p className="mt-1 text-[12px] leading-[1.65] text-[#7a2f2f]/90">
              The order, its quotation, and every invoice, challan and payment
              receipt raised against it are destroyed.
            </p>
          </div>

          <dl className="space-y-1.5 rounded-md border border-hairline bg-[#fafbfc] p-3 text-[12.5px]">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-ink-muted">Reference</dt>
              <dd className="font-mono text-[11.5px] font-semibold text-ink">{phrase}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-ink-muted">Invoiced</dt>
              <dd className="font-semibold tabular-nums text-ink">৳{invoiced.toFixed(2)}</dd>
            </div>
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-ink-muted">Received</dt>
              <dd className="font-semibold tabular-nums text-ink">৳{received.toFixed(2)}</dd>
            </div>
          </dl>

          {received > 0 && (
            <p className="text-[12px] leading-[1.6] text-[#7a2f2f]">
              ৳{received.toFixed(2)} was recorded as received. It stays on the
              deleted-orders record and in the deleted revenue chart, so the
              money is still accounted for — but the receipts themselves go.
            </p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="purge-reason">Reason (optional)</Label>
            <Input
              id="purge-reason"
              placeholder="e.g. duplicate of AIT/M/Q-0004/2026"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="purge-confirm">
              Type <span className="font-mono text-[11.5px]">{phrase}</span> to confirm
            </Label>
            <Input
              id="purge-confirm"
              autoComplete="off"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
            />
          </div>
        </div>

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
            onClick={purge}
            disabled={!matches || busy}
            className="rounded-md border border-[#7a2f2f] bg-[#7a2f2f] px-4 py-2 text-[12.5px] font-semibold text-white transition-colors hover:bg-[#661f1f] disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? "Deleting..." : "Delete permanently"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
