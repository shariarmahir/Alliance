import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_SESSION_COOKIE, parseAdminSession } from "@/app/lib/session-token";
import { readEmployees, readLeaveRequests } from "@/app/lib/admin-data";
import { LeaveCalendar } from "./leave-calendar";
import { LeavePendingList } from "./leave-pending-list";
import { LeaveRequestForm } from "./leave-request-form";

// Shared view, unlike Tasks: sub-admin sees a request form + their own
// history; super admin sees the same calendar+approval view as the
// Employees -> Leave Requests tab. Leave approval is naturally a
// cross-employee calendar, so no split is needed here per the spec.
export default async function LeavePage() {
  const cookieStore = await cookies();
  const session = await parseAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) redirect("/admin/login");

  if (session.role === "super") {
    const [requests, employees] = await Promise.all([readLeaveRequests(), readEmployees()]);
    return (
      <div className="space-y-6">
        <div>
          <h1 className="mb-1 text-[23px] font-bold tracking-[-0.02em] text-ink">Leave Requests</h1>
          <p className="text-[13px] text-ink-muted">Review the leave calendar and approve or reject requests.</p>
        </div>
        <LeaveCalendar requests={[...requests]} employees={[...employees]} />
        <LeavePendingList requests={[...requests]} employees={[...employees]} />
      </div>
    );
  }

  const requests = await readLeaveRequests();
  const myRequests = session.employeeId ? requests.filter((r) => r.employeeId === session.employeeId) : [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="mb-1 text-[23px] font-bold tracking-[-0.02em] text-ink">Leave Requests</h1>
        <p className="text-[13px] text-ink-muted">Submit a leave request and track its approval status.</p>
      </div>
      <LeaveRequestForm myRequests={[...myRequests]} />
    </div>
  );
}
