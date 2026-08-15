import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_SESSION_COOKIE, parseAdminSession } from "@/app/lib/admin-auth";
import { navGroupsForRole } from "@/app/admin/nav-config";
import { AdminShell } from "@/app/admin/admin-shell";
import { readProducts } from "@/app/lib/admin-catalog";
import { readOrders, readQuotations, readContactRequests } from "@/app/lib/admin-operations";
import type { AdminNavCounts } from "@/app/admin/nav-config";

export default async function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const session = parseAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) redirect("/admin/login");

  // Sidebar counts are read here (server) and passed down, so the nav numbers
  // match what the screens themselves show. They were previously hardcoded to
  // the design mockup's figures (1,284 products / 9 orders / 37 quotations),
  // which contradicted the real data on every screen.
  // Sub-admins can't reach orders, quotations or contact requests, so those
  // files aren't read for them at all.
  const superAdmin = session.role === "super";
  const [products, orders, quotations, contactRequests] = await Promise.all([
    readProducts(),
    superAdmin ? readOrders() : [],
    superAdmin ? readQuotations() : [],
    superAdmin ? readContactRequests() : [],
  ]);

  const counts: AdminNavCounts = {
    products: products.length,
    lowStock: products.filter((p) => p.stock !== "in-stock").length,
    pendingOrders: orders.filter((o) => o.status === "pending").length,
    pendingQuotations: quotations.filter((q) => q.status === "pending").length,
    openContactRequests: contactRequests.filter((r) => !r.handled).length,
  };

  return (
    <AdminShell groups={navGroupsForRole(session.role)} session={session} counts={counts}>
      {children}
    </AdminShell>
  );
}
