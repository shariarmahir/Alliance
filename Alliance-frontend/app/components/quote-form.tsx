"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Product, QuoteRequest } from "@/app/lib/types";
import { formatPrice } from "@/app/lib/utils";
import { saveQuote } from "@/app/lib/quote-store";
import { QuantityStepper } from "@/app/components/quantity-stepper";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";

type FieldErrors = Partial<Record<"name" | "email" | "phone" | "company" | "country", string[]>>;

export function QuoteForm({ product, initialQty }: { product: Product; initialQty: number }) {
  const router = useRouter();
  const [qty, setQty] = useState(initialQty);
  const [submitting, setSubmitting] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [form, setForm] = useState({ name: "", email: "", phone: "", company: "", country: "" });

  function updateField(key: keyof typeof form, value: string) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldErrors({});

    if (!form.name || !form.email || !form.phone || !form.company || !form.country) {
      toast.error("Please fill in all required fields.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productSlug: product.slug,
          quantity: qty,
          ...form,
        }),
      });

      if (res.status === 201) {
        const quote = (await res.json()) as QuoteRequest;
        saveQuote(quote);
        router.push(`/order/confirm?quoteId=${quote.id}`);
        return;
      }

      if (res.status === 400) {
        const data = await res.json();
        setFieldErrors(data.fields ?? {});
        toast.error("Please correct the highlighted fields.");
        return;
      }

      toast.error("Something went wrong submitting your quote. Please try again.");
    } catch {
      toast.error("Network error — please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const total = product.price * qty;

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-8">
      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase text-primary">{product.brand}</p>
            <p className="font-semibold text-slate-900">{product.partNumber}</p>
            <p className="text-sm text-slate-600">{product.name}</p>
          </div>
          <p className="text-lg font-bold text-slate-900">{formatPrice(product.price)} / unit</p>
        </div>
        <div className="flex items-center justify-between border-t border-slate-100 pt-4">
          <div>
            <p className="mb-2 text-sm font-medium text-slate-700">Quantity</p>
            <QuantityStepper initial={initialQty} onChange={setQty} />
          </div>
          <div className="text-right">
            <p className="text-sm text-slate-500">Estimated Total</p>
            <p className="text-2xl font-bold text-primary">{formatPrice(total)}</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-bold text-slate-900">Your Information</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="q-name">Full Name</Label>
            <Input id="q-name" required value={form.name} onChange={(e) => updateField("name", e.target.value)} />
            {fieldErrors.name && <p className="text-xs text-red-600">{fieldErrors.name[0]}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="q-email">Email</Label>
            <Input id="q-email" type="email" required value={form.email} onChange={(e) => updateField("email", e.target.value)} />
            {fieldErrors.email && <p className="text-xs text-red-600">{fieldErrors.email[0]}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="q-phone">Phone</Label>
            <Input id="q-phone" required value={form.phone} onChange={(e) => updateField("phone", e.target.value)} />
            {fieldErrors.phone && <p className="text-xs text-red-600">{fieldErrors.phone[0]}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="q-company">Company</Label>
            <Input id="q-company" required value={form.company} onChange={(e) => updateField("company", e.target.value)} />
            {fieldErrors.company && <p className="text-xs text-red-600">{fieldErrors.company[0]}</p>}
          </div>
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="q-country">Country</Label>
            <Input id="q-country" required value={form.country} onChange={(e) => updateField("country", e.target.value)} />
            {fieldErrors.country && <p className="text-xs text-red-600">{fieldErrors.country[0]}</p>}
          </div>
        </div>
      </div>

      <button type="submit" disabled={submitting} className="btn-glass-accent disabled:opacity-60">
        {submitting ? "Submitting..." : "Submit Quotation Request"}
      </button>
    </form>
  );
}
