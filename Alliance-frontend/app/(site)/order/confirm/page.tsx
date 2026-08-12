"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Truck, Zap, Plane, ArrowRight, MapPin } from "lucide-react";
import { toast } from "sonner";
import { useQuote } from "@/app/lib/quote-context";
import { formatPrice } from "@/app/lib/utils";
import type { DeliveryOption, DeliveryOptionId, DeliveryAddress, Order } from "@/app/lib/types";
import { Card } from "@/app/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/app/components/ui/radio-group";

const OPTIONS: (DeliveryOption & { icon: typeof Truck })[] = [
  { id: "standard", icon: Truck, name: "Standard Shipping", eta: "7 – 10 business days", cost: 60 },
  { id: "express", icon: Zap, name: "Express Courier", eta: "3 – 5 business days", cost: 140 },
  { id: "air", icon: Plane, name: "Priority Air Freight", eta: "1 – 3 business days", cost: 260 },
];

const ORDER_STORAGE_KEY = "autolink_order";

function generateOrderNumber(): string {
  return `ALC-${Date.now().toString(36).toUpperCase()}`;
}

function generateTrackingId(): string {
  const random = Math.floor(100000 + Math.random() * 899999);
  return `TRK${random}BD`;
}

function defaultPreferredDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 5);
  return d.toISOString().slice(0, 10);
}

const QUOTATION_STORAGE_KEY = "autolink_quotation";

function defaultAddress(): DeliveryAddress {
  const fallback: DeliveryAddress = { name: "", line: "", city: "", country: "Bangladesh", phone: "" };
  if (typeof window === "undefined") return fallback;
  try {
    const raw = sessionStorage.getItem(QUOTATION_STORAGE_KEY);
    if (!raw) return fallback;
    const quotation = JSON.parse(raw);
    return {
      ...fallback,
      name: quotation.fullName ?? "",
      phone: quotation.phone ?? "",
      country: quotation.country || "Bangladesh",
    };
  } catch {
    return fallback;
  }
}

export default function ConfirmOrderPage() {
  const router = useRouter();
  const { items, total, clear } = useQuote();
  const [shipOption, setShipOption] = useState<DeliveryOptionId>("express");
  const [date, setDate] = useState(defaultPreferredDate);
  const [address, setAddress] = useState<DeliveryAddress>(defaultAddress);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (items.length === 0 && !submitting) router.replace("/products");
  }, [items.length, submitting, router]);

  if (items.length === 0) return null;

  const opt = OPTIONS.find((o) => o.id === shipOption)!;
  const grandTotal = total + opt.cost;

  async function confirmOrder(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const order: Order = {
      orderNumber: generateOrderNumber(),
      trackingId: generateTrackingId(),
      items,
      subtotal: total,
      shippingCost: opt.cost,
      grandTotal,
      deliveryOption: opt.id,
      deliveryOptionName: opt.name,
      deliveryEta: opt.eta,
      preferredDate: date,
      address,
      placedAt: new Date().toISOString(),
      status: "pending",
    };
    try {
      localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(order));
    } catch {
      // storage unavailable — order still proceeds, success page will show empty state
    }

    // Fire-and-forget server mirror so admins can review/confirm/cancel this
    // order. Awaited so we can toast on failure, but its outcome never blocks
    // navigation — the customer's local-first flow must keep working even if
    // the server write fails.
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(order),
      });
      if (!res.ok) {
        toast.warning("Order confirmed, but we couldn't sync it to our records. Our team may follow up manually.");
      }
    } catch {
      toast.warning("Order confirmed, but we couldn't sync it to our records. Our team may follow up manually.");
    }

    clear();
    toast.success("Order confirmed successfully!");
    router.push(`/order/success?orderNumber=${order.orderNumber}`);
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8">
      <h1 className="mb-8 text-3xl font-extrabold text-slate-900">Confirm Your Order</h1>
      <form onSubmit={confirmOrder} className="grid gap-8 lg:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-bold">
              <MapPin className="size-5 text-primary" /> Delivery Address
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <input
                required
                name="recipientName"
                value={address.name}
                onChange={(e) => setAddress({ ...address, name: e.target.value })}
                placeholder="Recipient name *"
                className="h-11 rounded-md border border-slate-300 px-4 outline-none focus:border-primary"
              />
              <input
                required
                name="phone"
                value={address.phone}
                onChange={(e) => setAddress({ ...address, phone: e.target.value })}
                placeholder="Phone *"
                className="h-11 rounded-md border border-slate-300 px-4 outline-none focus:border-primary"
              />
              <input
                required
                name="streetAddress"
                value={address.line}
                onChange={(e) => setAddress({ ...address, line: e.target.value })}
                placeholder="Street address *"
                className="h-11 rounded-md border border-slate-300 px-4 outline-none focus:border-primary sm:col-span-2"
              />
              <input
                required
                name="city"
                value={address.city}
                onChange={(e) => setAddress({ ...address, city: e.target.value })}
                placeholder="City *"
                className="h-11 rounded-md border border-slate-300 px-4 outline-none focus:border-primary"
              />
              <input
                required
                name="country"
                value={address.country}
                onChange={(e) => setAddress({ ...address, country: e.target.value })}
                placeholder="Country *"
                className="h-11 rounded-md border border-slate-300 px-4 outline-none focus:border-primary"
              />
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="mb-4 text-lg font-bold">Delivery Option</h2>
            <RadioGroup
              value={shipOption}
              onValueChange={(v) => setShipOption(v as DeliveryOptionId)}
              className="space-y-3"
            >
              {OPTIONS.map((o) => (
                <label
                  key={o.id}
                  className={`flex cursor-pointer items-center gap-4 rounded-lg border p-4 ${
                    shipOption === o.id ? "border-primary bg-secondary" : "border-slate-200"
                  }`}
                >
                  <RadioGroupItem value={o.id} />
                  <o.icon className="size-6 text-primary" />
                  <div className="flex-1">
                    <div className="font-semibold text-slate-900">{o.name}</div>
                    <div className="text-sm text-slate-500">{o.eta}</div>
                  </div>
                  <div className="font-bold text-slate-900">{formatPrice(o.cost)}</div>
                </label>
              ))}
            </RadioGroup>
            <div className="mt-4">
              <label className="mb-1 block text-sm font-semibold text-slate-900">
                Preferred Delivery Date
              </label>
              <input
                type="date"
                required
                name="preferredDate"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-11 rounded-md border border-slate-300 px-4 outline-none focus:border-primary"
              />
            </div>
          </Card>
        </div>

        <div>
          <Card className="sticky top-24 p-6">
            <h2 className="mb-4 text-lg font-bold">Order Summary</h2>
            <div className="mb-4 max-h-48 space-y-2 overflow-auto text-sm">
              {items.map((it) => (
                <div key={it.slug} className="flex justify-between gap-2">
                  <span className="line-clamp-1 text-slate-500">
                    {it.quantity}× {it.name}
                  </span>
                  <span className="font-medium text-slate-900">
                    {formatPrice(it.price * it.quantity)}
                  </span>
                </div>
              ))}
            </div>
            <div className="space-y-2 border-t border-slate-200 pt-3 text-sm">
              <div className="flex justify-between text-slate-500">
                <span>Subtotal</span>
                <span className="font-medium text-slate-900">{formatPrice(total)}</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>Shipping ({opt.name})</span>
                <span className="font-medium text-slate-900">{formatPrice(opt.cost)}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-3 text-base font-extrabold">
                <span>Total</span>
                <span className="text-primary">{formatPrice(grandTotal)}</span>
              </div>
            </div>
            <button type="submit" className="btn-glass-accent mt-6 flex w-full items-center justify-center gap-2">
              Confirm Order <ArrowRight className="size-5" />
            </button>
            <Link href="/products" className="mt-3 block text-center text-sm text-slate-500 hover:text-primary">
              Continue Shopping
            </Link>
          </Card>
        </div>
      </form>
    </div>
  );
}
