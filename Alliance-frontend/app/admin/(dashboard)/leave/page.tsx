import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_SESSION_COOKIE, parseAdminSession } from "@/app/lib/admin-auth";
import { readLeaveRequests, readEmployees } from "@/app/lib/admin-employees";
import { LeaveCalendar } from "./leave-calendar";
import { LeavePendingList } from "./leave-pending-list";
import { LeaveRequestForm } from "./leave-request-form";

// Shared view, unlike Tasks: sub-admin sees a request form + their own
// history; super admin sees the same calendar+approval view as the
// Employees -> Leave Requests tab. Leave approval is naturally a
// cross-employee calendar, so no split is needed here per the spec.
export default async function LeavePage() {
  const cookieStore = await cookies();
  const session = parseAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) redirect("/admin/login");

  if (session.role === "super") {
    const [requests, employees] = await Promise.all([readLeaveRequests(), readEmployees()]);
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Leave Requests</h1>
          <p className="mt-1 text-sm text-muted-foreground">Review the leave calendar and approve or reject requests.</p>
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
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Leave Requests</h1>
        <p className="mt-1 text-sm text-muted-foreground">Submit a leave request and track its approval status.</p>
      </div>
      <LeaveRequestForm myRequests={[...myRequests]} />
    </div>
  );
}
