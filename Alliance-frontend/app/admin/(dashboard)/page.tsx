import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_SESSION_COOKIE, parseAdminSession } from "@/app/lib/admin-auth";
import { kpiStats } from "@/app/lib/mock-analytics";
import { formatPrice } from "@/app/lib/utils";
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
export default async function AdminOverviewPage() {
  const cookieStore = await cookies();
  const session = parseAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) redirect("/admin/login");

  if (session.role === "sub") {
    return <SubAdminDashboard session={session} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="mb-1 text-[26px] font-bold tracking-[-0.02em] text-ink">Overview</h1>
          <p className="text-[13px] text-[#64748b]">
            Business performance at a glance · figures are mock data
          </p>
        </div>
        <div className="flex rounded-[9px] border border-slate-line bg-white p-1">
          <span className="px-4 py-2 text-[12.5px] font-medium text-[#64748b]">Week</span>
          <span className="rounded-md bg-ink px-4 py-2 text-[12.5px] font-semibold text-white">
            Month
          </span>
          <span className="px-4 py-2 text-[12.5px] font-medium text-[#64748b]">Year</span>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Revenue"
          value={formatPrice(kpiStats.totalRevenue.value)}
          note={`↑ ${kpiStats.totalRevenue.deltaPct}% vs last month`}
          tone="primary"
        />
        <StatCard
          label="Orders"
          value={kpiStats.ordersThisMonth.value.toString()}
          note={`↑ ${kpiStats.ordersThisMonth.deltaPct}% this month`}
          tone="accent"
        />
        <StatCard
          label="Open price requests"
          value={kpiStats.pendingQuotations.value.toString()}
          note="Quote within 4 working hours"
          negative
          tone="terracotta"
        />
        <StatCard
          label="Active clients"
          value={kpiStats.activeClients.value.toString()}
          note={`↑ ${kpiStats.activeClients.deltaPct}% this month`}
          tone="emerald"
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.55fr_1fr]">
        <RevenueChart />
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
