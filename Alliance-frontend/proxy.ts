import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ADMIN_SESSION_COOKIE, parseAdminSession, landingPathForRole } from "@/app/lib/admin-auth";

// Prefix-matched: pathname === prefix OR pathname starts with `${prefix}/`.
// Safe to add new entries here freely — each is scoped to its own subtree.
const SUB_ADMIN_ALLOWED_PREFIXES = [
  "/admin/products",
  "/admin/stock",
  "/admin/hero-images",
  "/admin/tasks",
  "/admin/leave",
  "/admin/daily-report",
];

// Exact-match ONLY — never prefix-matched. This is deliberately a separate
// list from SUB_ADMIN_ALLOWED_PREFIXES: `/admin` is now a legitimate
// sub-admin destination (their personal dashboard, role-branched inside the
// page itself), but it must NOT become a prefix match, or every other
// super-only path under /admin/* (e.g. /admin/orders, /admin/employees)
// would incorrectly match `pathname.startsWith("/admin/")` and reopen the
// exact RBAC bypass bug Phase 1 fixed. Only the bare path is allowed here.
const SUB_ADMIN_ALLOWED_EXACT = ["/admin"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = parseAdminSession(request.cookies.get(ADMIN_SESSION_COOKIE)?.value);

  if (!session) {
    const loginUrl = new URL("/admin/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (session.role === "sub") {
    const allowed =
      SUB_ADMIN_ALLOWED_EXACT.includes(pathname) ||
      SUB_ADMIN_ALLOWED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
    if (!allowed) {
      return NextResponse.redirect(new URL(landingPathForRole("sub"), request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/((?!login).*)"],
};
