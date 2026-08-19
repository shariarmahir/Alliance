import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
// Imports the Edge-safe token module directly, NOT admin-auth.ts — the latter
// pulls in bcrypt and Blob-backed employee reads, neither of which can run in
// middleware.
import { ADMIN_SESSION_COOKIE, parseAdminSession } from "@/app/lib/session-token";
import type { AccessArea } from "@/app/lib/types";

// Inlined rather than imported from admin-auth.ts for the same reason.
const ADMIN_LANDING = "/admin";

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

// Prefixes gated behind a per-employee AccessArea grant rather than being
// open to every sub-admin by default. Checked only after the fixed
// allowlists above fail to match, so an employee with no grants still gets
// the normal sub-admin defaults (products, stock, tasks, leave, ...).
const SUB_ADMIN_GRANTABLE_PREFIXES: { prefix: string; area: AccessArea }[] = [
  { prefix: "/admin/quotations", area: "quotations" },
  { prefix: "/admin/orders", area: "orders" },
  { prefix: "/admin/emails", area: "emails" },
  { prefix: "/admin/contact-requests", area: "contact-requests" },
];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const session = await parseAdminSession(request.cookies.get(ADMIN_SESSION_COOKIE)?.value);

  if (!session) {
    const loginUrl = new URL("/admin/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (session.role === "sub") {
    const allowed =
      SUB_ADMIN_ALLOWED_EXACT.includes(pathname) ||
      SUB_ADMIN_ALLOWED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)) ||
      SUB_ADMIN_GRANTABLE_PREFIXES.some(
        ({ prefix, area }) =>
          (pathname === prefix || pathname.startsWith(`${prefix}/`)) &&
          (session.accessOptions ?? []).includes(area)
      );
    if (!allowed) {
      return NextResponse.redirect(new URL(ADMIN_LANDING, request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin", "/admin/((?!login).*)"],
};
