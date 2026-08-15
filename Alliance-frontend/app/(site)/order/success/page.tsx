"use client";

import { Suspense, useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2, Package, ExternalLink, Download, Printer, Truck, Calendar } from "lucide-react";
import { formatPrice } from "@/app/lib/utils";
import type { Order } from "@/app/lib/types";
import { Card } from "@/app/components/ui/card";

const ORDER_STORAGE_KEY = "autolink_order";

function buildInvoiceHtml(order: Order): string {
  const rows = order.items
    .map(
      (i) =>
        `<tr><td>${i.name} (${i.partNumber})</td><td>${i.quantity}</td><td>${formatPrice(i.price)}</td><td>${formatPrice(i.price * i.quantity)}</td></tr>`
    )
    .join("");

  return `<!doctype html><html><head><meta charset="utf-8"><title>Invoice ${order.orderNumber}</title>
    <style>body{font-family:Arial,sans-serif;color:#1e293b;padding:40px;max-width:800px;margin:auto}h1{color:#007DCC}table{width:100%;border-collapse:collapse;margin-top:20px}th,td{border:1px solid #e2e8f0;padding:10px;text-align:left;font-size:14px}th{background:#007DCC;color:#fff}.tot{text-align:right;font-weight:bold}.brand{font-size:26px;font-weight:800;color:#007DCC;line-height:1.1}.legal{margin:2px 0 6px;font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#64748b}</style></head><body>
    <div class="brand">AutoLink<span style="color:#FFB900">.</span></div><p class="legal">AutoLink Integrated Technologies</p><p>Uttara, Dhaka, Bangladesh · info@autolink.com · +8801713-116019</p>
    <h1>Invoice</h1><p><b>Order:</b> ${order.orderNumber}<br><b>Tracking:</b> ${order.trackingId}<br><b>Date:</b> ${new Date(order.placedAt).toLocaleDateString()}</p>
    <p><b>Ship to:</b> ${order.address.name}, ${order.address.line} ${order.address.city}, ${order.address.country} · ${order.address.phone}</p>
    <table><thead><tr><th>Item</th><th>Qty</th><th>Unit</th><th>Total</th></tr></thead><tbody>
    ${rows}
    </tbody></table>
    <p class="tot">Subtotal: ${formatPrice(order.subtotal)}<br>Shipping: ${formatPrice(order.shippingCost)}<br>Grand Total: ${formatPrice(order.grandTotal)}</p>
    <p>Delivery: ${order.deliveryOptionName} (${order.deliveryEta}) · Preferred date: ${order.preferredDate}</p>
    <p style="margin-top:30px;color:#64748b">Thank you for your order. Developed by Mahir Shariar Mahin.</p></body></html>`;
}

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

  const invoiceHtml = useMemo(() => (order ? buildInvoiceHtml(order) : ""), [order]);

  function downloadInvoice() {
    if (!order) return;
    const blob = new Blob([invoiceHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Invoice-${order.orderNumber}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function printInvoice() {
    if (!order) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(invoiceHtml);
    w.document.close();
    w.focus();
    w.print();
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
        <button type="button" onClick={downloadInvoice} className="btn-glass-accent flex items-center gap-2">
          <Download className="size-5" /> Download Invoice
        </button>
        <button type="button" onClick={printInvoice} className="btn-glass flex items-center gap-2">
          <Printer className="size-5" /> Print Invoice
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
