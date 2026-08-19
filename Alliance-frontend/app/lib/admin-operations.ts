import "server-only";
import { readBlobJson, writeBlobJson } from "./blob-store";
import type {
  Order,
  Quotation,
  ContactRequest,
  OrderStatus,
  QuotationStatus,
  MockEmail,
  OrderConfirmation,
} from "./types";

// Server-only read/write layer for Phase 3 (orders, quotations, contact
// requests, mock emails) — mirrors app/lib/admin-catalog.ts's pattern.
//
// Every export here is an async function, calling fresh on every
// request/invocation via Vercel Blob (see app/lib/blob-store.ts) — no
// module-level cache to go stale, same reasoning mock-data.ts's Proxies
// solved differently for its own module.

async function readJsonFile<T>(filename: string): Promise<T> {
  return readBlobJson<T>(filename);
}

async function writeJsonFile<T>(filename: string, data: T): Promise<void> {
  await writeBlobJson(filename, data);
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export async function readOrders(): Promise<Order[]> {
  return readJsonFile<Order[]>("orders.json");
}

export async function writeOrders(orders: Order[]): Promise<void> {
  await writeJsonFile("orders.json", orders);
}

export async function addOrder(order: Order): Promise<void> {
  const orders = await readOrders();
  orders.push(order);
  await writeOrders(orders);
}

export async function updateOrderStatus(orderNumber: string, status: OrderStatus): Promise<Order> {
  const orders = await readOrders();
  const order = orders.find((o) => o.orderNumber === orderNumber);
  if (!order) throw new Error(`Order not found: ${orderNumber}`);
  order.status = status;
  await writeOrders(orders);
  return order;
}

// ---------------------------------------------------------------------------
// Quotations
// ---------------------------------------------------------------------------

export async function readQuotations(): Promise<Quotation[]> {
  return readJsonFile<Quotation[]>("quotations.json");
}

export async function writeQuotations(quotations: Quotation[]): Promise<void> {
  await writeJsonFile("quotations.json", quotations);
}

export async function addQuotation(quotation: Quotation): Promise<void> {
  const quotations = await readQuotations();
  quotations.push(quotation);
  await writeQuotations(quotations);
}

export async function updateQuotationStatus(id: string, status: QuotationStatus): Promise<Quotation> {
  const quotations = await readQuotations();
  const quotation = quotations.find((q) => q.id === id);
  if (!quotation) throw new Error(`Quotation not found: ${id}`);
  quotation.status = status;
  // Moving off "confirmed" retracts the issued document — leaving it behind
  // would let a cancelled quotation still serve a downloadable confirmation.
  if (status !== "confirmed") delete quotation.confirmation;
  await writeQuotations(quotations);
  return quotation;
}

export async function readQuotation(id: string): Promise<Quotation | undefined> {
  const quotations = await readQuotations();
  return quotations.find((q) => q.id === id);
}

// Resolves a customer-facing tracking ID to the confirmed quotation that owns
// it. Tracking IDs are minted at confirmation time (see generateTrackingId in
// order-confirmation.ts), so only confirmed quotations are reachable — an
// unknown or unissued ID returns undefined and the page renders "not found"
// rather than inventing a status.
export async function findByTrackingId(trackingId: string): Promise<Quotation | undefined> {
  const quotations = await readQuotations();
  const wanted = trackingId.trim().toUpperCase();
  return quotations.find((q) => q.confirmation?.trackingId.toUpperCase() === wanted);
}

// Advances the delivery stage on a confirmed quotation. Stage indexes match
// DELIVERY_STAGES in app/lib/delivery.ts.
export async function updateDeliveryStage(trackingId: string, stage: number): Promise<Quotation> {
  const quotations = await readQuotations();
  const wanted = trackingId.trim().toUpperCase();
  const quotation = quotations.find((q) => q.confirmation?.trackingId.toUpperCase() === wanted);
  if (!quotation?.confirmation) throw new Error(`Tracking ID not found: ${trackingId}`);
  quotation.confirmation.deliveryStage = stage;
  quotation.confirmation.deliveryUpdatedAt = new Date().toISOString();
  await writeQuotations(quotations);
  return quotation;
}

// Issues the order confirmation: stores the admin's priced lines and flips the
// quotation to confirmed in one write, so the two can never disagree.
export async function confirmQuotation(
  id: string,
  confirmation: OrderConfirmation
): Promise<Quotation> {
  const quotations = await readQuotations();
  const quotation = quotations.find((q) => q.id === id);
  if (!quotation) throw new Error(`Quotation not found: ${id}`);
  quotation.status = "confirmed";
  quotation.confirmation = confirmation;
  await writeQuotations(quotations);
  return quotation;
}

// Sequence for the human-facing Ref number — count of confirmations already
// issued, so refs increment across the business rather than per customer.
export async function nextConfirmationSequence(): Promise<number> {
  const quotations = await readQuotations();
  return quotations.filter((q) => q.confirmation).length + 1;
}

// ---------------------------------------------------------------------------
// Contact requests
// ---------------------------------------------------------------------------

export async function readContactRequests(): Promise<ContactRequest[]> {
  return readJsonFile<ContactRequest[]>("contact-requests.json");
}

export async function writeContactRequests(requests: ContactRequest[]): Promise<void> {
  await writeJsonFile("contact-requests.json", requests);
}

export async function addContactRequest(request: ContactRequest): Promise<void> {
  const requests = await readContactRequests();
  requests.push(request);
  await writeContactRequests(requests);
}

export async function markContactRequestHandled(id: string, handled: boolean): Promise<ContactRequest> {
  const requests = await readContactRequests();
  const request = requests.find((r) => r.id === id);
  if (!request) throw new Error(`Contact request not found: ${id}`);
  request.handled = handled;
  await writeContactRequests(requests);
  return request;
}

// ---------------------------------------------------------------------------
// Mock emails (read-only preview data, seeded — no admin writes to this file
// beyond the initial seed in data/emails.json)
// ---------------------------------------------------------------------------

export async function readEmails(): Promise<MockEmail[]> {
  return readJsonFile<MockEmail[]>("emails.json");
}
