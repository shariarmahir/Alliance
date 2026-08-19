import "server-only";
import { readOrders, readQuotations } from "./admin-operations";
import type { Order, Quotation } from "./types";

// Real analytics derived from the order/quotation records, replacing the
// hardcoded figures in mock-analytics.ts for the Overview's KPI cards and
// revenue chart. Everything is computed per request from Blob storage — the
// dataset is small enough that bucketing in memory beats maintaining a
// rollup that could drift from the records it summarises.

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

// Buckets per range, and how far back each range's window reaches. A "week"
// is the last 7 days by day, a "month" the last 30, a "year" the last 12
// months — rolling windows rather than calendar-aligned, so the chart always
// has a full set of buckets regardless of today's date.
const RANGE_CONFIG: Record<AnalyticsRange, { buckets: number; unit: "day" | "month" }> = {
  week: { buckets: 7, unit: "day" },
  month: { buckets: 30, unit: "day" },
  year: { buckets: 12, unit: "month" },
};

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function startOfMonth(d: Date): Date {
  const copy = new Date(d);
  copy.setDate(1);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

// Bucket boundaries, oldest first, ending with the one containing `now`.
function bucketStarts(range: AnalyticsRange, now: Date): Date[] {
  const { buckets, unit } = RANGE_CONFIG[range];
  const starts: Date[] = [];
  for (let i = buckets - 1; i >= 0; i--) {
    if (unit === "day") {
      const d = startOfDay(now);
      d.setDate(d.getDate() - i);
      starts.push(d);
    } else {
      const d = startOfMonth(now);
      d.setMonth(d.getMonth() - i);
      starts.push(d);
    }
  }
  return starts;
}

function bucketLabel(date: Date, unit: "day" | "month"): string {
  return unit === "day"
    ? date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })
    : date.toLocaleDateString("en-GB", { month: "short" });
}

// Index of the bucket a timestamp falls into, or -1 when it predates the
// window. Buckets are contiguous, so the last start that is <= ts wins.
function bucketIndexFor(ts: number, starts: Date[]): number {
  let index = -1;
  for (let i = 0; i < starts.length; i++) {
    if (ts >= starts[i].getTime()) index = i;
    else break;
  }
  return index;
}

function windowStart(range: AnalyticsRange, now: Date): Date {
  return bucketStarts(range, now)[0];
}

// The equally sized window immediately before the current one, used for the
// "vs last period" deltas on the KPI cards.
function previousWindow(range: AnalyticsRange, now: Date): { from: number; to: number } {
  const currentStart = windowStart(range, now).getTime();
  const { buckets, unit } = RANGE_CONFIG[range];
  const prevStart = new Date(currentStart);
  if (unit === "day") prevStart.setDate(prevStart.getDate() - buckets);
  else prevStart.setMonth(prevStart.getMonth() - buckets);
  return { from: prevStart.getTime(), to: currentStart };
}

// null rather than 0 when there is no prior activity — "no basis for
// comparison" and "flat" are different claims, and the UI renders them
// differently.
function deltaPct(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

function orderTimestamp(order: Order): number {
  return new Date(order.placedAt).getTime();
}

function quotationTimestamp(quotation: Quotation): number {
  return new Date(quotation.details.submittedAt).getTime();
}

// Cancelled orders are excluded from revenue: they were never collected, so
// counting them would overstate every figure on the Overview.
function isRevenueOrder(order: Order): boolean {
  return order.status !== "cancelled";
}

export async function readRangeAnalytics(range: AnalyticsRange): Promise<RangeAnalytics> {
  const [orders, quotations] = await Promise.all([readOrders(), readQuotations()]);
  const now = new Date();
  const starts = bucketStarts(range, now);
  const { unit } = RANGE_CONFIG[range];
  const from = starts[0].getTime();
  const prev = previousWindow(range, now);

  const revenueTrend: TrendPoint[] = starts.map((d) => ({ label: bucketLabel(d, unit), value: 0 }));
  const orderTrend: TrendPoint[] = starts.map((d) => ({ label: bucketLabel(d, unit), value: 0 }));
  const quotationTrend: TrendPoint[] = starts.map((d) => ({ label: bucketLabel(d, unit), value: 0 }));

  let revenue = 0;
  let orderCount = 0;
  let prevRevenue = 0;
  let prevOrderCount = 0;
  const clients = new Set<string>();
  const prevClients = new Set<string>();

  for (const order of orders) {
    if (!isRevenueOrder(order)) continue;
    const ts = orderTimestamp(order);
    if (Number.isNaN(ts)) continue;

    if (ts >= from) {
      const i = bucketIndexFor(ts, starts);
      if (i >= 0) {
        revenueTrend[i].value += order.grandTotal;
        orderTrend[i].value += 1;
      }
      revenue += order.grandTotal;
      orderCount += 1;
      if (order.address?.name) clients.add(order.address.name.toLowerCase());
    } else if (ts >= prev.from && ts < prev.to) {
      prevRevenue += order.grandTotal;
      prevOrderCount += 1;
      if (order.address?.name) prevClients.add(order.address.name.toLowerCase());
    }
  }

  let quotationCount = 0;
  let prevQuotationCount = 0;
  for (const quotation of quotations) {
    const ts = quotationTimestamp(quotation);
    if (Number.isNaN(ts)) continue;

    if (ts >= from) {
      const i = bucketIndexFor(ts, starts);
      if (i >= 0) quotationTrend[i].value += 1;
      quotationCount += 1;
      const email = quotation.details.email?.toLowerCase();
      if (email) clients.add(email);
    } else if (ts >= prev.from && ts < prev.to) {
      prevQuotationCount += 1;
      const email = quotation.details.email?.toLowerCase();
      if (email) prevClients.add(email);
    }
  }

  return {
    range,
    revenue,
    revenueDeltaPct: deltaPct(revenue, prevRevenue),
    orderCount,
    orderCountDeltaPct: deltaPct(orderCount, prevOrderCount),
    quotationCount,
    quotationCountDeltaPct: deltaPct(quotationCount, prevQuotationCount),
    activeClients: clients.size,
    activeClientsDeltaPct: deltaPct(clients.size, prevClients.size),
    revenueTrend,
    orderTrend,
    quotationTrend,
  };
}
