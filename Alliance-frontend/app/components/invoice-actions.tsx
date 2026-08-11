"use client";

import jsPDF from "jspdf";
import type { Order, Product, QuoteRequest } from "@/app/lib/types";
import { formatPrice } from "@/app/lib/utils";

export function InvoiceActions({
  order,
  quote,
  product,
}: {
  order: Order;
  quote: QuoteRequest;
  product: Product;
}) {
  function handleDownload() {
    const doc = new jsPDF();

    doc.setFontSize(20);
    doc.setTextColor(0, 125, 204);
    doc.text("Alliance", 14, 20);

    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    doc.text("Uttara, Dhaka, Bangladesh", 14, 27);
    doc.text("info@alliance.com  |  +8801713-116019", 14, 32);

    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text("INVOICE", 150, 20);
    doc.setFontSize(10);
    doc.text(`Order #: ${order.orderNumber}`, 150, 27);
    doc.text(`Date: ${new Date(order.createdAt).toLocaleDateString("en-US")}`, 150, 32);

    doc.setDrawColor(226, 232, 240);
    doc.line(14, 38, 196, 38);

    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text("Bill To:", 14, 46);
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    doc.text(quote.name, 14, 52);
    doc.text(quote.company, 14, 57);
    doc.text(quote.email, 14, 62);
    doc.text(quote.phone, 14, 67);
    doc.text(quote.country, 14, 72);

    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text("Delivery:", 130, 46);
    doc.setFontSize(10);
    doc.setTextColor(60, 60, 60);
    doc.text(order.deliveryOption === "express" ? "Express Shipping" : "Standard Shipping", 130, 52);
    doc.text(
      `Est. Delivery: ${new Date(order.estimatedDeliveryDate).toLocaleDateString("en-US")}`,
      130,
      57
    );
    doc.text(`Tracking ID: ${order.trackingId}`, 130, 62);

    doc.setDrawColor(226, 232, 240);
    doc.line(14, 80, 196, 80);

    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.setFillColor(0, 125, 204);
    doc.rect(14, 86, 182, 8, "F");
    doc.text("Part Number", 16, 91.5);
    doc.text("Description", 60, 91.5);
    doc.text("Qty", 130, 91.5);
    doc.text("Unit Price", 150, 91.5);
    doc.text("Total", 178, 91.5);

    doc.setTextColor(15, 23, 42);
    doc.text(product.partNumber, 16, 101);
    doc.text(product.name.slice(0, 28), 60, 101);
    doc.text(String(quote.quantity), 130, 101);
    doc.text(formatPrice(quote.unitPrice), 150, 101);
    doc.text(formatPrice(quote.totalPrice), 178, 101);

    doc.setDrawColor(226, 232, 240);
    doc.line(14, 108, 196, 108);

    doc.setFontSize(12);
    doc.setTextColor(0, 125, 204);
    doc.text(`Total: ${formatPrice(quote.totalPrice)}`, 150, 118);

    doc.setFontSize(9);
    doc.setTextColor(148, 163, 184);
    doc.text("Alliance Industrial Electronics — info@alliance.com — +8801713-116019", 14, 280);
    doc.text("© Alliance 2026-2028. All rights reserved.", 14, 285);

    doc.save(`invoice-${order.orderNumber}.pdf`);
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <button type="button" onClick={handleDownload} className="btn-glass-accent">
        Download Invoice
      </button>
      <button type="button" onClick={handlePrint} className="btn-glass">
        Print Invoice
      </button>
    </div>
  );
}
