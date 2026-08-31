import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_SESSION_COOKIE, parseAdminSession } from "@/app/lib/session-token";
import {
  readRangeAnalytics,
  readPaymentAnalytics,
  type AnalyticsRange,
} from "@/app/lib/admin-data";
import { formatPrice } from "@/app/lib/utils";
import { RangeToggle } from "./range-toggle";
import { StatCard } from "./stat-card";
import { RevenueChart } from "./charts/revenue-chart";
import { DeletedRevenueChart } from "./charts/deleted-revenue-chart";
import { BestSellersCard } from "./best-sellers-card";
import { SubAdminDashboard } from "./sub-admin-dashboard";
import {
  TopDestinationsPanel,
  OrderRatioPanel,
  WarehouseAlertsPanel,
} from "./overview-panels";
import { PendingQuotationsPanel } from "./pending-quotations-panel";
import { PaymentSplit } from "./payment-split";
import { MarketWatchPanel, StockStatusPanel } from "./market-panels";

// /admin is role-branching as of Phase 4: super admin keeps the analytics
// Overview below, sub-admin sees their personal dashboard instead of being
// redirected away.
const RANGE_LABEL: Record<AnalyticsRange, string> = {
  week: "last 7 days",
  month: "last 30 days",
  year: "last 12 months",
};

function parseRange(value: string | undefined): AnalyticsRange {
  return value === "week" || value === "year" ? value : "month";
}

// Renders a delta as a signed percentage, or a neutral note when the previous
// period had no activity to compare against (deltaPct returns null then).
function deltaNote(deltaPct: number | null, rangeLabel: string): string {
  if (deltaPct === null) return `vs no activity in the previous ${rangeLabel}`;
  const arrow = deltaPct > 0 ? "↑" : deltaPct < 0 ? "↓" : "→";
  return `${arrow} ${Math.abs(deltaPct)}% vs previous ${rangeLabel}`;
}

export default async function AdminOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const cookieStore = await cookies();
  const session = await parseAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) redirect("/admin/login");

  if (session.role === "sub") {
    return <SubAdminDashboard session={session} />;
  }

  const range = parseRange((await searchParams).range);
  const [analytics, payments] = await Promise.all([
    readRangeAnalytics(range),
    readPaymentAnalytics(range),
  ]);
  const rangeLabel = RANGE_LABEL[range];
  // Both trends are built from the same buckets for the same range, so they
  // align index-for-index and share the label.
  const revenueChartData = analytics.revenueTrend.map((point, i) => ({
    label: point.label,
    revenue: point.value,
    pending: payments.pendingTrend[i]?.value ?? 0,
  }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="mb-1 text-[21px] font-bold tracking-[-0.02em] text-ink sm:text-[26px]">Overview</h1>
          <p className="text-[13px] text-[#64748b]">
            Business performance at a glance · {rangeLabel}
          </p>
        </div>
        <RangeToggle active={range} />
      </div>

      <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Revenue"
          value={formatPrice(analytics.revenue)}
          note={deltaNote(analytics.revenueDeltaPct, rangeLabel)}
          tone="primary"
          trend={analytics.revenueTrend.map((p) => p.value)}
        />
        <StatCard
          label="Orders"
          value={analytics.orderCount.toString()}
          note={deltaNote(analytics.orderCountDeltaPct, rangeLabel)}
          tone="accent"
          trend={analytics.orderTrend.map((p) => p.value)}
        />
        <StatCard
          label="Price requests"
          value={analytics.quotationCount.toString()}
          note={deltaNote(analytics.quotationCountDeltaPct, rangeLabel)}
          tone="terracotta"
          trend={analytics.quotationTrend.map((p) => p.value)}
        />
        <StatCard
          label="Active clients"
          value={analytics.activeClients.toString()}
          note={deltaNote(analytics.activeClientsDeltaPct, rangeLabel)}
          tone="emerald"
          trend={analytics.orderTrend.map((p) => p.value)}
        />
      </div>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[1.55fr_1fr]">
        <div className="min-w-0 space-y-4">
          <RevenueChart
            data={revenueChartData}
            caption={`${RANGE_LABEL[range][0].toUpperCase()}${RANGE_LABEL[range].slice(1)} · BDT`}
          />
          {/* Revenue is what was sold; this splits the same money into what
              has actually been collected and what is still owed. Sits under
              the chart because it reads as a breakdown of that figure, and
              links to Orders, where payment is recorded. */}
          <PaymentSplit
            received={payments.received}
            receivedCount={payments.receivedCount}
            pending={payments.pending}
            pendingCount={payments.pendingCount}
            rangeLabel={rangeLabel}
          />
          {/* Only once something has actually been deleted. A permanent
              zeroed chart would imply deletions are a routine part of the
              month rather than the exception they are. */}
          {analytics.deletedOrderCount > 0 && (
            <DeletedRevenueChart
              data={analytics.deletedRevenueTrend.map((point) => ({
                label: point.label,
                deleted: point.value,
              }))}
              total={analytics.deletedRevenue}
              count={analytics.deletedOrderCount}
              caption={`${RANGE_LABEL[range][0].toUpperCase()}${RANGE_LABEL[range].slice(1)} · BDT`}
            />
          )}
        </div>
        {/* The right column tracks the market this business buys and sells
            into, beside its own conversion. Both are read-only context for
            the figures on the left. */}
        <div className="flex min-w-0 flex-col gap-4">
          <OrderRatioPanel />
          <MarketWatchPanel />
          <StockStatusPanel />
        </div>
      </div>

      <div className="grid min-w-0 gap-4 xl:grid-cols-[1.3fr_1fr]">
        <div className="flex min-w-0 flex-col gap-4">
          <PendingQuotationsPanel />
          <TopDestinationsPanel />
        </div>
        <div className="flex min-w-0 flex-col gap-4">
          <BestSellersCard />
          <WarehouseAlertsPanel />
        </div>
      </div>
    </div>
  );
}
