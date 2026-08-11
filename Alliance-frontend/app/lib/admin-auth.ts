import "server-only";
import type { AdminRole, AdminSession } from "@/app/lib/types";

export const ADMIN_SESSION_COOKIE = "alliance_admin_session";

// MOCK ACCOUNTS — replace with real backend authentication before production.
const ADMIN_ACCOUNTS: { email: string; password: string; role: AdminRole; name: string }[] = [
  { email: "nurulislam@gmail.com", password: "superpassword", role: "super", name: "Nurul Islam" },
  { email: "subadmin@gmail.com", password: "subpassword", role: "sub", name: "Sub Admin" },
];

export function verifyAdminCredentials(email: string, password: string): AdminSession | null {
  const account = ADMIN_ACCOUNTS.find(
    (a) => a.email.toLowerCase() === email.trim().toLowerCase() && a.password === password
  );
  if (!account) return null;
  return { role: account.role, name: account.name, email: account.email };
}

export function landingPathForRole(role: AdminRole): string {
  return role === "super" ? "/admin" : "/admin/products";
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
