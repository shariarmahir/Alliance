import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_SESSION_COOKIE, parseAdminSession } from "@/app/lib/admin-auth";
import { readTasks } from "@/app/lib/admin-employees";
import { TasksClient } from "./tasks-client";

// Sub-admin's own task board. Super admin visiting this URL is redirected to
// the Employees -> Tasks tab instead, since that page already covers the
// all-employees task view — avoids a duplicate UI, per the Phase 4 spec.
export default async function TasksPage() {
  const cookieStore = await cookies();
  const session = await parseAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) redirect("/admin/login");

  if (session.role === "super") {
    redirect("/admin/employees?tab=tasks");
  }

  const allTasks = await readTasks();
  const myTasks = session.employeeId ? allTasks.filter((t) => t.assigneeEmployeeId === session.employeeId) : [];

  return <TasksClient initialTasks={[...myTasks]} />;
}
