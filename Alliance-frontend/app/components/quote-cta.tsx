"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useQuote } from "@/app/lib/quote-context";
import type { Product } from "@/app/lib/types";

// Receives the full product object as a prop (resolved server-side by the
// product detail page) rather than looking it up itself — mock-data.ts is
// server-only (reads data/products.json from disk) and cannot be imported
// from this client component.
export function QuoteCta({ product }: { product: Product }) {
  const [qty, setQty] = useState(1);
  const { addItem } = useQuote();
  const router = useRouter();

  function submit(goToQuote: boolean) {
    addItem(product, qty);
    toast.success("Added to your price request");
    if (goToQuote) router.push("/quote");
  }

  return (
    <div className="rounded-xl border border-tint-line bg-linear-to-b from-[#f4faff] to-white p-5">
      <div className="mb-3.5 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="mb-1 text-[15px] font-semibold text-ink">Ask Price</p>
          <p className="text-[12.5px] text-ink-muted">
            Firm quotation with freight, valid 14 days — inside 4 working hours.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <span className="mono-label text-[11px] tracking-normal text-ink-muted">QTY</span>
          <span className="flex items-center overflow-hidden rounded-md border border-[#dde3ea] bg-white">
            <button
              type="button"
              aria-label="Decrease quantity"
              onClick={() => setQty((n) => Math.max(1, n - 1))}
              className="h-[38px] w-[34px] text-base text-[#64748b] transition-colors hover:bg-[#f2f4f7]"
            >
              −
            </button>
            <span className="h-[38px] w-[46px] border-x border-hairline text-center font-mono text-sm font-semibold leading-[38px] text-ink">
              {qty}
            </span>
            <button
              type="button"
              aria-label="Increase quantity"
              onClick={() => setQty((n) => n + 1)}
              className="h-[38px] w-[34px] text-base text-[#64748b] transition-colors hover:bg-[#f2f4f7]"
            >
              +
            </button>
          </span>
        </div>
      </div>

      <div className="flex flex-col gap-2.5 sm:flex-row">
        <button
          type="button"
          onClick={() => submit(true)}
          className="btn-sheen flex-1 rounded-[9px] border border-white/40 bg-accent/90 px-5 py-3.5 text-[15px] font-bold text-ink shadow-[0_12px_26px_rgba(255,185,0,.3)] transition-all hover:-translate-y-0.5 hover:bg-accent"
        >
          Ask Price for this part
        </button>
        <button
          type="button"
          onClick={() => submit(false)}
          className="rounded-[9px] border-[1.5px] border-primary bg-primary/[0.06] px-5 py-3.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/[0.12]"
        >
          Add to request list
        </button>
      </div>

      <div className="mt-3.5 flex flex-wrap gap-5 text-xs text-ink-muted">
        <span>✓ No price shown until an engineer confirms stock</span>
        <span>✓ Volume breaks on 5+ units</span>
      </div>
    </div>
  );
}
