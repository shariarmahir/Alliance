"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { Clock, CheckCircle2, XCircle, PackageSearch } from "lucide-react";
import { formatPrice } from "@/app/lib/utils";
import type { Quotation } from "@/app/lib/types";

// No order-confirm form: the admin's own confirmation IS the order, and its
// tracking ID is generated the moment they issue it (see
// /api/admin/quotations/[id]/confirm). This page is the customer's only
// stop between submitting a request and having a real trackingId to look up
// on /track/[trackingId].
export default function QuoteStatusPage() {
  const params = useParams<{ id: string }>();
  const [quotation, setQuotation] = useState<Quotation | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch(`/api/quotations/${params.id}`);
      if (res.status === 404) {
        setNotFound(true);
        return null;
      }
      if (res.ok) {
        const data = await res.json();
        return (data.quotation as Quotation | undefined) ?? null;
      }
    } catch {
      // offline — keep whatever state is already shown
    }
    return null;
  }, [params.id]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const q = await refresh();
      if (cancelled) return;
      setQuotation(q);
      setLoading(false);
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

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

  const totalUnits = quotation.items.reduce((sum, i) => sum + i.quantity, 0);

  return (
    <div className="mx-auto max-w-2xl px-4 py-16">
      <div className="mb-8 flex items-center gap-3">
        <PackageSearch className="size-8 text-primary" />
        <div>
          <h1 className="text-2xl font-bold text-ink">Your price request</h1>
          <p className="text-sm text-ink-muted">
            {quotation.items.length} {quotation.items.length === 1 ? "line" : "lines"} · {totalUnits}{" "}
            units
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-[10px] border border-slate-line bg-white">
        <div className="p-6">
          {quotation.status === "confirmed" && quotation.confirmation ? (
            <>
              <div className="mb-5 flex items-start gap-2.5 rounded-md border border-[#cfe9d4] bg-[#f2fbf4] p-3.5 text-[13px] leading-[1.65] text-[#1a6b33]">
                <CheckCircle2 className="mt-px size-4 shrink-0" />
                <span>
                  Confirmed. Ref <strong className="font-mono">{quotation.confirmation.refNumber}</strong>{" "}
                  — total {formatPrice(quotation.confirmation.grandTotal)}. Our team will contact you to
                  arrange delivery.
                </span>
              </div>
              <Link
                href={`/track/${quotation.confirmation.trackingId}`}
                className="btn-glass flex w-full items-center justify-center gap-2"
              >
                Track delivery
              </Link>
            </>
          ) : quotation.status === "cancelled" ? (
            <div className="flex items-start gap-2.5 rounded-md border border-[#f6cfcf] bg-[#fef6f6] p-3.5 text-[13px] leading-[1.65] text-[#7a2f2f]">
              <XCircle className="mt-px size-4 shrink-0" />
              <span>This request was declined. Contact our engineers on WhatsApp for details.</span>
            </div>
          ) : (
            <>
              <div className="mb-5 flex items-start gap-2.5 rounded-md border border-tint-line bg-[#f4faff] p-3.5 text-[13px] leading-[1.65] text-[#00618f]">
                <Clock className="mt-px size-4 shrink-0" />
                <span>Under review — an engineer is pricing your request.</span>
              </div>
              <button
                type="button"
                onClick={async () => {
                  setQuotation(await refresh());
                }}
                className="flex w-full items-center justify-center rounded-[9px] border border-slate-line bg-surface px-5 py-3 text-[14px] font-semibold text-ink transition-colors hover:border-primary hover:text-primary"
              >
                Check for an update
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
