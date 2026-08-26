"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  FileCheck2,
  FilePlus2,
  Pencil,
  ChevronUp,
  Mail,
  CheckCircle2,
  Upload,
} from "lucide-react";
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
import { apiFetch, apiUpload, ApiError } from "@/app/lib/api-browser";
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
  // The label names the stage's own next step, per the client's workflow:
  // an untouched request is Prepared, a prepared one is Edited, and a
  // submitted one is Confirmed as an order. One button labelled "Accept"
  // everywhere is what made Inbox jump straight to Order Confirmed.
  const { label, Icon, accent } =
    quotation.status === "inbox"
      ? { label: "Prepare", Icon: FilePlus2, accent: "primary" as const }
      : quotation.status === "submitted"
        ? { label: "Confirm Order", Icon: FileCheck2, accent: "ok" as const }
        : { label: "Edit", Icon: Pencil, accent: "muted" as const };

  const style =
    accent === "ok"
      ? "border-ok bg-ok-bg text-ok hover:bg-ok hover:text-white"
      : accent === "primary"
        ? "border-primary bg-[#eaf4fb] text-primary hover:bg-primary hover:text-white"
        : "border-[#dde3ea] text-ink-soft hover:border-primary hover:text-primary";

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`inline-flex shrink-0 items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11.5px] font-semibold transition-colors ${style}`}
    >
      <Icon className="size-3.5" /> {label}
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
  const router = useRouter();
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
  const [confirming, setConfirming] = useState(false);
  const [savingPo, setSavingPo] = useState(false);
  const [poNumber, setPoNumber] = useState(quotation.poNumber ?? "");
  const [poFile, setPoFile] = useState<File | null>(null);
  // Every footer action writes the same record, so one running action locks
  // them all rather than letting two overlapping saves race each other.
  const busyAny = submitting || emailing || confirming || savingPo;
  // Set once the email actually lands, so the panel keeps a visible record of
  // the send rather than relying on a toast the admin may have missed.
  const [sentTo, setSentTo] = useState<string | null>(null);

  // Saves the priced offer. `confirm` decides whether that also accepts the
  // quotation: producing the PDF or emailing it leaves the request pending,
  // because sending someone a quotation is not the same as agreeing to it.
  // Only the Confirm button passes true.
  // toastId lets the caller fold validation failures into an in-progress
  // loading toast instead of stacking a second one beside it.
  async function issueConfirmation(confirm: boolean, toastId?: string | number) {
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
            confirm,
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
      const saved = await issueConfirmation(false);
      if (!saved) return;
      toast.success(`Quotation ${refNumber} saved.`, {
        description: "Marked PDF downloaded — use Confirm to accept it as an order.",
      });
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
      const saved = await issueConfirmation(false, toastId);
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

  // Number and file travel together when both are present, but either alone
  // is valid: the PO number usually arrives by email before the signed
  // document follows.
  async function saveWorkOrder() {
    setSavingPo(true);
    try {
      if (poFile) {
        const form = new FormData();
        form.set("file", poFile);
        form.set("poNumber", poNumber.trim());
        await apiUpload(
          `/api/admin/quotations/${encodeURIComponent(quotation.id)}/work-order`,
          form
        );
      } else {
        await apiFetch(
          `/api/admin/quotations/${encodeURIComponent(quotation.id)}/work-order`,
          { method: "PATCH", body: { poNumber: poNumber.trim() } }
        );
      }
      toast.success("Work order saved.");
      setPoFile(null);
      // Refresh rather than close: the admin almost always confirms the
      // order immediately after filing the PO, so the panel stays put.
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Could not save the work order."
      );
    } finally {
      setSavingPo(false);
    }
  }

  // Accepting the quotation: saves whatever is on screen and flips it to
  // confirmed, which is what moves it onto the Orders screen. Closes the
  // panel, since there is nothing left to do here afterwards.
  async function confirmOffer() {
    setConfirming(true);
    try {
      const saved = await issueConfirmation(true);
      if (!saved) return;
      toast.success(`Quotation ${refNumber} confirmed.`, {
        description: "It now appears under Orders.",
      });
      onClose();
    } catch {
      toast.error("Could not confirm this quotation.");
    } finally {
      setConfirming(false);
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

            {/* The customer's own paperwork. Sits directly above Confirm
                because the PO is what authorises accepting the order, and
                filing it after the fact is how it gets forgotten. */}
            <div className="rounded-[10px] border border-slate-line bg-white p-4">
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <p className="text-[13px] font-bold text-ink">Customer Work Order / PO</p>
                {quotation.poUploadedAt && (
                  <span className="font-mono text-[11px] text-ok">
                    Attached {new Date(quotation.poUploadedAt).toLocaleDateString("en-GB")}
                  </span>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <div>
                  <FieldLabel>PO NUMBER</FieldLabel>
                  <Input
                    value={poNumber}
                    onChange={(e) => setPoNumber(e.target.value)}
                    placeholder="e.g. PO-8891"
                  />
                </div>
                <div>
                  <FieldLabel>DOCUMENT</FieldLabel>
                  <Input
                    type="file"
                    accept=".pdf,image/jpeg,image/png,image/webp"
                    onChange={(e) => setPoFile(e.target.files?.[0] ?? null)}
                  />
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={saveWorkOrder}
                  disabled={busyAny || (!poFile && !poNumber.trim())}
                  className="inline-flex items-center gap-2 rounded-[9px] border border-slate-line bg-white px-4 py-2 text-[12.5px] font-bold text-ink transition-colors hover:border-primary hover:text-primary disabled:opacity-60"
                >
                  <Upload className="size-3.5" />
                  {savingPo ? "Saving..." : "Save Work Order"}
                </button>
                {quotation.poDocumentUrl && (
                  <a
                    href={quotation.poDocumentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[12px] font-semibold text-primary hover:underline"
                  >
                    View attached document
                  </a>
                )}
              </div>
            </div>

            {/* Footer actions follow the stage, matching the row buttons.
                Confirm is deliberately absent from Inbox: the workflow is
                prepare, send, then accept, and offering all three at once
                is what let the middle two stages be skipped entirely. */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-4">
              <p className="text-[11.5px] text-[#8a94a6]">
                {!allPriced
                  ? "Enter a price for every line to issue this quotation."
                  : quotation.status === "inbox"
                    ? "Save moves this to Pending, ready to send to the customer."
                    : quotation.status === "submitted"
                      ? "Already sent. Confirm accepts it as an order."
                      : "Send the quotation to move it to Submitted."}
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={saveOnly}
                  disabled={busyAny || !allPriced}
                  className="inline-flex items-center gap-2 rounded-[9px] border border-slate-line bg-white px-5 py-2.5 text-[13.5px] font-bold text-ink transition-colors hover:border-primary hover:text-primary disabled:opacity-60"
                >
                  <FileCheck2 className="size-4" />
                  {submitting
                    ? "Saving..."
                    : quotation.status === "inbox"
                      ? "Save to Pending"
                      : "Save & Download PDF"}
                </button>
                {quotation.status !== "inbox" && (
                  <button
                    type="button"
                    onClick={saveAndEmail}
                    disabled={busyAny || !allPriced}
                    className="inline-flex items-center gap-2 rounded-[9px] border border-slate-line bg-white px-5 py-2.5 text-[13.5px] font-bold text-ink transition-colors hover:border-primary hover:text-primary disabled:opacity-60"
                  >
                    <Mail className="size-4" />
                    {emailing ? "Sending..." : sentTo ? "Send again" : "Send Email"}
                  </button>
                )}
                {quotation.status !== "inbox" && (
                  <button
                    type="button"
                    onClick={confirmOffer}
                    disabled={busyAny || !allPriced}
                    className="btn-sheen inline-flex items-center gap-2 rounded-[9px] border border-white/40 bg-accent/90 px-5 py-2.5 text-[13.5px] font-bold text-ink transition-all hover:-translate-y-0.5 hover:bg-accent disabled:opacity-60"
                  >
                    <CheckCircle2 className="size-4" />
                    {confirming ? "Confirming..." : "Confirm Order"}
                  </button>
                )}
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
