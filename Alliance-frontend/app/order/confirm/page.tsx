"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { loadQuote, saveOrder } from "@/app/lib/quote-store";
import { getProductBySlug } from "@/app/lib/mock-data";
import { formatPrice } from "@/app/lib/utils";
import { DeliveryOptions } from "@/app/components/delivery-options";
import type { DeliveryOption, Order, QuoteRequest } from "@/app/lib/types";

export default function OrderConfirmPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const quoteId = searchParams.get("quoteId");

  const quote = useMemo<QuoteRequest | null>(() => (quoteId ? loadQuote(quoteId) : null), [quoteId]);
  const [delivery, setDelivery] = useState<DeliveryOption>("standard");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!quote) {
      toast.error("Your quotation session expired — please request a new quote.");
      router.push("/products");
    }
  }, [quote, router]);

  if (!quote) {
    return <div className="mx-auto max-w-3xl px-4 py-16 text-center text-slate-500">Loading your quotation…</div>;
  }

  const product = getProductBySlug(quote.productSlug);
  if (!product) {
    return <div className="mx-auto max-w-3xl px-4 py-16 text-center text-slate-500">Loading…</div>;
  }

  async function handleConfirm() {
    if (!quote) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quoteId: quote.id, deliveryOption: delivery }),
      });
      if (res.status === 201) {
        const order = (await res.json()) as Order;
        saveOrder(order);
        router.push(`/order/success?orderNumber=${order.orderNumber}`);
        return;
      }
      toast.error("Could not confirm your order. Please try again.");
    } catch {
      toast.error("Network error — please check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <h1 className="mb-6 text-2xl font-bold">Confirm Your Order</h1>

      <div className="mb-6 rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="mb-4 text-lg font-bold text-slate-900">Order Summary</h2>
        <div className="mb-4 flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <p className="text-xs font-medium uppercase text-primary">{product.brand}</p>
            <p className="font-semibold text-slate-900">{product.partNumber}</p>
            <p className="text-sm text-slate-600">{product.name}</p>
          </div>
          <p className="text-sm text-slate-600">Qty: {quote.quantity}</p>
        </div>
        <div className="flex justify-between text-sm text-slate-600">
          <span>Unit Price</span>
          <span>{formatPrice(quote.unitPrice)}</span>
        </div>
        <div className="mt-2 flex justify-between text-lg font-bold text-slate-900">
          <span>Total</span>
          <span>{formatPrice(quote.totalPrice)}</span>
        </div>
      </div>

      <div className="mb-6">
        <h2 className="mb-4 text-lg font-bold text-slate-900">Delivery Option</h2>
        <DeliveryOptions value={delivery} onChange={setDelivery} />
      </div>

      <button
        type="button"
        onClick={handleConfirm}
        disabled={submitting}
        className="btn-glass-accent w-full disabled:opacity-60"
      >
        {submitting ? "Confirming..." : "Confirm Order"}
      </button>
    </div>
  );
}
