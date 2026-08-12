import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { DollarSign, ShoppingCart, FileClock, Users2 } from "lucide-react";
import { ADMIN_SESSION_COOKIE, parseAdminSession } from "@/app/lib/admin-auth";
import { kpiStats } from "@/app/lib/mock-analytics";
import { formatPrice } from "@/app/lib/utils";
import { StatCard } from "./stat-card";
import { RevenueChart } from "./charts/revenue-chart";
import { OrderRatioChart } from "./charts/order-ratio-chart";
import { CountryChart } from "./charts/country-chart";
import { TrafficChart } from "./charts/traffic-chart";
import { BestSellersCard } from "./best-sellers-card";
import { SubAdminDashboard } from "./sub-admin-dashboard";

// /admin is role-branching as of Phase 4: super admin keeps the analytics
// Overview below (unchanged JSX), sub-admin sees their personal dashboard
// instead of being redirected away.
export default async function AdminOverviewPage() {
  const cookieStore = await cookies();
  const session = parseAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) redirect("/admin/login");

  if (session.role === "sub") {
    return <SubAdminDashboard session={session} />;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Business performance at a glance. Figures below are mock data for preview purposes.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Revenue"
          value={formatPrice(kpiStats.totalRevenue.value)}
          deltaPct={kpiStats.totalRevenue.deltaPct}
          icon={DollarSign}
          tone="primary"
        />
        <StatCard
          label="Orders This Month"
          value={kpiStats.ordersThisMonth.value.toString()}
          deltaPct={kpiStats.ordersThisMonth.deltaPct}
          icon={ShoppingCart}
          tone="accent"
        />
        <StatCard
          label="Pending Quotations"
          value={kpiStats.pendingQuotations.value.toString()}
          deltaPct={kpiStats.pendingQuotations.deltaPct}
          icon={FileClock}
          tone="terracotta"
        />
        <StatCard
          label="Active Clients"
          value={kpiStats.activeClients.value.toString()}
          deltaPct={kpiStats.activeClients.deltaPct}
          icon={Users2}
          tone="emerald"
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <RevenueChart />
        </div>
        <OrderRatioChart />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TrafficChart />
        </div>
        <BestSellersCard />
      </div>

      <CountryChart />
    </div>
  );
}
