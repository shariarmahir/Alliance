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
  const { items, total, updateQty, removeItem } = useQuote();
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

    // Fire-and-forget server mirror so admins can review/confirm/cancel this
    // quotation — never blocks navigation to the delivery details step.
    try {
      const res = await fetch("/api/quotations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items, total, details: quotation }),
      });
      if (!res.ok) {
        toast.warning("Quotation submitted, but we couldn't sync it to our records. Our team may follow up manually.");
      }
    } catch {
      toast.warning("Quotation submitted, but we couldn't sync it to our records. Our team may follow up manually.");
    }

    toast.success("Quotation submitted! Choose your delivery details next.");
    router.push("/order/confirm");
  }

  if (items.length === 0) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-24 text-center">
        <ShoppingBag className="size-16 text-slate-300" />
        <h1 className="mt-4 text-2xl font-bold text-slate-900">Your price request list is empty</h1>
        <p className="mt-2 text-slate-500">Add products to ask for a price.</p>
        <Link href="/products" className="btn-glass-accent mt-6">
          Browse Products
        </Link>
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

      {/* Four-step flow indicator: Ask Price → quotation → confirm → track */}
      <ol className="mb-6.5 flex flex-col overflow-hidden rounded-[9px] border border-slate-line bg-surface sm:flex-row">
        {["Ask Price", "Quotation issued", "Confirm order", "Track delivery"].map((step, i) => (
          <li
            key={step}
            className={`flex flex-1 items-center gap-2.5 px-4.5 py-3.5 text-[13px] ${
              i === 0 ? "bg-white font-semibold text-ink" : "font-medium text-[#8a94a6]"
            } ${i < 3 ? "border-b border-slate-line sm:border-b-0 sm:border-r" : ""}`}
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
              <div className="flex justify-between border-b border-hairline py-3 text-[13px] text-ink-muted">
                <span>Availability</span>
                <strong className="text-ok">All in stock</strong>
              </div>
              <div className="flex justify-between pb-4 pt-3 text-[13px] text-ink-muted">
                <span>Quote due</span>
                <strong className="text-ink">within 4 working hours</strong>
              </div>

              <p className="mb-4 rounded-md border border-tint-line bg-[#f4faff] p-3.5 text-[12.5px] leading-[1.65] text-[#00618f]">
                Pricing is quoted per request. Freight, duty and lead time are confirmed on the quotation,
                valid 14 days.
              </p>

              <button
                type="submit"
                disabled={submitting}
                className="btn-sheen flex w-full items-center justify-center rounded-[9px] border border-white/40 bg-accent/90 px-5 py-3.5 text-[15px] font-bold text-ink shadow-[0_12px_26px_rgba(255,185,0,.3)] transition-all hover:-translate-y-0.5 hover:bg-accent disabled:opacity-60"
              >
                {submitting ? "Sending..." : "Send price request"}
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
