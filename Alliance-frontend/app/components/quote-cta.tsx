"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useQuote } from "@/app/lib/quote-context";
import { QuantityStepper } from "./quantity-stepper";
import type { Product } from "@/app/lib/types";

// Receives the full product object as a prop (resolved server-side by the
// product detail page) rather than looking it up itself — mock-data.ts is
// server-only (reads data/products.json from disk) and cannot be imported
// from this client component.
export function QuoteCta({ product }: { product: Product }) {
  const [qty, setQty] = useState(1);
  const { addItem } = useQuote();
  const router = useRouter();

  function requestQuote() {
    addItem(product, qty);
    toast.success("Added to your price request");
    router.push("/quote");
  }

  return (
    <div className="flex flex-col gap-3">
      <QuantityStepper initial={1} onChange={setQty} />
      <button type="button" onClick={requestQuote} className="btn-glass-accent">
        Ask Price for This Part
      </button>
    </div>
  );
}
