import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_SESSION_COOKIE, parseAdminSession } from "@/app/lib/admin-auth";
import { readDailyReports } from "@/app/lib/admin-employees";
import { DailyReportForm } from "./daily-report-form";

// Sub-admin's own submission form + history. Super admin visiting this URL
// is redirected to the Employees -> Reports tab instead — this has no
// natural "shared" framing the way leave's calendar does, so it stays
// sub-admin-primary like Tasks, per the spec.
export default async function DailyReportPage() {
  const cookieStore = await cookies();
  const session = await parseAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) redirect("/admin/login");

  if (session.role === "super") {
    redirect("/admin/employees?tab=reports");
  }

  const reports = await readDailyReports();
  const myReports = session.employeeId ? reports.filter((r) => r.employeeId === session.employeeId) : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="mb-1 text-[23px] font-bold tracking-[-0.02em] text-ink">Daily Report</h1>
        <p className="text-[13px] text-ink-muted">Log your hours and a summary of today&apos;s work.</p>
      </div>
      <DailyReportForm myReports={[...myReports]} />
    </div>
  );
}
