"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, ArrowRight, ShoppingBag } from "lucide-react";
import { toast } from "sonner";
import { useQuote } from "@/app/lib/quote-context";
import { formatPrice } from "@/app/lib/utils";
import type { QuotationDetails } from "@/app/lib/types";
import { Card } from "@/app/components/ui/card";
import { QuoteLineItem } from "@/app/components/quote-line-item";
import { QuotationForm, type QuotationFormValues } from "@/app/components/quotation-form";

const QUOTATION_STORAGE_KEY = "alliance_quotation";

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
        <h1 className="mt-4 text-2xl font-bold text-slate-900">Your quotation is empty</h1>
        <p className="mt-2 text-slate-500">Add products to request a quotation.</p>
        <Link href="/products" className="btn-glass-accent mt-6">
          Browse Products
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-2 flex items-center gap-3 text-3xl font-extrabold text-slate-900">
        <FileText className="size-8 text-primary" /> Create Quotation
      </h1>
      <p className="mb-8 text-slate-500">
        Review your items and share your details. Our team confirms availability &amp; final pricing
        within one business day.
      </p>

      <form onSubmit={submitQuotation} className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-8">
          <div className="space-y-4">
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
          <Card className="sticky top-24 p-6">
            <h2 className="mb-4 text-lg font-bold">Quotation Summary</h2>
            <div className="mb-4 max-h-56 space-y-2 overflow-auto text-sm">
              {items.map((item) => (
                <div key={item.slug} className="flex justify-between gap-2">
                  <span className="line-clamp-1 text-slate-500">
                    {item.quantity}× {item.partNumber}
                  </span>
                  <span className="font-medium text-slate-900">
                    {formatPrice(item.price * item.quantity)}
                  </span>
                </div>
              ))}
            </div>
            <div className="space-y-2 border-t border-slate-200 pt-3 text-sm">
              <div className="flex justify-between text-base font-extrabold">
                <span>Estimated Total</span>
                <span className="text-primary">{formatPrice(total)}</span>
              </div>
            </div>
            <button type="submit" disabled={submitting} className="btn-glass-accent mt-6 flex w-full items-center justify-center gap-2 disabled:opacity-60">
              {submitting ? "Submitting..." : "Submit Quotation"} <ArrowRight className="size-5" />
            </button>
            <p className="mt-3 text-center text-xs text-slate-500">
              Final pricing confirmed by our team within 1 business day.
            </p>
          </Card>
        </div>
      </form>
    </div>
  );
}
