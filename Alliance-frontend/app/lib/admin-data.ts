import { api, getOrDefault } from "@/app/lib/api-client";
import type {
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

export type GmailStatus = {
  configured: boolean;
  connected: boolean;
  email: string | null;
  connectedAt?: string | null;
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

export async function readGmailStatus(): Promise<GmailStatus> {
  return getOrDefault<GmailStatus>(
    "/api/admin/emails/status",
    { configured: false, connected: false, email: null },
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

export { api };
