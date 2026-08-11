import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_SESSION_COOKIE, parseAdminSession } from "@/app/lib/admin-auth";
import { navItemsForRole } from "@/app/admin/nav-config";
import { AdminSidebar } from "@/app/admin/admin-sidebar";
import { AdminTopbar } from "@/app/admin/admin-topbar";

export default async function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const session = parseAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) redirect("/admin/login");

  return (
    <div className="flex min-h-screen bg-muted/30">
      <AdminSidebar items={navItemsForRole(session.role)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <AdminTopbar session={session} />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
