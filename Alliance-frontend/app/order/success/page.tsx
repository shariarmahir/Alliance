"use client";

import { useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, Truck } from "lucide-react";
import { loadOrder, loadQuote } from "@/app/lib/quote-store";
import { getProductBySlug } from "@/app/lib/mock-data";
import { formatPrice } from "@/app/lib/utils";
import { InvoiceActions } from "@/app/components/invoice-actions";

export default function OrderSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderNumber = searchParams.get("orderNumber");

  const { order, quote, product } = useMemo(() => {
    const loadedOrder = orderNumber ? loadOrder(orderNumber) : null;
    const loadedQuote = loadedOrder ? loadQuote(loadedOrder.quoteId) : null;
    const loadedProduct = loadedQuote ? getProductBySlug(loadedQuote.productSlug) : undefined;
    return { order: loadedOrder, quote: loadedQuote, product: loadedProduct ?? null };
  }, [orderNumber]);

  useEffect(() => {
    if (!order || !quote || !product) {
      toast.error("We couldn't find that order — please request a new quote.");
      router.push("/products");
    }
  }, [order, quote, product, router]);

  if (!order || !quote || !product) {
    return <div className="mx-auto max-w-3xl px-4 py-16 text-center text-slate-500">Loading your order…</div>;
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-10">
      <div className="mb-8 flex flex-col items-center gap-3 rounded-xl border border-slate-200 bg-white p-10 text-center">
        <CheckCircle2 className="size-14 text-primary" />
        <h1 className="text-2xl font-bold text-slate-900">Order Confirmed!</h1>
        <p className="text-slate-600">
          Thank you, {quote.name}. Your order has been received and is being processed.
        </p>
        <p className="text-lg font-semibold text-slate-900">Order #{order.orderNumber}</p>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <p className="mb-1 text-sm font-semibold text-slate-900">Tracking ID</p>
          <Link href={`/track/${order.trackingId}`} className="flex items-center gap-2 text-primary hover:underline">
            <Truck className="size-4" /> {order.trackingId}
          </Link>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-6">
          <p className="mb-1 text-sm font-semibold text-slate-900">Estimated Delivery</p>
          <p className="text-slate-600">
            {new Date(order.estimatedDeliveryDate).toLocaleDateString("en-US", {
              month: "long",
              day: "numeric",
              year: "numeric",
            })}
          </p>
        </div>
      </div>

      <div id="invoice" className="mb-8 rounded-xl border border-slate-200 bg-white p-6">
        <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <p className="text-lg font-bold text-primary">Alliance</p>
            <p className="text-xs text-slate-500">Uttara, Dhaka, Bangladesh · info@alliance.com</p>
          </div>
          <div className="text-right text-sm text-slate-600">
            <p className="font-semibold text-slate-900">Order #{order.orderNumber}</p>
            <p>{new Date(order.createdAt).toLocaleDateString("en-US")}</p>
          </div>
        </div>
        <h2 className="mb-4 text-lg font-bold text-slate-900">Order Summary</h2>
        <div className="mb-4 flex items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <p className="text-xs font-medium uppercase text-primary">{product.brand}</p>
            <p className="font-semibold text-slate-900">{product.partNumber}</p>
            <p className="text-sm text-slate-600">{product.name}</p>
          </div>
          <p className="text-sm text-slate-600">Qty: {quote.quantity}</p>
        </div>
        <div className="flex justify-between text-lg font-bold text-slate-900">
          <span>Total</span>
          <span>{formatPrice(quote.totalPrice)}</span>
        </div>
      </div>

      <div className="no-print">
        <InvoiceActions order={order} quote={quote} product={product} />
      </div>
    </div>
  );
}
