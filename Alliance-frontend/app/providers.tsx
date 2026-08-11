"use client";

import { QuoteProvider } from "@/app/lib/quote-context";

export function Providers({ children }: { children: React.ReactNode }) {
  return <QuoteProvider>{children}</QuoteProvider>;
}
