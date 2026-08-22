"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { apiFetch, ApiError } from "@/app/lib/api-browser";
import type { Quotation } from "@/app/lib/types";

// The welcome/thank-you page a customer lands on right after submitting a
// price request. There is no order-confirm form and no tracking lookup here
// deliberately: pricing and confirmation happen off-platform (the admin
// emails a quotation, the customer replies or accepts by email), so this
// page's only job is to reassure the customer their request arrived and
// recap what they asked for.
export default function QuoteThankYouPage() {
  const params = useParams<{ id: string }>();
  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const load = useCallback(async () => {
    try {
      return await apiFetch<Quotation>(`/api/quotations/${encodeURIComponent(params.id)}`);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        setNotFound(true);
      }
    }
    return null;
  }, [params.id]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      const q = await load();
      if (cancelled) return;
      setQuotation(q);
      setLoading(false);
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [load]);

  if (loading) return null;

  if (notFound || !quotation) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <h1 className="text-2xl font-bold text-ink">Request not found</h1>
        <p className="mx-auto mt-3 max-w-md text-[13.5px] leading-[1.7] text-ink-muted">
          We couldn&apos;t find a price request with this link. If you just sent one, WhatsApp us and
          we&apos;ll help you locate it.
        </p>
        <Link href="/products" className="btn-glass mt-6 inline-flex items-center gap-2">
          Browse the catalogue
        </Link>
      </div>
    );
  }

  const { details } = quotation;
  const totalUnits = quotation.items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <div className="mb-8 flex flex-col items-center text-center">
        <CheckCircle2 className="size-12 text-ok" />
        <h1 className="mt-4 text-2xl font-bold text-ink">Thank you, {details.fullName.split(" ")[0]}</h1>
        <p className="mt-2 max-w-md text-[13.5px] leading-[1.7] text-ink-muted">
          Your request has been received. An engineer will price it and email your quotation to{" "}
          <strong className="text-ink">{details.email}</strong> shortly.
        </p>
      </div>

      <div className="overflow-hidden rounded-[10px] border border-slate-line bg-white">
        <div className="border-b border-slate-line bg-surface px-6 py-4">
          <strong className="text-sm font-semibold text-ink">
            {quotation.items.length} {quotation.items.length === 1 ? "line" : "lines"} · {totalUnits} units
          </strong>
        </div>
        <ul className="divide-y divide-hairline">
          {quotation.items.map((item) => (
            <li key={item.slug} className="flex items-center justify-between gap-4 px-6 py-3.5">
              <div className="min-w-0">
                <p className="truncate text-[13.5px] font-semibold text-ink">{item.name}</p>
                <p className="mono-label text-[10.5px] tracking-[0.05em] text-[#8a94a6]">
                  {item.partNumber}
                </p>
              </div>
              <span className="mono-label shrink-0 text-[12px] font-semibold text-ink-muted">
                × {item.quantity}
              </span>
            </li>
          ))}
        </ul>
        <div className="border-t border-slate-line px-6 py-4 text-[13px] leading-[1.7] text-ink-muted">
          <p>
            <strong className="text-ink">{details.companyName || details.fullName}</strong>
          </p>
          <p>{details.email}</p>
          {details.phone && <p>{details.phone}</p>}
        </div>
      </div>

      <p className="mt-6 rounded-lg border border-tint-line bg-[#f4faff] p-4 text-center text-[12.5px] leading-[1.65] text-[#00618f]">
        Need to change something? Reply to the quotation email once it arrives, or WhatsApp{" "}
        <a
          href="https://wa.me/8801315770099"
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono font-semibold hover:underline"
        >
          +8801315-770099
        </a>
        .
      </p>

      <div className="mt-8 flex justify-center">
        <Link href="/products" className="btn-glass inline-flex items-center gap-2">
          Continue browsing
        </Link>
      </div>
    </div>
  );
}
