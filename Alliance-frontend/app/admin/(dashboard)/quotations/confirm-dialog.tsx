"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { FileCheck2, ChevronUp, Mail, CheckCircle2 } from "lucide-react";
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
import { downloadQuotationPdf, quotationPdfToBase64 } from "@/app/lib/quotation-pdf";
import { apiFetch, ApiError } from "@/app/lib/api-browser";
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

// Trigger button for the action cell. Rendered separately from the panel
// (below) so the panel can be its own full-width table row rather than
// nesting a <tr> inside the action <td>.
export function ConfirmQuotationTrigger({
  quotation,
  open,
  onToggle,
}: {
  quotation: Quotation;
  open: boolean;
  onToggle: () => void;
}) {
  if (open) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-[#dde3ea] px-2.5 py-1.5 text-[11.5px] font-semibold text-ink-soft transition-colors hover:border-primary hover:text-primary"
      >
        <ChevronUp className="size-3.5" /> Close
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onToggle}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-ok bg-ok-bg px-2.5 py-1.5 text-[11.5px] font-semibold text-ok transition-colors hover:bg-ok hover:text-white"
    >
      <FileCheck2 className="size-3.5" /> {quotation.confirmation ? "Re-issue" : "Accept"}
    </button>
  );
}

// Inline pricing/terms editor for one quotation row, rendered as its own
// full-width <tr> directly under the row. Replaces the old popup dialog —
// the admin fills ref/price/terms inline and clicks "complete quotation and
// send" with no intermediate confirmation step.
export function ConfirmQuotationPanel({
  quotation,
  sequence,
  onClose,
}: {
  quotation: Quotation;
  sequence: number;
  onClose: () => void;
}) {
  const existing = quotation.confirmation;
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

  const [emailing, setEmailing] = useState(false);
  // Set once the email actually lands, so the panel keeps a visible record of
  // the send rather than relying on a toast the admin may have missed.
  const [sentTo, setSentTo] = useState<string | null>(null);

  // toastId lets the caller fold validation failures into an in-progress
  // loading toast instead of stacking a second one beside it.
  async function issueConfirmation(toastId?: string | number) {
    const fail = (message: string) => {
      toast.error(message, toastId ? { id: toastId } : undefined);
      return null;
    };
    if (!refNumber.trim() || !subject.trim()) {
      return fail("Ref number and subject are required.");
    }
    if (!allPriced) {
      return fail("Enter a price for every line before issuing.");
    }
    if (priced.some((l) => l.quantity < 1 || l.value < 0)) {
      return fail("Every line needs a quantity of at least 1 and a non-negative price.");
    }

    try {
      return await apiFetch<Quotation>(
        `/api/admin/quotations/${encodeURIComponent(quotation.id)}/confirm`,
        {
          method: "POST",
          body: {
            refNumber,
            subject,
            issuedDate,
            terms,
            lines: priced.map((l) => ({
              slug: l.slug,
              // name is required by the API: the confirmation snapshots what
              // was offered, so it cannot look the item up later.
              name: l.name,
              partNumber: l.partNumber,
              specifications: l.specifications,
              quantity: l.quantity,
              unit: l.unit,
              unitPrice: l.value,
            })),
          },
        }
      );
    } catch (error) {
      return fail(
        error instanceof ApiError
          ? error.message
          : "Could not issue the order confirmation."
      );
    }
  }

  async function saveOnly() {
    setSubmitting(true);
    try {
      const saved = await issueConfirmation();
      if (!saved) return;
      toast.success(`Order confirmation ${refNumber} issued.`);
      // Deliberately not refreshing the Quotations list here: this
      // quotation no longer matches the Pending tab once issued, so an
      // immediate refresh would drop its row (and this open panel with it)
      // out from under the admin. The list re-syncs when onClose fires —
      // see quotations-client.tsx, where onClose also calls onChanged.
      try {
        await downloadQuotationPdf(saved);
      } catch {
        toast.warning("Confirmation saved, but the PDF could not be generated.");
      }
    } catch {
      toast.error("Could not issue the order confirmation.");
    } finally {
      setSubmitting(false);
    }
  }

  async function saveAndEmail() {
    setEmailing(true);
    // One toast ID, updated in place through each stage — issuing, building
    // the PDF, sending — so the admin sees progress instead of a dead button,
    // and the panel stays open until the send actually resolves.
    const toastId = toast.loading("Issuing confirmation...");
    try {
      const saved = await issueConfirmation(toastId);
      if (!saved) {
        toast.dismiss(toastId);
        return;
      }

      try {
        toast.loading("Preparing the quotation PDF...", { id: toastId });
        // Rendered here, from the same builder the download button uses, and
        // posted with the send. The server can render its own but produces a
        // plainer layout, so letting it do that would mean the customer
        // received a different document from the one the admin saved.
        const { base64, fileName } = await quotationPdfToBase64(saved);

        toast.loading(`Sending to ${saved.details.email}...`, { id: toastId });
        const result = await apiFetch<{ sent: boolean; attached: boolean }>(
          `/api/admin/quotations/${encodeURIComponent(quotation.id)}/email`,
          { method: "POST", body: { pdfBase64: base64, fileName } }
        );
        toast.success("Email sent", {
          id: toastId,
          description: result.attached
            ? `${refNumber} delivered to ${saved.details.email} with the PDF attached.`
            : `${refNumber} delivered to ${saved.details.email}, but the PDF could not be attached.`,
          duration: 8000,
        });
        setSentTo(saved.details.email);
        // Not refreshing the list here either — see the comment in saveOnly.
        // The list re-syncs when the admin closes the panel.
        return;
      } catch (error) {
        // The confirmation is saved either way — say so explicitly, so the
        // admin knows to retry only the email rather than re-issue.
        toast.error(
          error instanceof ApiError ? error.message : "Could not send the email.",
          {
            id: toastId,
            description: `Confirmation ${refNumber} was saved. Use Re-issue to try emailing again.`,
            duration: 7000,
          }
        );
        setSentTo(null);
        return;
      }
    } catch {
      toast.error("Could not issue the order confirmation.", { id: toastId });
    } finally {
      setEmailing(false);
    }
  }

  return (
    <tr className="border-t border-slate-line bg-surface">
      <td colSpan={7} className="p-5">
        <div className="space-y-5">
            <div className="grid gap-3.5 sm:grid-cols-3">
              <div>
                <FieldLabel>REF NUMBER</FieldLabel>
                <Input
                  value={refNumber}
                  onChange={(e) => setRefNumber(e.target.value)}
                  className="bg-white font-mono text-[12.5px]"
                />
              </div>
              <div>
                <FieldLabel>ISSUE DATE</FieldLabel>
                <Input
                  type="date"
                  value={issuedDate}
                  onChange={(e) => setIssuedDate(e.target.value)}
                  className="bg-white text-[12.5px]"
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
                className="bg-white text-[12.5px]"
              />
            </div>

            <div>
              <FieldLabel>LINES &amp; PRICING</FieldLabel>
              <div className="scrollbar-slim overflow-x-auto rounded-[9px] border border-slate-line bg-white">
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
                      className="h-8 bg-white text-[12px]"
                    />
                  </div>
                ))}
              </div>
            </div>

            {sentTo && (
              <div className="flex items-start gap-2.5 rounded-md border border-[#cfe9d4] bg-[#f2fbf4] p-3.5 text-[12.5px] leading-[1.65] text-[#1a6b33]">
                <CheckCircle2 className="mt-px size-4 shrink-0" />
                <span>
                  <strong>Email sent.</strong> Confirmation{" "}
                  <strong className="font-mono">{refNumber}</strong> was delivered to{" "}
                  <strong>{sentTo}</strong> with the quotation PDF attached.
                </span>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-4">
              <p className="text-[11.5px] text-[#8a94a6]">
                {allPriced
                  ? "Issues this confirmation and unlocks the customer's order step."
                  : "Enter a price for every line to issue this confirmation."}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={saveOnly}
                  disabled={submitting || emailing || !allPriced}
                  className="inline-flex items-center gap-2 rounded-[9px] border border-slate-line bg-white px-5 py-2.5 text-[13.5px] font-bold text-ink transition-colors hover:border-primary hover:text-primary disabled:opacity-60"
                >
                  <FileCheck2 className="size-4" />
                  {submitting ? "Saving..." : "Download PDF"}
                </button>
                <button
                  type="button"
                  onClick={saveAndEmail}
                  disabled={submitting || emailing || !allPriced}
                  className="btn-sheen inline-flex items-center gap-2 rounded-[9px] border border-white/40 bg-accent/90 px-5 py-2.5 text-[13.5px] font-bold text-ink transition-all hover:-translate-y-0.5 hover:bg-accent disabled:opacity-60"
                >
                  <Mail className="size-4" />
                  {emailing ? "Sending..." : sentTo ? "Send again" : "Send Email"}
                </button>
                {sentTo && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="inline-flex items-center gap-2 rounded-[9px] border border-slate-line bg-white px-5 py-2.5 text-[13.5px] font-bold text-ink transition-colors hover:border-primary hover:text-primary"
                  >
                    Done
                  </button>
                )}
              </div>
            </div>
        </div>
      </td>
    </tr>
  );
}
