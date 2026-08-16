"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShoppingBag, Clock, Download, CheckCircle2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useQuote } from "@/app/lib/quote-context";
import type { Quotation, QuotationDetails } from "@/app/lib/types";
import { QuoteLineItem } from "@/app/components/quote-line-item";
import { QuotationForm, type QuotationFormValues } from "@/app/components/quotation-form";
import { downloadQuotationPdf } from "@/app/lib/quotation-pdf";
import { formatPrice } from "@/app/lib/utils";

const QUOTATION_STORAGE_KEY = "autolink_quotation";
// The submitted quotation's server ID — the only handle the customer has on
// their request, since there are no customer accounts.
const TRACKED_QUOTATION_KEY = "autolink_quotation_id";

const EMPTY_VALUES: QuotationFormValues = {
  fullName: "",
  email: "",
  phone: "",
  jobTitle: "",
  companyName: "",
  country: "",
  taxId: "",
  companyWebsite: "",
  preferredContact: "email",
  leadTime: "standard",
  notes: "",
};

export default function QuotePage() {
  const router = useRouter();
  const { items, total, updateQty, removeItem } = useQuote();
  const [values, setValues] = useState<QuotationFormValues>(EMPTY_VALUES);
  const [submitting, setSubmitting] = useState(false);
  const [tracked, setTracked] = useState<Quotation | null>(null);
  const [loadingTracked, setLoadingTracked] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const totalUnits = items.reduce((sum, item) => sum + item.quantity, 0);

  // On load, ask the server what happened to the last request this browser
  // sent. A 404 means the record is gone (data reset) — drop the stale ID so
  // the customer isn't stuck looking at a request that no longer exists.
  const refreshTracked = useCallback(async () => {
    let id: string | null = null;
    try {
      id = localStorage.getItem(TRACKED_QUOTATION_KEY);
    } catch {
      // storage unavailable — treat as no request in flight
    }
    if (!id) return null;
    try {
      const res = await fetch(`/api/quotations/${id}`);
      if (res.status === 404) {
        // Record is gone (data reset) — drop the stale ID so the customer
        // isn't stuck waiting on a request that no longer exists.
        localStorage.removeItem(TRACKED_QUOTATION_KEY);
        return null;
      }
      if (res.ok) {
        const data = await res.json();
        return (data.quotation as Quotation | undefined) ?? null;
      }
    } catch {
      // offline — caller keeps whatever state it already had
    }
    return null;
  }, []);

  useEffect(() => {
    let cancelled = false;
    refreshTracked().then((q) => {
      if (cancelled) return;
      setTracked(q);
      setLoadingTracked(false);
    });
    return () => {
      cancelled = true;
    };
  }, [refreshTracked]);

  async function submitQuotation(e: React.FormEvent) {
    e.preventDefault();

    if (!values.fullName || !values.email || !values.phone || !values.companyName || !values.country) {
      toast.error("Please fill in all required fields.");
      return;
    }

    setSubmitting(true);

    const quotation: QuotationDetails = { ...values, submittedAt: new Date().toISOString() };
    try {
      sessionStorage.setItem(QUOTATION_STORAGE_KEY, JSON.stringify(quotation));
    } catch {
      // storage unavailable — proceed anyway, confirm page just won't prefill
    }

    // Unlike the old flow, this no longer navigates onward: the request now
    // waits for a super admin to review it and issue an order confirmation.
    try {
      const res = await fetch("/api/quotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, total, details: quotation }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.quotation) {
        toast.error("We couldn't send your request. Please try again or WhatsApp us.");
        setSubmitting(false);
        return;
      }
      try {
        localStorage.setItem(TRACKED_QUOTATION_KEY, data.quotation.id);
      } catch {
        // storage unavailable — the request is recorded, the customer just
        // won't see live status on this device
      }
      setTracked(data.quotation);
      toast.success("Request sent. Our engineers will review and price it.");
    } catch {
      toast.error("We couldn't send your request. Please try again or WhatsApp us.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDownload() {
    if (!tracked?.confirmation) return;
    setDownloading(true);
    try {
      await downloadQuotationPdf(tracked);
    } catch {
      toast.error("Could not generate the PDF. Please try again.");
    } finally {
      setDownloading(false);
    }
  }

  function startNewRequest() {
    try {
      localStorage.removeItem(TRACKED_QUOTATION_KEY);
    } catch {
      // nothing to clear
    }
    setTracked(null);
  }

  // Once a request is in flight the page shows what was actually submitted,
  // frozen — editing the cart afterwards must not appear to change a request
  // the engineers are already pricing.
  const locked = tracked !== null && tracked.status !== "cancelled";
  const displayItems = locked ? tracked.items : items;
  const displayUnits = locked
    ? tracked.items.reduce((sum, i) => sum + i.quantity, 0)
    : totalUnits;
  const confirmed = tracked?.status === "confirmed" && !!tracked.confirmation;
  const activeStep = confirmed ? 2 : tracked?.status === "pending" ? 1 : 0;

  if (items.length === 0 && !tracked) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center px-7 py-24 text-center">
        <ShoppingBag className="size-16 text-[#c8d0da]" />
        <h1 className="mt-4 text-2xl font-bold tracking-[-0.02em] text-ink">
          Your price request list is empty
        </h1>
        <p className="mt-2 max-w-md text-[13.5px] leading-[1.7] text-ink-muted">
          Find a part in the catalogue and choose <strong className="text-ink">Ask Price</strong> — add as
          many lines as you need, then send them as one request.
        </p>
        <Link
          href="/products"
          className="btn-sheen mt-6 inline-flex items-center justify-center rounded-[9px] border border-white/40 bg-accent/90 px-6 py-3.5 text-[15px] font-bold text-ink shadow-[0_12px_26px_rgba(255,185,0,.3)] transition-all hover:-translate-y-0.5 hover:bg-accent"
        >
          Browse the catalogue
        </Link>
        <p className="mt-5 text-xs text-[#8a94a6]">
          Know the part number already? WhatsApp{" "}
          <a
            href="https://wa.me/8801713116019"
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono font-semibold text-primary hover:underline"
          >
            +8801713-116019
          </a>
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1360px] px-8 py-6.5">
      <div className="mb-1 flex items-center gap-3">
        <h1 className="text-2xl font-bold tracking-[-0.02em] text-ink sm:text-[27px]">Ask Price</h1>
        <span className="rounded-[5px] bg-tint px-2.5 py-1 font-mono text-[11px] font-semibold text-[#00618f]">
          {items.length} {items.length === 1 ? "LINE" : "LINES"}
        </span>
      </div>
      <p className="mb-5.5 text-[13.5px] text-ink-muted">
        Confirm quantities, tell us where it ships, and an engineer returns a firm quotation within four
        working hours.
      </p>

      {/* Four-step flow indicator — the active step tracks the real server-side
          state of the request, not just "you're on this page". */}
      <ol className="mb-6.5 flex flex-col overflow-hidden rounded-[9px] border border-slate-line bg-surface sm:flex-row">
        {["Ask Price", "Quotation issued", "Confirm order", "Track delivery"].map((step, i) => (
          <li
            key={step}
            className={`flex flex-1 items-center gap-2.5 px-4.5 py-3.5 text-[13px] ${
              i === activeStep ? "bg-white font-semibold text-ink" : "font-medium text-[#8a94a6]"
            } ${i < 3 ? "border-b border-slate-line sm:border-b-0 sm:border-r" : ""}`}
          >
            <span
              className={`flex size-5 shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-bold ${
                i < activeStep
                  ? "bg-ok text-white"
                  : i === activeStep
                    ? "bg-primary text-white"
                    : "bg-slate-line text-ink-muted"
              }`}
            >
              {i < activeStep ? "✓" : i + 1}
            </span>
            {step}
          </li>
        ))}
      </ol>

      <form onSubmit={submitQuotation} className="grid gap-7 lg:grid-cols-[1fr_470px]">
        <div className="space-y-8">
          <div className="overflow-hidden rounded-[10px] border border-slate-line">
            <div className="hidden grid-cols-[1fr_150px_40px] gap-4 border-b border-slate-line bg-surface px-4.5 py-3 sm:grid">
              <span className="mono-label text-[10.5px] tracking-[0.07em] text-[#8a94a6]">PART</span>
              <span className="mono-label text-[10.5px] tracking-[0.07em] text-[#8a94a6]">QUANTITY</span>
              <span />
            </div>
            {displayItems.map((item) => (
              <QuoteLineItem
                key={item.slug}
                item={item}
                readOnly={locked}
                onQtyChange={(qty) => updateQty(item.slug, qty)}
                onRemove={() => removeItem(item.slug)}
              />
            ))}
          </div>

          {!locked && <QuotationForm values={values} onChange={setValues} />}
        </div>

        <div>
          <div className="sticky top-24 overflow-hidden rounded-[10px] border border-slate-line">
            <div className="bg-[#0d1626] px-5 py-4">
              <strong className="text-sm font-semibold text-white">Request summary</strong>
            </div>
            <div className="p-5">
              <div className="flex justify-between border-b border-hairline pb-3 text-[13px] text-ink-muted">
                <span>Lines</span>
                <strong className="font-mono text-ink">{displayItems.length}</strong>
              </div>
              <div className="flex justify-between border-b border-hairline py-3 text-[13px] text-ink-muted">
                <span>Total units</span>
                <strong className="font-mono text-ink">{displayUnits}</strong>
              </div>
              <div className="flex justify-between border-b border-hairline py-3 text-[13px] text-ink-muted">
                <span>Availability</span>
                <strong className="text-ok">All in stock</strong>
              </div>
              {confirmed ? (
                <div className="flex justify-between pb-4 pt-3 text-[13px] text-ink-muted">
                  <span>Quoted total</span>
                  <strong className="font-mono text-ink">
                    {formatPrice(tracked.confirmation!.grandTotal)}
                  </strong>
                </div>
              ) : (
                <div className="flex justify-between pb-4 pt-3 text-[13px] text-ink-muted">
                  <span>Quote due</span>
                  <strong className="text-ink">within 4 working hours</strong>
                </div>
              )}

              {confirmed ? (
                <>
                  <p className="mb-4 flex items-start gap-2 rounded-md border border-[#cfe9d4] bg-[#f2fbf4] p-3.5 text-[12.5px] leading-[1.65] text-[#1a6b33]">
                    <CheckCircle2 className="mt-px size-4 shrink-0" />
                    <span>
                      Your quotation is approved. Ref{" "}
                      <strong className="font-mono">{tracked.confirmation!.refNumber}</strong> — download
                      the confirmation, then proceed to place the order.
                    </span>
                  </p>
                  <button
                    type="button"
                    onClick={() => router.push("/order/confirm")}
                    className="btn-sheen flex w-full items-center justify-center rounded-[9px] border border-white/40 bg-accent/90 px-5 py-3.5 text-[15px] font-bold text-ink shadow-[0_12px_26px_rgba(255,185,0,.3)] transition-all hover:-translate-y-0.5 hover:bg-accent"
                  >
                    Proceed order
                  </button>
                  <button
                    type="button"
                    onClick={handleDownload}
                    disabled={downloading}
                    className="mt-2.5 flex w-full items-center justify-center gap-2 rounded-[9px] border-[1.5px] border-primary bg-primary/[0.06] px-5 py-3 text-[13.5px] font-semibold text-primary transition-colors hover:bg-primary/[0.12] disabled:opacity-60"
                  >
                    <Download className="size-4" />
                    {downloading ? "Preparing..." : "Download order confirmation"}
                  </button>
                </>
              ) : tracked?.status === "cancelled" ? (
                <>
                  <p className="mb-4 flex items-start gap-2 rounded-md border border-[#f6cfcf] bg-[#fef6f6] p-3.5 text-[12.5px] leading-[1.65] text-[#7a2f2f]">
                    <XCircle className="mt-px size-4 shrink-0" />
                    <span>
                      This request was declined. Contact our engineers on WhatsApp, or send a new request.
                    </span>
                  </p>
                  <button
                    type="button"
                    onClick={startNewRequest}
                    className="flex w-full items-center justify-center rounded-[9px] border-[1.5px] border-primary bg-primary/[0.06] px-5 py-3.5 text-[14px] font-semibold text-primary transition-colors hover:bg-primary/[0.12]"
                  >
                    Start a new request
                  </button>
                </>
              ) : locked ? (
                <>
                  <p className="mb-4 flex items-start gap-2 rounded-md border border-tint-line bg-[#f4faff] p-3.5 text-[12.5px] leading-[1.65] text-[#00618f]">
                    <Clock className="mt-px size-4 shrink-0" />
                    <span>
                      An engineer is reviewing and pricing your request. You&apos;ll be able to download
                      the order confirmation here once it&apos;s approved.
                    </span>
                  </p>
                  <button
                    type="button"
                    disabled
                    className="flex w-full cursor-default items-center justify-center gap-2 rounded-[9px] border border-slate-line bg-surface px-5 py-3.5 text-[15px] font-bold text-ink-muted"
                  >
                    <Clock className="size-4" /> Request Sent
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const q = await refreshTracked();
                      setTracked(q);
                      toast.info(
                        q?.status === "confirmed"
                          ? "Your quotation has been approved."
                          : "Still under review — we'll have it priced shortly."
                      );
                    }}
                    className="mt-2.5 w-full text-center text-[12px] font-semibold text-primary hover:underline"
                  >
                    Check for an update
                  </button>
                </>
              ) : (
                <>
                  <p className="mb-4 rounded-md border border-tint-line bg-[#f4faff] p-3.5 text-[12.5px] leading-[1.65] text-[#00618f]">
                    Pricing is quoted per request. Freight, duty and lead time are confirmed on the
                    quotation, valid 14 days.
                  </p>
                  <button
                    type="submit"
                    disabled={submitting || loadingTracked}
                    className="btn-sheen flex w-full items-center justify-center rounded-[9px] border border-white/40 bg-accent/90 px-5 py-3.5 text-[15px] font-bold text-ink shadow-[0_12px_26px_rgba(255,185,0,.3)] transition-all hover:-translate-y-0.5 hover:bg-accent disabled:opacity-60"
                  >
                    {submitting ? "Sending..." : "Send quotation"}
                  </button>
                  <p className="mt-3 text-center text-[11.5px] leading-[1.6] text-[#8a94a6]">
                    By sending you accept our terms of trade. No payment is taken at this step.
                  </p>
                </>
              )}
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
