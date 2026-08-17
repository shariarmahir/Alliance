import "server-only";
import { readEmployees } from "@/app/lib/admin-employees";
import type { AdminRole, AdminSession } from "@/app/lib/types";

export const ADMIN_SESSION_COOKIE = "autolink_admin_session";

// MOCK ACCOUNTS — replace with real backend authentication before production.
// These 2 hardcoded accounts must keep working unchanged for continuity with
// earlier phases' verification flows — Phase 4 only adds a fallback check
// against data/employees.json, never replaces this list.
const ADMIN_ACCOUNTS: { email: string; password: string; role: AdminRole; name: string }[] = [
  { email: "nurulislam@gmail.com", password: "superpassword", role: "super", name: "Nurul Islam" },
  { email: "subadmin@gmail.com", password: "subpassword", role: "sub", name: "Sub Admin" },
];

// Async because, as of Phase 4, a login that doesn't match a hardcoded
// account falls through to checking data/employees.json on disk.
export async function verifyAdminCredentials(email: string, password: string): Promise<AdminSession | null> {
  const normalizedEmail = email.trim().toLowerCase();
  const account = ADMIN_ACCOUNTS.find((a) => a.email.toLowerCase() === normalizedEmail && a.password === password);
  if (account) {
    return { role: account.role, name: account.name, email: account.email };
  }

  const employees = await readEmployees();
  const employee = employees.find((e) => e.email.toLowerCase() === normalizedEmail && e.password === password);
  if (!employee) return null;
  return {
    role: "sub",
    name: employee.name,
    email: employee.email,
    employeeId: employee.id,
    accessOptions: employee.accessOptions,
  };
}

// /admin is role-branching as of Phase 4: super admin sees the analytics
// Overview, sub-admin sees their personal dashboard. Both roles land here.
// Signature keeps the `role` param (unused for now) so call sites don't need
// to change if a role-specific landing path is ever reintroduced.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function landingPathForRole(role: AdminRole): string {
  return "/admin";
}

export function parseAdminSession(raw: string | undefined): AdminSession | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (
      (parsed.role === "super" || parsed.role === "sub") &&
      typeof parsed.name === "string" &&
      typeof parsed.email === "string"
    ) {
      return parsed as AdminSession;
    }
    return null;
  } catch {
    return null;
  }
}
