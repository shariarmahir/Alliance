"use client";

import { Suspense, useMemo, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Package, ExternalLink, Download, Printer, Truck, Calendar } from "lucide-react";
import { toast } from "sonner";
import { formatPrice } from "@/app/lib/utils";
import { downloadInvoicePdf, printInvoicePdf } from "@/app/lib/quotation-pdf";
import type { Order } from "@/app/lib/types";
import { Card } from "@/app/components/ui/card";

const ORDER_STORAGE_KEY = "autolink_order";

function subscribe(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  return () => window.removeEventListener("storage", onStoreChange);
}

function getStoredRaw(): string | null {
  try {
    return localStorage.getItem(ORDER_STORAGE_KEY);
  } catch {
    return null;
  }
}

function getServerSnapshot(): string | null {
  return null;
}

export default function OrderSuccessPage() {
  return (
    <Suspense fallback={null}>
      <OrderSuccessContent />
    </Suspense>
  );
}

function OrderSuccessContent() {
  const searchParams = useSearchParams();
  const orderNumber = searchParams.get("orderNumber");
  const raw = useSyncExternalStore(subscribe, getStoredRaw, getServerSnapshot);

  const order = useMemo(() => {
    if (!raw) return null;
    try {
      const stored: Order = JSON.parse(raw);
      return !orderNumber || stored.orderNumber === orderNumber ? stored : null;
    } catch {
      return null;
    }
  }, [raw, orderNumber]);

  const [busy, setBusy] = useState<"download" | "print" | null>(null);

  async function downloadInvoice() {
    if (!order) return;
    setBusy("download");
    try {
      await downloadInvoicePdf(order);
    } catch {
      toast.error("Could not generate the invoice PDF.");
    } finally {
      setBusy(null);
    }
  }

  async function printInvoice() {
    if (!order) return;
    setBusy("print");
    try {
      await printInvoicePdf(order);
    } catch {
      toast.error("Could not open the invoice for printing. Check your popup blocker.");
    } finally {
      setBusy(null);
    }
  }

  if (!order) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <h1 className="text-2xl font-bold text-slate-900">No recent order found</h1>
        <Link href="/products" className="mt-4 inline-block text-primary underline">
          Browse products
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-12">
      <div className="flex flex-col items-center text-center">
        <CheckCircle2 className="size-20 text-green-500" />
        <h1 className="mt-4 text-3xl font-extrabold text-slate-900">Order confirmed</h1>
        <p className="mt-2 text-slate-500">
          Your parts are being picked and an engineer will confirm handover to
          courier shortly.
        </p>
      </div>

      <Card className="mt-8 overflow-hidden">
        <div className="grid gap-px bg-slate-200 sm:grid-cols-3">
          <InfoTile icon={Package} label="Order Number" value={order.orderNumber} />
          <InfoTile icon={Truck} label="Tracking Number" value={order.trackingId} />
          <InfoTile icon={Calendar} label="Preferred Date" value={order.preferredDate} />
        </div>
        <div className="flex flex-col items-center gap-3 border-t border-slate-200 bg-secondary/50 p-6">
          <p className="text-sm text-slate-500">Track your delivery live:</p>
          <Link href={`/track/${order.trackingId}`} className="btn-glass flex items-center gap-2">
            <ExternalLink className="size-5" /> Track Order Live
          </Link>
        </div>
      </Card>

      <div id="invoice" className="mt-6">
        <Card className="p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold">Invoice · {order.orderNumber}</h2>
            <span className="text-sm text-slate-500">{new Date(order.placedAt).toLocaleDateString()}</span>
          </div>
          <div className="mt-4 space-y-2 text-sm">
            {order.items.map((i) => (
              <div key={i.slug} className="flex justify-between border-b border-slate-100 py-2">
                <span>
                  {i.quantity}× {i.name}
                </span>
                <span className="font-medium">{formatPrice(i.price * i.quantity)}</span>
              </div>
            ))}
          </div>
          <div className="mt-4 space-y-1 text-right text-sm">
            <div>
              Subtotal: <b>{formatPrice(order.subtotal)}</b>
            </div>
            <div>
              Shipping: <b>{formatPrice(order.shippingCost)}</b>
            </div>
            <div className="text-lg font-extrabold text-primary">Total: {formatPrice(order.grandTotal)}</div>
          </div>
        </Card>
      </div>

      <div className="no-print mt-6 flex flex-wrap justify-center gap-4">
        <button
          type="button"
          onClick={downloadInvoice}
          disabled={busy !== null}
          className="btn-glass-accent flex items-center gap-2 disabled:opacity-60"
        >
          <Download className="size-5" />
          {busy === "download" ? "Preparing..." : "Download Invoice"}
        </button>
        <button
          type="button"
          onClick={printInvoice}
          disabled={busy !== null}
          className="btn-glass flex items-center gap-2 disabled:opacity-60"
        >
          <Printer className="size-5" />
          {busy === "print" ? "Preparing..." : "Print Invoice"}
        </button>
        <Link
          href="/products"
          className="flex items-center gap-2 rounded-lg px-6 py-3 font-bold text-slate-500 hover:text-primary"
        >
          Continue Shopping
        </Link>
      </div>
    </div>
  );
}

function InfoTile({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Package;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-3 bg-white p-6">
      <div className="flex size-11 items-center justify-center rounded-lg bg-secondary text-primary">
        <Icon className="size-5" />
      </div>
      <div>
        <div className="text-xs text-slate-500">{label}</div>
        <div className="font-bold text-slate-900">{value}</div>
      </div>
    </div>
  );
}
