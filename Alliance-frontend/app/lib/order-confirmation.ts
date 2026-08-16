import type { Quotation, QuotationTerms } from "./types";

// Shared between the admin confirm form (client), the confirm route handler
// (server) and the PDF builder — deliberately NOT server-only.

export const DEFAULT_TERMS: QuotationTerms = {
  payment: "100% Cash/Pay order.",
  delivery: "From Ready Stock",
  offerValidity: "07 days, From the Offer Date.",
  vatAit: "Excluded.",
  stock: "Available.",
  installationCharge: "Free.",
  warranty: "12 Months Warranty (From the date of delivery)",
};

export const UNIT_OPTIONS = ["Pcs", "Set", "Unit", "Nos", "Lot", "Mtr"];

// Base-36 of random bytes, uppercased — short enough to read off a printed
// PDF, wide enough (36^6 ≈ 2.2bn) that a collision inside one order is not a
// practical concern.
function randomCode(length: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => (b % 36).toString(36))
    .join("")
    .toUpperCase();
}

export function generateProductId(): string {
  return `AIT-PRD-${randomCode(6)}`;
}

export function generateTrackingId(): string {
  return `AIT-TRK-${randomCode(8)}`;
}

// Mirrors the demo's "AIT/MFL/ Q– 0418/2021": company initials, a sequence
// number, and the issue year.
export function generateRefNumber(companyName: string, sequence: number, date: Date): string {
  const initials =
    companyName
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join("")
      .toUpperCase()
      .slice(0, 4) || "GEN";
  return `AIT/${initials}/Q-${String(sequence).padStart(4, "0")}/${date.getFullYear()}`;
}

export function defaultSubject(quotation: Quotation): string {
  const lead = quotation.items[0]?.name ?? "industrial automation parts";
  return quotation.items.length > 1
    ? `Financial Offer for supply of ${lead} and ${quotation.items.length - 1} other item${
        quotation.items.length > 2 ? "s" : ""
      }.`
    : `Financial Offer for supply of ${lead}.`;
}

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten",
  "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function underThousand(n: number): string {
  if (n < 20) return ONES[n];
  if (n < 100) return `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ""}`;
  return `${ONES[Math.floor(n / 100)]} Hundred${n % 100 ? ` ${underThousand(n % 100)}` : ""}`;
}

// South Asian numbering (lakh / crore), matching the demo's "Inword:" line and
// how a BDT invoice is read locally.
export function amountInWords(amount: number): string {
  const n = Math.floor(Math.abs(amount));
  if (n === 0) return "Zero Taka only.";

  const parts: string[] = [];
  const crore = Math.floor(n / 10_000_000);
  const lakh = Math.floor((n % 10_000_000) / 100_000);
  const thousand = Math.floor((n % 100_000) / 1000);
  const rest = n % 1000;

  if (crore) parts.push(`${underThousand(crore)} Crore`);
  if (lakh) parts.push(`${underThousand(lakh)} Lakh`);
  if (thousand) parts.push(`${underThousand(thousand)} Thousand`);
  if (rest) parts.push(underThousand(rest));

  return `${parts.join(" ")} Taka only.`;
}
