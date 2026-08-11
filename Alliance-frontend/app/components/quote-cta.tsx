"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useQuote } from "@/app/lib/quote-context";
import { getProductBySlug } from "@/app/lib/mock-data";
import { QuantityStepper } from "./quantity-stepper";

export function QuoteCta({ slug }: { slug: string }) {
  const [qty, setQty] = useState(1);
  const { addItem } = useQuote();
  const router = useRouter();

  function requestQuote() {
    const product = getProductBySlug(slug);
    if (!product) return;
    addItem(product, qty);
    toast.success("Added to your quotation");
    router.push("/order/confirm");
  }

  return (
    <div className="flex flex-col gap-3">
      <QuantityStepper initial={1} onChange={setQty} />
      <button type="button" onClick={requestQuote} className="btn-glass-accent">
        Request Quotation
      </button>
    </div>
  );
}
