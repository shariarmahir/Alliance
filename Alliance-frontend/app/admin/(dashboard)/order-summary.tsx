"use client";

import type { Quotation } from "@/app/lib/types";

// "Customer information, Work Order/PO No., quotation reference, items,
// quantity, unit price, and commercial terms should be loaded automatically
// from the confirmed order."
//
// The lines and prices always loaded; this is the rest of that sentence.
// The PO number matters most: it is what the customer's accounts department
// matches an invoice against before paying it, so an admin who has to leave
// the screen to find it is an admin who sometimes guesses.

const TERM_LABELS: [keyof NonNullable<Quotation["confirmation"]>["terms"], string][] = [
  ["payment", "Payment"],
  ["delivery", "Delivery"],
  ["offerValidity", "Offer validity"],
  ["vatAit", "VAT & AIT"],
  ["warranty", "Warranty"],
];

export function OrderSummary({
  order,
  showTerms = false,
}: {
  order: Quotation | undefined;
  /** Commercial terms belong on an invoice; a challan carries no prices. */
  showTerms?: boolean;
}) {
  if (!order) return null;

  const facts: [string, string][] = [
    ["Customer", order.details.companyName || order.details.fullName],
    ["Contact", order.details.fullName],
    ["Quotation ref", order.confirmation?.refNumber ?? "—"],
    ["Work Order / PO", order.poNumber || "Not received"],
  ];

  const terms = order.confirmation?.terms;
  const termRows = showTerms && terms
    ? TERM_LABELS.filter(([key]) => terms[key]).map(
        ([key, label]) => [label, String(terms[key])] as [string, string]
      )
    : [];

  return (
    <div className="rounded-md border border-[#e4ecf4] bg-[#f7fafd] p-3">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-1.5 text-[12px]">
        {facts.map(([label, value]) => (
          <div key={label} className="flex justify-between gap-3">
            <dt className="shrink-0 text-ink-muted">{label}</dt>
            <dd
              className={`truncate text-right font-semibold ${
                // An absent PO is worth noticing rather than reading as data.
                value === "Not received" ? "text-[#cc9400]" : "text-ink"
              }`}
            >
              {value}
            </dd>
          </div>
        ))}
      </dl>

      {termRows.length > 0 && (
        <>
          <p className="mono-label mt-3 mb-1.5 text-[10px] text-ink-muted">
            Commercial terms
          </p>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-[11.5px]">
            {termRows.map(([label, value]) => (
              <div key={label} className="flex justify-between gap-3">
                <dt className="shrink-0 text-ink-muted">{label}</dt>
                <dd className="truncate text-right text-ink-soft">{value}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </div>
  );
}

// The quotation form collects no street address — a price request does not
// need one — so this composes what the record actually holds rather than
// prefilling a bare country that looks complete enough to dispatch against.
export function composeDeliveryAddress(order: Quotation | undefined): string {
  if (!order) return "";
  const { companyName, fullName, phone, country } = order.details;
  return [
    companyName,
    companyName && fullName !== companyName ? `Attn: ${fullName}` : "",
    phone ? `Phone: ${phone}` : "",
    country,
  ]
    .filter(Boolean)
    .join("\n");
}
