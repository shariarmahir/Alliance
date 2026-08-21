"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { useQuote } from "@/app/lib/quote-context";
import type { QuotationDetails } from "@/app/lib/types";
import { QuoteLineItem } from "@/app/components/quote-line-item";
import { QuotationForm, type QuotationFormValues } from "@/app/components/quotation-form";
import { apiFetch } from "@/app/lib/api-browser";

const QUOTATION_STORAGE_KEY = "autolink_quotation";

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
  const { items, total, updateQty, removeItem, clear } = useQuote();
  const [values, setValues] = useState<QuotationFormValues>(EMPTY_VALUES);
  const [submitting, setSubmitting] = useState(false);
  const totalUnits = items.reduce((sum, item) => sum + item.quantity, 0);

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

    // The admin's own confirmation of this request becomes the order — there
    // is no separate order-confirm step, so the customer is sent straight to
    // a status page keyed by the quotation's own ID.
    try {
      // The backend computes the total itself from its own catalogue prices,
      // so only the lines and the customer's details are sent.
      const created = await apiFetch<{ id: string }>("/api/quotations", {
        method: "POST",
        body: { items, details: quotation },
      });
      clear();
      toast.success("Request sent — an engineer will price it shortly.");
      router.push(`/track/quote/${created.id}`);
    } catch {
      toast.error("We couldn't send your request. Please try again or WhatsApp us.");
      setSubmitting(false);
    }
  }

  if (items.length === 0) {
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
        Confirm quantities and complete your review — an engineer will price your request and follow up
        to arrange delivery.
      </p>

      <ol className="mb-6.5 flex flex-col overflow-hidden rounded-[9px] border border-slate-line bg-surface sm:flex-row">
        {["Ask Price", "Pricing & delivery", "Track delivery"].map((step, i) => (
          <li
            key={step}
            className={`flex flex-1 items-center gap-2.5 px-4.5 py-3.5 text-[13px] ${
              i === 0 ? "bg-white font-semibold text-ink" : "font-medium text-[#8a94a6]"
            } ${i < 2 ? "border-b border-slate-line sm:border-b-0 sm:border-r" : ""}`}
          >
            <span
              className={`flex size-5 shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-bold ${
                i === 0 ? "bg-primary text-white" : "bg-slate-line text-ink-muted"
              }`}
            >
              {i + 1}
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
            {items.map((item) => (
              <QuoteLineItem
                key={item.slug}
                item={item}
                onQtyChange={(qty) => updateQty(item.slug, qty)}
                onRemove={() => removeItem(item.slug)}
              />
            ))}
          </div>

          <QuotationForm values={values} onChange={setValues} />
        </div>

        <div>
          <div className="sticky top-24 overflow-hidden rounded-[10px] border border-slate-line">
            <div className="bg-[#0d1626] px-5 py-4">
              <strong className="text-sm font-semibold text-white">Request summary</strong>
            </div>
            <div className="p-5">
              <div className="flex justify-between border-b border-hairline pb-3 text-[13px] text-ink-muted">
                <span>Lines</span>
                <strong className="font-mono text-ink">{items.length}</strong>
              </div>
              <div className="flex justify-between border-b border-hairline py-3 text-[13px] text-ink-muted">
                <span>Total units</span>
                <strong className="font-mono text-ink">{totalUnits}</strong>
              </div>
              <div className="flex justify-between pb-4 pt-3 text-[13px] text-ink-muted">
                <span>Availability</span>
                <strong className="text-ok">All in stock</strong>
              </div>

              <p className="mb-4 rounded-md border border-tint-line bg-[#f4faff] p-3.5 text-[12.5px] leading-[1.65] text-[#00618f]">
                Pricing is quoted per request. Freight, duty and delivery are arranged with you directly
                once it&apos;s priced.
              </p>
              <button
                type="submit"
                disabled={submitting}
                className="btn-sheen flex w-full items-center justify-center rounded-[9px] border border-white/40 bg-accent/90 px-5 py-3.5 text-[15px] font-bold text-ink shadow-[0_12px_26px_rgba(255,185,0,.3)] transition-all hover:-translate-y-0.5 hover:bg-accent disabled:opacity-60"
              >
                {submitting ? "Sending..." : "Send Quotation"}
              </button>
              <p className="mt-3 text-center text-[11.5px] leading-[1.6] text-[#8a94a6]">
                By sending you accept our terms of trade. No payment is taken at this step.
              </p>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
}
