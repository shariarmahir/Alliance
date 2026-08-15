"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useQuote } from "@/app/lib/quote-context";
import type { Product } from "@/app/lib/types";

// The listing row and detail panel both pair the CTA with a quantity stepper,
// so the button owns the quantity and submits it with the line.
export function RequestQuoteButton({
  product,
  withStepper = false,
  className = "",
}: {
  product: Product;
  withStepper?: boolean;
  className?: string;
}) {
  const { addItem } = useQuote();
  const router = useRouter();
  const [qty, setQty] = useState(1);

  function requestQuote() {
    addItem(product, qty);
    toast.success("Added to your price request");
    router.push("/quote");
  }

  return (
    <>
      {withStepper && (
        <div className="flex items-center gap-2">
          <span className="mono-label text-[11px] tracking-normal text-ink-muted">QTY</span>
          <span className="flex items-center overflow-hidden rounded-[7px] border border-[#dde3ea]">
            <button
              type="button"
              aria-label="Decrease quantity"
              onClick={() => setQty((n) => Math.max(1, n - 1))}
              className="h-8 w-7 text-[15px] text-[#64748b] transition-colors hover:bg-[#f2f4f7]"
            >
              −
            </button>
            <span className="h-8 w-9 border-x border-hairline text-center font-mono text-[13px] font-semibold leading-8 text-ink">
              {qty}
            </span>
            <button
              type="button"
              aria-label="Increase quantity"
              onClick={() => setQty((n) => n + 1)}
              className="h-8 w-7 text-[15px] text-[#64748b] transition-colors hover:bg-[#f2f4f7]"
            >
              +
            </button>
          </span>
        </div>
      )}
      <button
        type="button"
        onClick={requestQuote}
        className={
          className ||
          "btn-glass w-full rounded-md py-2.5 text-[13.5px] font-bold shadow-[0_8px_18px_rgba(0,125,204,.22)]"
        }
      >
        Ask Price
      </button>
    </>
  );
}
