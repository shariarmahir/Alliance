import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_SESSION_COOKIE, parseAdminSession } from "@/app/lib/session-token";
import { navGroupsForRole } from "@/app/admin/nav-config";
import { AdminShell } from "@/app/admin/admin-shell";

import { readContactRequests, readQuotations, readProducts } from "@/app/lib/admin-data";
import { MAX_STAGE } from "@/app/lib/delivery";
import type { AdminNavCounts } from "@/app/admin/nav-config";

export default async function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const session = await parseAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) redirect("/admin/login");

  // Sidebar counts are read here (server) and passed down, so the nav numbers
  // match what the screens themselves show. They were previously hardcoded to
  // the design mockup's figures (1,284 products / 9 orders / 37 quotations),
  // which contradicted the real data on every screen.
  // A sub-admin only reaches orders/quotations/contact-requests once granted
  // that AccessArea — read each file only when the viewer can actually see it,
  // same reasoning as the old superAdmin-only gate, just per-area now.
  const accessOptions = session.accessOptions ?? [];
  const canSee = (area: (typeof accessOptions)[number]) =>
    session.role === "super" || accessOptions.includes(area);
  const [products, quotations, contactRequests] = await Promise.all([
    readProducts(),
    canSee("quotations") || canSee("orders") ? readQuotations() : [],
    canSee("contact-requests") ? readContactRequests() : [],
  ]);

  const counts: AdminNavCounts = {
    products: products.length,
    lowStock: products.filter((p) => p.stock !== "in-stock").length,
    // Orders are confirmed quotations, so both badges come from the same
    // read. "Pending" for an order means it has not been delivered yet.
    pendingOrders: quotations.filter(
      (q) => q.status === "confirmed" && (q.confirmation?.deliveryStage ?? 0) < MAX_STAGE
    ).length,
    pendingQuotations: quotations.filter((q) => q.status === "pending").length,
    openContactRequests: contactRequests.filter((r) => !r.handled).length,
  };

  return (
    <AdminShell groups={navGroupsForRole(session.role, accessOptions)} session={session} counts={counts}>
      {children}
    </AdminShell>
  );
}
