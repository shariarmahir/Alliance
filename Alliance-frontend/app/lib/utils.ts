import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// All stored prices (data/products.json, order/quotation snapshots, the
// admin's mock revenue figures) are BDT amounts as of the storefront's
// USD -> BDT conversion. This is the single rate constant for any future
// figure that still needs converting — update it here, not per-call.
export const USD_TO_BDT_RATE = 122;

export function formatPrice(n: number): string {
  // en-BD + currency defaults to the "BDT" code, not the ৳ glyph (CLDR has
  // no symbol mapping for that locale/currency pair) — narrowSymbol forces
  // the real Taka sign while en-BD keeps Western digit grouping
  // (420,900 not bn-BD's lakh/crore ৪,২০,৯০০), which reads better for a B2B
  // storefront serving an international audience.
  return new Intl.NumberFormat("en-BD", {
    style: "currency",
    currency: "BDT",
    currencyDisplay: "narrowSymbol",
  }).format(n);
}

export function addBusinessDays(date: Date, days: number): Date {
  const result = new Date(date);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const day = result.getDay();
    if (day !== 0 && day !== 6) added++;
  }
  return result;
}
