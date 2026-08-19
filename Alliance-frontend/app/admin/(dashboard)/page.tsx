import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_SESSION_COOKIE, parseAdminSession } from "@/app/lib/admin-auth";
import { readRangeAnalytics, type AnalyticsRange } from "@/app/lib/admin-analytics";
import { formatPrice } from "@/app/lib/utils";
import { RangeToggle } from "./range-toggle";
import { StatCard } from "./stat-card";
import { RevenueChart } from "./charts/revenue-chart";
import { TrafficChart } from "./charts/traffic-chart";
import { BestSellersCard } from "./best-sellers-card";
import { SubAdminDashboard } from "./sub-admin-dashboard";
import {
  OrderSourcesPanel,
  TopDestinationsPanel,
  OrderRatioPanel,
  WarehouseAlertsPanel,
} from "./overview-panels";
import { PendingQuotationsPanel } from "./pending-quotations-panel";

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
  const session = parseAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) redirect("/admin/login");

  if (session.role === "sub") {
    return <SubAdminDashboard session={session} />;
  }

  const range = parseRange((await searchParams).range);
  const analytics = await readRangeAnalytics(range);
  const rangeLabel = RANGE_LABEL[range];
  const revenueChartData = analytics.revenueTrend.map((point, i) => ({
    label: point.label,
    revenue: point.value,
    orders: analytics.orderTrend[i]?.value ?? 0,
  }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="mb-1 text-[26px] font-bold tracking-[-0.02em] text-ink">Overview</h1>
          <p className="text-[13px] text-[#64748b]">
            Business performance at a glance · {rangeLabel}
          </p>
        </div>
        <RangeToggle active={range} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
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

      <div className="grid gap-4 xl:grid-cols-[1.55fr_1fr]">
        <RevenueChart
          data={revenueChartData}
          caption={`${RANGE_LABEL[range][0].toUpperCase()}${RANGE_LABEL[range].slice(1)} · BDT`}
        />
        <OrderRatioPanel />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <OrderSourcesPanel />
        <TopDestinationsPanel />
        <TrafficChart />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
        <PendingQuotationsPanel />
        <div className="flex flex-col gap-4">
          <BestSellersCard />
          <WarehouseAlertsPanel />
        </div>
      </div>
    </div>
  );
}
