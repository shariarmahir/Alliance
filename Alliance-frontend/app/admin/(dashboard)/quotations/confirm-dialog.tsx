"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { FileCheck2, Download } from "lucide-react";
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
import {
  DEFAULT_TERMS,
  UNIT_OPTIONS,
  defaultSubject,
  generateRefNumber,
} from "@/app/lib/order-confirmation";
import { downloadQuotationPdf } from "@/app/lib/quotation-pdf";
import type { Quotation, QuotationTerms } from "@/app/lib/types";

// Editable per-line state. Product IDs are deliberately absent — the server
// generates them on submit so they can't be forged or duplicated.
type LineDraft = {
  slug: string;
  name: string;
  partNumber: string;
  specifications: string;
  quantity: number;
  unit: string;
  // Empty until the admin types a figure. Held as a string, not a number, so
  // an unpriced line stays visibly blank instead of showing a placeholder 0
  // that could be issued by accident.
  unitPrice: string;
};

const TERM_FIELDS: { key: keyof QuotationTerms; label: string }[] = [
  { key: "payment", label: "Payment" },
  { key: "delivery", label: "Delivery" },
  { key: "offerValidity", label: "Offer Validity" },
  { key: "vatAit", label: "VAT/AIT" },
  { key: "stock", label: "Stock" },
  { key: "installationCharge", label: "Installation Charge" },
  { key: "warranty", label: "Warranty" },
];

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <Label className="mono-label mb-1.5 block text-[10px] tracking-[0.06em] text-ink-muted">
      {children}
    </Label>
  );
}

export function ConfirmQuotationDialog({
  quotation,
  sequence,
  onConfirmed,
}: {
  quotation: Quotation;
  sequence: number;
  onConfirmed: () => void;
}) {
  const existing = quotation.confirmation;
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [refNumber, setRefNumber] = useState(
    existing?.refNumber ??
      generateRefNumber(quotation.details.companyName, sequence, new Date())
  );
  const [subject, setSubject] = useState(existing?.subject ?? defaultSubject(quotation));
  const [issuedDate, setIssuedDate] = useState(existing?.issuedDate ?? todayIso());
  const [terms, setTerms] = useState<QuotationTerms>(existing?.terms ?? DEFAULT_TERMS);
  const [lines, setLines] = useState<LineDraft[]>(() =>
    quotation.items.map((item) => {
      const prior = existing?.lines.find((l) => l.slug === item.slug);
      return {
        slug: item.slug,
        name: item.name,
        partNumber: item.partNumber,
        specifications: prior?.specifications ?? item.partNumber,
        quantity: prior?.quantity ?? item.quantity,
        unit: prior?.unit ?? "Pcs",
        // Deliberately NOT seeded from the catalogue: pricing is negotiated
        // per quotation, so the admin enters every figure. Re-issuing an
        // existing confirmation keeps what was previously quoted.
        unitPrice: prior ? String(prior.unitPrice) : "",
      };
    })
  );

  const priced = lines.map((l) => ({ ...l, value: Number(l.unitPrice) }));
  const allPriced = priced.every((l) => l.unitPrice.trim() !== "" && Number.isFinite(l.value));
  const grandTotal = useMemo(
    () =>
      lines.reduce((sum, l) => {
        const v = Number(l.unitPrice);
        return sum + (Number.isFinite(v) ? l.quantity * v : 0);
      }, 0),
    [lines]
  );

  function updateLine(slug: string, patch: Partial<LineDraft>) {
    setLines((prev) => prev.map((l) => (l.slug === slug ? { ...l, ...patch } : l)));
  }

  async function submit() {
    if (!refNumber.trim() || !subject.trim()) {
      toast.error("Ref number and subject are required.");
      return;
    }
    if (!allPriced) {
      toast.error("Enter a price for every line before issuing.");
      return;
    }
    if (priced.some((l) => l.quantity < 1 || l.value < 0)) {
      toast.error("Every line needs a quantity of at least 1 and a non-negative price.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/quotations/${quotation.id}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          refNumber,
          subject,
          issuedDate,
          terms,
          lines: priced.map((l) => ({
            slug: l.slug,
            specifications: l.specifications,
            quantity: l.quantity,
            unit: l.unit,
            unitPrice: l.value,
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast.error(data.error ?? "Could not issue the order confirmation.");
        return;
      }
      toast.success(`Order confirmation ${refNumber} issued.`);
      setOpen(false);
      onConfirmed();
      // Hand the admin the document they just issued.
      if (data.quotation) {
        try {
          await downloadQuotationPdf(data.quotation);
        } catch {
          toast.warning("Confirmation saved, but the PDF could not be generated.");
        }
      }
    } catch {
      toast.error("Could not issue the order confirmation.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button
            type="button"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-ok bg-ok-bg px-2.5 py-1.5 text-[11.5px] font-semibold text-ok transition-colors hover:bg-ok hover:text-white"
          >
            <FileCheck2 className="size-3.5" /> {existing ? "Re-issue" : "Confirm"}
          </button>
        }
      />
      <DialogContent className="max-h-[88vh] w-full max-w-4xl overflow-y-auto sm:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="text-[17px] font-bold text-ink">
            Issue order confirmation
          </DialogTitle>
          <DialogDescription className="text-[12.5px] text-ink-muted">
            Set the price and date for each line. Product IDs and the tracking number are generated
            automatically when you issue this.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="grid gap-3.5 sm:grid-cols-3">
            <div>
              <FieldLabel>REF NUMBER</FieldLabel>
              <Input
                value={refNumber}
                onChange={(e) => setRefNumber(e.target.value)}
                className="font-mono text-[12.5px]"
              />
            </div>
            <div>
              <FieldLabel>ISSUE DATE</FieldLabel>
              <Input
                type="date"
                value={issuedDate}
                onChange={(e) => setIssuedDate(e.target.value)}
                className="text-[12.5px]"
              />
            </div>
            <div>
              <FieldLabel>CUSTOMER</FieldLabel>
              <p className="truncate pt-2 text-[12.5px] font-semibold text-ink">
                {quotation.details.companyName}
              </p>
            </div>
          </div>

          <div>
            <FieldLabel>SUBJECT</FieldLabel>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="text-[12.5px]"
            />
          </div>

          <div>
            <FieldLabel>LINES &amp; PRICING</FieldLabel>
            <div className="scrollbar-slim overflow-x-auto rounded-[9px] border border-slate-line">
              <table className="w-full min-w-180 text-[12.5px]">
                <thead className="bg-surface">
                  <tr>
                    <th className="mono-label px-3 py-2 text-left text-[10px] text-[#8a94a6]">ITEM</th>
                    <th className="mono-label px-3 py-2 text-left text-[10px] text-[#8a94a6]">
                      SPECIFICATIONS
                    </th>
                    <th className="mono-label px-3 py-2 text-left text-[10px] text-[#8a94a6]">QTY</th>
                    <th className="mono-label px-3 py-2 text-left text-[10px] text-[#8a94a6]">UNIT</th>
                    <th className="mono-label px-3 py-2 text-left text-[10px] text-[#8a94a6]">
                      UNIT PRICE
                    </th>
                    <th className="mono-label px-3 py-2 text-right text-[10px] text-[#8a94a6]">TOTAL</th>
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => (
                    <tr key={line.slug} className="border-t border-[#f2f4f7]">
                      <td className="px-3 py-2.5">
                        <span className="block max-w-37.5 truncate font-semibold text-ink">
                          {line.name}
                        </span>
                        <span className="block font-mono text-[10.5px] text-[#8a94a6]">
                          {line.partNumber}
                        </span>
                      </td>
                      <td className="px-3 py-2.5">
                        <Input
                          value={line.specifications}
                          onChange={(e) =>
                            updateLine(line.slug, { specifications: e.target.value })
                          }
                          className="h-8 min-w-37.5 text-[12px]"
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <Input
                          type="number"
                          min={1}
                          value={line.quantity}
                          onChange={(e) =>
                            updateLine(line.slug, { quantity: Number(e.target.value) || 1 })
                          }
                          className="h-8 w-16 text-[12px]"
                        />
                      </td>
                      <td className="px-3 py-2.5">
                        <Select
                          value={line.unit}
                          onValueChange={(v) => updateLine(line.slug, { unit: v ?? "Pcs" })}
                        >
                          <SelectTrigger className="h-8 w-20 text-[12px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {UNIT_OPTIONS.map((u) => (
                              <SelectItem key={u} value={u}>
                                {u}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-3 py-2.5">
                        <Input
                          type="number"
                          min={0}
                          step="0.01"
                          placeholder="Enter price"
                          value={line.unitPrice}
                          onChange={(e) => updateLine(line.slug, { unitPrice: e.target.value })}
                          className="h-8 w-28 font-mono text-[12px]"
                        />
                      </td>
                      <td className="px-3 py-2.5 text-right font-mono font-semibold text-ink">
                        {line.unitPrice.trim() === "" || !Number.isFinite(Number(line.unitPrice)) ? (
                          <span className="text-[#c8d0da]">—</span>
                        ) : (
                          formatPrice(line.quantity * Number(line.unitPrice))
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-slate-line bg-surface">
                    <td colSpan={5} className="px-3 py-2.5 text-right font-semibold text-ink">
                      Grand total
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-[13.5px] font-bold text-ink">
                      {allPriced ? formatPrice(grandTotal) : <span className="text-[#c8d0da]">—</span>}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          <div>
            <FieldLabel>TERMS &amp; CONDITIONS</FieldLabel>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {TERM_FIELDS.map(({ key, label }) => (
                <div key={key} className="flex items-center gap-2">
                  <span className="w-32 shrink-0 text-[11.5px] font-semibold text-ink-soft">
                    {label}
                  </span>
                  <Input
                    value={terms[key]}
                    onChange={(e) => setTerms({ ...terms, [key]: e.target.value })}
                    className="h-8 text-[12px]"
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-4">
            <p className="text-[11.5px] text-[#8a94a6]">
              {allPriced
                ? "Issuing sends this to the customer and unlocks their order step."
                : "Enter a price for every line to issue this confirmation."}
            </p>
            <button
              type="button"
              onClick={submit}
              disabled={submitting || !allPriced}
              className="btn-sheen inline-flex items-center gap-2 rounded-[9px] border border-white/40 bg-accent/90 px-5 py-2.5 text-[13.5px] font-bold text-ink transition-all hover:-translate-y-0.5 hover:bg-accent disabled:opacity-60"
            >
              <Download className="size-4" />
              {submitting ? "Issuing..." : "Issue & download PDF"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
