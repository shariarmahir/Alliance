"use client";
import Link from "next/link";
import { QuantityStepper } from "./quantity-stepper";
import { useState } from "react";

export function QuoteCta({ slug }: { slug: string }) {
  const [qty, setQty] = useState(1);
  return (
    <div className="flex flex-col gap-3">
      <QuantityStepper initial={1} onChange={setQty} />
      <Link href={`/quote/${slug}?qty=${qty}`} className="btn-glass-accent">Request Quotation</Link>
    </div>
  );
}
