import type { QuoteRequest, Order } from "./types";

const QUOTE_PREFIX = "alliance_quote_";
const ORDER_PREFIX = "alliance_order_";

export function saveQuote(quote: QuoteRequest): void {
  sessionStorage.setItem(QUOTE_PREFIX + quote.id, JSON.stringify(quote));
}

export function loadQuote(id: string): QuoteRequest | null {
  const raw = sessionStorage.getItem(QUOTE_PREFIX + id);
  return raw ? (JSON.parse(raw) as QuoteRequest) : null;
}

export function saveOrder(order: Order): void {
  sessionStorage.setItem(ORDER_PREFIX + order.orderNumber, JSON.stringify(order));
}

export function loadOrder(orderNumber: string): Order | null {
  const raw = sessionStorage.getItem(ORDER_PREFIX + orderNumber);
  return raw ? (JSON.parse(raw) as Order) : null;
}
