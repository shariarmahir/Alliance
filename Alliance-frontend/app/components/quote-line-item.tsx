"use client";

import Image from "next/image";
import Link from "next/link";
import { Trash2 } from "lucide-react";
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
    <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center">
      <Link
        href={`/products/${item.slug}`}
        className="relative size-20 shrink-0 overflow-hidden rounded-lg bg-slate-50"
      >
        <Image src={item.image} alt={item.name} fill className="object-contain p-2" />
      </Link>

      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium uppercase text-primary">{item.brand}</p>
        <Link href={`/products/${item.slug}`} className="font-semibold text-slate-900 hover:text-primary">
          {item.partNumber}
        </Link>
        <p className="truncate text-sm text-slate-600">{item.name}</p>
      </div>

      <div className="flex items-center justify-between gap-4 sm:flex-col sm:items-end sm:justify-center">
        <QuantityStepper initial={item.quantity} onChange={onQtyChange} />
        <span className="text-xs font-semibold uppercase tracking-wide text-primary">Ask Price</span>
      </div>

      <button
        type="button"
        onClick={onRemove}
        aria-label={`Remove ${item.name}`}
        className="self-start text-slate-400 hover:text-red-600 sm:self-center"
      >
        <Trash2 className="size-5" />
      </button>
    </div>
  );
}
