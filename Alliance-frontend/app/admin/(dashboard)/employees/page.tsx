import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_SESSION_COOKIE, parseAdminSession, landingPathForRole } from "@/app/lib/admin-auth";
import { readEmployees, readTasks, readLeaveRequests, readDailyReports } from "@/app/lib/admin-employees";
import { EmployeesClient } from "./employees-client";

const VALID_TABS = new Set(["roster", "tasks", "leave", "reports"]);

// Super-admin-only. Supports deep-linking to a specific tab via ?tab=, used
// by the Task Desk and Daily Report pages when a super admin visits them
// (they're redirected here to the corresponding tab instead of seeing a
// duplicate UI).
export default async function EmployeesPage({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const cookieStore = await cookies();
  const session = parseAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) redirect("/admin/login");
  if (session.role !== "super") redirect(landingPathForRole(session.role));

  const { tab } = await searchParams;
  const initialTab = tab && VALID_TABS.has(tab) ? tab : "roster";

  const [employees, tasks, leaveRequests, dailyReports] = await Promise.all([
    readEmployees(),
    readTasks(),
    readLeaveRequests(),
    readDailyReports(),
  ]);

  return (
    <EmployeesClient
      employees={[...employees]}
      tasks={[...tasks]}
      leaveRequests={[...leaveRequests]}
      dailyReports={[...dailyReports]}
      initialTab={initialTab}
    />
  );
}
