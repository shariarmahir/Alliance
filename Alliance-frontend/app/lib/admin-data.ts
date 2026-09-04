import { api, getOrDefault } from "@/app/lib/api-client";
import type { AdminNavCounts } from "@/app/admin/nav-config";
import type {
  Brand,
  ContactRequest,
  DailyReport,
  LeaveRequest,
  Order,
  Product,
  Quotation,
  SafeEmployee,
  Task,
} from "@/app/lib/types";

// Admin reads for server components. Every call forwards the caller's session
// cookie (`auth: true`); the backend decides what that session may see, so a
// sub-admin hitting a super-only surface gets a 403 from the API rather than
// relying on this layer to filter.

export type AnalyticsRange = "week" | "month" | "year";

export type TrendPoint = { label: string; value: number };

export type RangeAnalytics = {
  range: AnalyticsRange;
  revenue: number;
  revenueDeltaPct: number | null;
  orderCount: number;
  orderCountDeltaPct: number | null;
  quotationCount: number;
  quotationCountDeltaPct: number | null;
  activeClients: number;
  activeClientsDeltaPct: number | null;
  revenueTrend: TrendPoint[];
  orderTrend: TrendPoint[];
  quotationTrend: TrendPoint[];
  // Orders destroyed by "Remove anyway", bucketed by when they were confirmed
  // rather than when they were deleted. Kept out of revenueTrend on purpose:
  // these are not sales, and netting them against income would understate the
  // period and make the two impossible to reconcile apart.
  deletedRevenue: number;
  deletedOrderCount: number;
  deletedRevenueTrend: TrendPoint[];
};

const EMPTY_ANALYTICS = (range: AnalyticsRange): RangeAnalytics => ({
  range,
  revenue: 0,
  revenueDeltaPct: null,
  orderCount: 0,
  orderCountDeltaPct: null,
  quotationCount: 0,
  quotationCountDeltaPct: null,
  activeClients: 0,
  activeClientsDeltaPct: null,
  revenueTrend: [],
  orderTrend: [],
  quotationTrend: [],
  deletedRevenue: 0,
  deletedOrderCount: 0,
  deletedRevenueTrend: [],
});

export async function readRangeAnalytics(range: AnalyticsRange): Promise<RangeAnalytics> {
  return getOrDefault<RangeAnalytics>(`/api/admin/analytics?range=${range}`, EMPTY_ANALYTICS(range), {
    auth: true,
  });
}

// Money in and money owed. `received` is what was actually collected in the
// range; `pending` is the full outstanding balance across every unpaid
// confirmed order, which is deliberately not windowed — an invoice issued
// last year is still owed today.
export type PaymentAnalytics = {
  range: AnalyticsRange;
  received: number;
  receivedDeltaPct: number | null;
  receivedCount: number;
  pending: number;
  pendingCount: number;
  receivedTrend: TrendPoint[];
  pendingTrend: TrendPoint[];
};

const EMPTY_PAYMENTS = (range: AnalyticsRange): PaymentAnalytics => ({
  range,
  received: 0,
  receivedDeltaPct: null,
  receivedCount: 0,
  pending: 0,
  pendingCount: 0,
  receivedTrend: [],
  pendingTrend: [],
});

export async function readPaymentAnalytics(
  range: AnalyticsRange
): Promise<PaymentAnalytics> {
  return getOrDefault<PaymentAnalytics>(
    `/api/admin/analytics/payments?range=${range}`,
    EMPTY_PAYMENTS(range),
    { auth: true }
  );
}

export type OrderRatioSlice = {
  status: "confirmed" | "pending" | "cancelled";
  count: number;
};

export async function readOrderRatio(): Promise<OrderRatioSlice[]> {
  return getOrDefault<OrderRatioSlice[]>("/api/admin/analytics/order-ratio", [], { auth: true });
}

// The sidebar badge numbers. Counted by the backend rather than derived here
// from full listings: the admin layout renders on every navigation, and
// reading every product, quotation and contact request just to call .length
// on them made each screen change wait on all three.
export async function readNavCounts(): Promise<AdminNavCounts> {
  return getOrDefault<AdminNavCounts>(
    "/api/admin/analytics/nav-counts",
    { products: 0, lowStock: 0, pendingOrders: 0, pendingQuotations: 0, openContactRequests: 0 },
    { auth: true }
  );
}

export type CountryBreakdown = { country: string; orders: number };

export async function readTopDestinations(): Promise<CountryBreakdown[]> {
  return getOrDefault<CountryBreakdown[]>("/api/admin/analytics/destinations", [], {
    auth: true,
  });
}

export type StockAlert = {
  partNumber: string;
  name: string;
  slug: string;
  quantity: number;
};

export async function readLowStock(): Promise<StockAlert[]> {
  return getOrDefault<StockAlert[]>("/api/admin/analytics/low-stock", [], { auth: true });
}

// Each of these returns [] when the caller lacks the grant, so a sub-admin's
// dashboard renders empty sections instead of failing the whole page.
export async function readProducts(): Promise<Product[]> {
  const data = await getOrDefault<{ items: Product[] }>(
    "/api/admin/products?page_size=100",
    { items: [] },
    { auth: true }
  );
  return data.items;
}

// readBrands, not getBrands: the public /api/brands endpoint omits
// productCount, which the admin Brands tab needs to gate deletion.
export async function readBrands(): Promise<Brand[]> {
  return getOrDefault<Brand[]>("/api/admin/brands", [], { auth: true });
}

export async function readQuotations(): Promise<Quotation[]> {
  return getOrDefault<Quotation[]>("/api/admin/quotations", [], { auth: true });
}

export async function readOrders(): Promise<Order[]> {
  return getOrDefault<Order[]>("/api/admin/orders", [], { auth: true });
}

export async function readContactRequests(): Promise<ContactRequest[]> {
  return getOrDefault<ContactRequest[]>("/api/admin/contact-requests", [], { auth: true });
}

export async function readEmployees(): Promise<SafeEmployee[]> {
  return getOrDefault<SafeEmployee[]>("/api/admin/employees", [], { auth: true });
}

export async function readTasks(): Promise<Task[]> {
  return getOrDefault<Task[]>("/api/admin/tasks", [], { auth: true });
}

export async function readLeaveRequests(): Promise<LeaveRequest[]> {
  return getOrDefault<LeaveRequest[]>("/api/admin/leave-requests", [], { auth: true });
}

export async function readDailyReports(): Promise<DailyReport[]> {
  return getOrDefault<DailyReport[]>("/api/admin/daily-reports", [], { auth: true });
}

export type SearchResult = {
  type: "order" | "quotation" | "product" | "client";
  id: string;
  title: string;
  subtitle: string;
  href: string;
};

export async function searchAdmin(query: string): Promise<SearchResult[]> {
  if (query.trim().length < 2) return [];
  return getOrDefault<SearchResult[]>(
    `/api/admin/search?q=${encodeURIComponent(query)}`,
    [],
    { auth: true }
  );
}

// The shared mailbox can be read over Gmail OAuth or plain IMAP, decided by
// what is configured on the server -- see Settings.mailbox_provider.
export type MailProvider = "gmail" | "imap" | "none";

export type MailboxStatus = {
  configured: boolean;
  connected: boolean;
  provider: MailProvider;
  email: string | null;
  connectedAt?: string | null;
  // Only set when an IMAP login failed, so the screen can say what the mail
  // server actually objected to instead of a generic failure.
  error?: string | null;
};

export type GmailThread = {
  id: string;
  threadId: string;
  from: string;
  subject: string;
  preview: string;
  receivedAt: string;
  unread: boolean;
};

export async function readMailboxStatus(): Promise<MailboxStatus> {
  return getOrDefault<MailboxStatus>(
    "/api/admin/emails/status",
    { configured: false, connected: false, provider: "none", email: null },
    { auth: true }
  );
}

export async function readEmails(): Promise<GmailThread[]> {
  const data = await getOrDefault<{ connected: boolean; threads: GmailThread[] }>(
    "/api/admin/emails",
    { connected: false, threads: [] },
    { auth: true }
  );
  return data.threads;
}

export async function readCategories() {
  return getOrDefault<{ slug: string; name: string; icon: string; productCount: number }[]>(
    "/api/admin/categories",
    [],
    { auth: true }
  );
}

export async function readHeroImages() {
  return getOrDefault<{ slot: number; path: string }[]>("/api/admin/hero-images", [], {
    auth: true,
  });
}

// --- Invoices & challans ----------------------------------------------------

export type InvoiceStatus =
  | "pending"
  | "submitted"
  | "partially_paid"
  | "paid"
  | "completed"
  | "cancelled";

export type ChallanStatus = "pending" | "dispatched" | "delivered" | "cancelled";

export type DocumentLine = {
  slug: string;
  name: string;
  specifications: string;
  unit: string;
  quantity: number;
};

export type InvoiceLine = DocumentLine & { unitPrice: number; total: number };

export type InvoicePayment = {
  id: string;
  amount: number;
  method: string;
  reference: string;
  note: string;
  receivedAt: string;
};

export type Invoice = {
  id: string;
  quotationId: string;
  invoiceNumber: string | null;
  invoiceDate: string;
  status: InvoiceStatus;
  subtotal: number;
  discount: number;
  taxRate: number;
  taxAmount: number;
  otherCharges: number;
  grandTotal: number;
  amountPaid: number;
  notes: string;
  createdAt: string;
  approvedAt: string | null;
  submittedAt: string | null;
  completedAt: string | null;
  lines: InvoiceLine[];
  payments: InvoicePayment[];
  customerName: string;
  refNumber: string;
  poNumber: string;
};

export type Challan = {
  id: string;
  quotationId: string;
  challanNumber: string | null;
  challanDate: string;
  status: ChallanStatus;
  deliveryAddress: string;
  vehicleNumber: string;
  driverInfo: string;
  receiverName: string;
  remarks: string;
  signedDocumentUrl: string | null;
  createdAt: string;
  approvedAt: string | null;
  dispatchedAt: string | null;
  deliveredAt: string | null;
  lines: DocumentLine[];
  customerName: string;
  refNumber: string;
  poNumber: string;
};

// Ordered → delivered → balance per line. This is what stops an admin
// over-shipping or double-billing when one order ships in several parts.
export type OrderBalanceLine = {
  slug: string;
  name: string;
  specifications: string;
  unit: string;
  unitPrice: number;
  ordered: number;
  delivered: number;
  invoiced: number;
  balance: number;
  uninvoiced: number;
};

export async function readInvoices(): Promise<Invoice[]> {
  return getOrDefault<Invoice[]>("/api/admin/invoices", [], { auth: true });
}

export async function readChallans(): Promise<Challan[]> {
  return getOrDefault<Challan[]>("/api/admin/challans", [], { auth: true });
}

// --- Market & stock -------------------------------------------------------

export type MarketPoint = { label: string; value: number };

// Columns and rows rather than named fields: CSE's four Top 10 tabs do not
// share a shape (Gainers reports Change %, Volume reports a share count), so
// each table carries its own headers and the cells stay strings, keeping
// CSE's own formatting intact.
export type MarketTable = { columns: string[]; rows: string[][] };

export type MarketStats = {
  issuesTraded: number;
  advanced: number;
  declined: number;
  unchanged: number;
  volume: number;
  issuedCap: number;
  valueInTaka: number;
  contractNumber: number;
  marketCap: number;
};

export type MarketSnapshot = {
  index: string;
  indices: string[];
  value: number;
  change: number;
  changePct: number;
  points: MarketPoint[];
  top: Record<string, MarketTable>;
  stats: MarketStats;
  fetchedAt: string | null;
};

export type StockStatusBreakdown = {
  inStock: number;
  lowStock: number;
  outOfStock: number;
  totalUnits: number;
  stockValue: number;
};

const EMPTY_MARKET = (index: string): MarketSnapshot => ({
  index,
  indices: [index],
  value: 0,
  change: 0,
  changePct: 0,
  points: [],
  top: {},
  stats: {
    issuesTraded: 0, advanced: 0, declined: 0, unchanged: 0,
    volume: 0, issuedCap: 0, valueInTaka: 0, contractNumber: 0, marketCap: 0,
  },
  fetchedAt: null,
});

// Defaults to an empty snapshot rather than throwing: this is scraped from a
// third party, and CSE being unreachable must not take the Overview's own
// revenue figures off the screen with it.
export async function readMarketSnapshot(index = "CSE50"): Promise<MarketSnapshot> {
  return getOrDefault<MarketSnapshot>(
    `/api/admin/analytics/market?index=${encodeURIComponent(index)}`,
    EMPTY_MARKET(index),
    { auth: true }
  );
}

export async function readStockStatus(): Promise<StockStatusBreakdown> {
  return getOrDefault<StockStatusBreakdown>(
    "/api/admin/analytics/stock-status",
    { inStock: 0, lowStock: 0, outOfStock: 0, totalUnits: 0, stockValue: 0 },
    { auth: true }
  );
}

export { api };
