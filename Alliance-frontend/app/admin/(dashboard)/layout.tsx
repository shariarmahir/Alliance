import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_SESSION_COOKIE, parseAdminSession } from "@/app/lib/admin-auth";
import { navGroupsForRole } from "@/app/admin/nav-config";
import { AdminShell } from "@/app/admin/admin-shell";

export default async function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const session = parseAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) redirect("/admin/login");

  return (
    <AdminShell groups={navGroupsForRole(session.role)} session={session}>
      {children}
    </AdminShell>
  );
}
