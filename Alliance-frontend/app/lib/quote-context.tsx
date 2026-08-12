"use client";

import { createContext, useContext, useSyncExternalStore, type ReactNode } from "react";
import type { Product, QuoteItem } from "@/app/lib/types";

type QuoteContextValue = {
  items: QuoteItem[];
  addItem: (product: Product, quantity?: number) => void;
  updateQty: (slug: string, quantity: number) => void;
  removeItem: (slug: string) => void;
  clear: () => void;
  count: number;
  total: number;
};

const STORAGE_KEY = "autolink_quote";
const EMPTY: QuoteItem[] = [];

const listeners = new Set<() => void>();
let cache: QuoteItem[] = EMPTY;
let cacheRaw: string | null = null;

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  window.addEventListener("storage", onStoreChange);
  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener("storage", onStoreChange);
  };
}

function getSnapshot(): QuoteItem[] {
  let raw: string | null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch {
    return EMPTY;
  }
  if (raw === cacheRaw) return cache;
  cacheRaw = raw;
  try {
    cache = raw ? JSON.parse(raw) : EMPTY;
  } catch {
    cache = EMPTY;
  }
  return cache;
}

function getServerSnapshot(): QuoteItem[] {
  return EMPTY;
}

function writeItems(items: QuoteItem[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch {
    // storage unavailable (private browsing, disabled) — cart just won't persist
  }
  cacheRaw = null; // force getSnapshot to re-read on next call
  listeners.forEach((l) => l());
}

const QuoteContext = createContext<QuoteContextValue | null>(null);

export function QuoteProvider({ children }: { children: ReactNode }) {
  const items = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function addItem(product: Product, quantity = 1) {
    const existing = items.find((x) => x.slug === product.slug);
    const next = existing
      ? items.map((x) => (x.slug === product.slug ? { ...x, quantity: x.quantity + quantity } : x))
      : [
          ...items,
          {
            slug: product.slug,
            partNumber: product.partNumber,
            name: product.name,
            brand: product.brand,
            image: product.image,
            price: product.price,
            quantity,
          },
        ];
    writeItems(next);
  }

  function updateQty(slug: string, quantity: number) {
    writeItems(items.map((x) => (x.slug === slug ? { ...x, quantity: Math.max(1, quantity) } : x)));
  }

  function removeItem(slug: string) {
    writeItems(items.filter((x) => x.slug !== slug));
  }

  function clear() {
    writeItems([]);
  }

  const count = items.reduce((sum, x) => sum + x.quantity, 0);
  const total = items.reduce((sum, x) => sum + x.price * x.quantity, 0);

  return (
    <QuoteContext.Provider value={{ items, addItem, updateQty, removeItem, clear, count, total }}>
      {children}
    </QuoteContext.Provider>
  );
}

export function useQuote(): QuoteContextValue {
  const ctx = useContext(QuoteContext);
  if (!ctx) {
    return { items: EMPTY, count: 0, total: 0, addItem() {}, updateQty() {}, removeItem() {}, clear() {} };
  }
  return ctx;
}
