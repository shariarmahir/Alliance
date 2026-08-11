"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useQuote } from "@/app/lib/quote-context";
import type { Product } from "@/app/lib/types";

export function RequestQuoteButton({ product }: { product: Product }) {
  const { addItem } = useQuote();
  const router = useRouter();

  function requestQuote() {
    addItem(product, 1);
    toast.success("Added to your quotation");
    router.push("/quote");
  }

  return (
    <button type="button" onClick={requestQuote} className="btn-glass-accent">
      Create Quotation
    </button>
  );
}
