import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_SESSION_COOKIE, parseAdminSession } from "@/app/lib/session-token";
import { navGroupsForRole } from "@/app/admin/nav-config";
import { AdminShell } from "@/app/admin/admin-shell";

import { readNavCounts } from "@/app/lib/admin-data";

export default async function AdminDashboardLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const session = await parseAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) redirect("/admin/login");

  // Sidebar counts are read here (server) and passed down, so the nav numbers
  // match what the screens themselves show. They were previously hardcoded to
  // the design mockup's figures (1,284 products / 9 orders / 37 quotations),
  // which contradicted the real data on every screen.
  //
  // One counting call, not three listing calls. This layout re-renders on
  // every navigation, and it used to read every product, quotation and
  // contact request in full just to take .length of them -- and listing
  // quotations derives each order's delivery and payment position, three
  // more queries per row. The badges only ever needed the numbers, so the
  // backend counts them; areas this viewer cannot reach come back as zero.
  const counts = await readNavCounts();

  return (
    <AdminShell
      groups={navGroupsForRole(session.role, session.accessOptions ?? [])}
      session={session}
      counts={counts}
    >
      {children}
    </AdminShell>
  );
}
