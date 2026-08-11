import "server-only";
import fs from "fs/promises";
import path from "path";
import type { Order, Quotation, ContactRequest, OrderStatus, QuotationStatus, MockEmail } from "./types";

// Server-only read/write layer for Phase 3 (orders, quotations, contact
// requests, mock emails) — mirrors app/lib/admin-catalog.ts's pattern.
//
// Unlike mock-data.ts's Proxy-wrapped arrays (needed because that module's
// exports are imported and iterated directly all over the storefront), every
// export here is an async function. Callers (Server Component pages, Route
// Handlers) call these fresh on every request/invocation, so there is no
// module-level cache to go stale — the same problem mock-data.ts solved with
// Proxies, solved here simply by never caching in the first place.
//
// KNOWN LIMITATION: real filesystem writes under data/ — works in local dev
// and traditional Node hosting, not on read-only-filesystem serverless hosts.
// Same accepted tradeoff as Phase 2.

const DATA_DIR = path.join(process.cwd(), "data");

async function readJsonFile<T>(filename: string): Promise<T> {
  const raw = await fs.readFile(path.join(DATA_DIR, filename), "utf-8");
  return JSON.parse(raw);
}

async function writeJsonFile<T>(filename: string, data: T): Promise<void> {
  await fs.writeFile(path.join(DATA_DIR, filename), JSON.stringify(data, null, 2) + "\n");
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
  await writeQuotations(quotations);
  return quotation;
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
