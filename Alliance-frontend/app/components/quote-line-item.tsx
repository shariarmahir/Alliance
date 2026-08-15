"use client";

import Image from "next/image";
import Link from "next/link";
import type { QuoteItem } from "@/app/lib/types";
import { QuantityStepper } from "./quantity-stepper";

export function QuoteLineItem({
  item,
  onQtyChange,
  onRemove,
}: {
  item: QuoteItem;
  onQtyChange: (qty: number) => void;
  onRemove: () => void;
}) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-4 border-b border-hairline p-4.5 last:border-b-0 sm:grid-cols-[1fr_150px_40px]">
      <div className="flex min-w-0 gap-3.5">
        <Link
          href={`/products/${item.slug}`}
          className="relative flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-hairline bg-surface"
        >
          <Image src={item.image} alt={item.name} fill className="object-contain p-2" />
        </Link>
        <span className="min-w-0">
          <span className="mono-label block text-[10px] tracking-[0.07em] text-primary">{item.brand}</span>
          <Link
            href={`/products/${item.slug}`}
            className="my-0.5 block font-mono text-[15px] font-semibold text-ink hover:text-primary"
          >
            {item.partNumber}
          </Link>
          <span className="block truncate text-xs text-[#8a94a6]">{item.name}</span>
        </span>
      </div>

      <QuantityStepper initial={item.quantity} onChange={onQtyChange} />

      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${item.name}`}
        className="text-center text-[17px] text-[#c8d0da] transition-colors hover:text-[#e04545]"
      >
        ×
      </button>
    </div>
  );
}
