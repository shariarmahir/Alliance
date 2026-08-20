import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { ADMIN_SESSION_COOKIE, parseAdminSession } from "@/app/lib/session-token";
import type { AccessArea } from "@/app/lib/types";

// Navigation-level gate only. Authorisation itself is the backend's job now —
// it rejects an unauthorised request regardless of which UI made it, so this
// no longer has to be the security boundary. What it still does is keep a
// sub-admin from landing on a page that would render nothing but 403s, which
// is a worse experience than a redirect.
//
// Because it is no longer the enforcement point, being wrong here degrades
// the UI rather than exposing data.

const ADMIN_LANDING = "/admin";

// Prefix-matched: pathname === prefix OR pathname starts with `${prefix}/`.
const SUB_ADMIN_ALLOWED_PREFIXES = [
  "/admin/products",
  "/admin/stock",
  "/admin/hero-images",
  "/admin/tasks",
  "/admin/leave",
  "/admin/daily-report",
];

// Exact-match ONLY — never prefix-matched. `/admin` is a legitimate sub-admin
// destination (their personal dashboard, role-branched inside the page), but
// as a prefix it would match every super-only path under /admin/*.
const SUB_ADMIN_ALLOWED_EXACT = ["/admin"];

// Gated behind a per-employee AccessArea grant, checked only after the fixed
// allowlists miss.
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
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }

  if (session.role === "sub") {
    const matches = (prefix: string) =>
      pathname === prefix || pathname.startsWith(`${prefix}/`);

    const allowed =
      SUB_ADMIN_ALLOWED_EXACT.includes(pathname) ||
      SUB_ADMIN_ALLOWED_PREFIXES.some(matches) ||
      SUB_ADMIN_GRANTABLE_PREFIXES.some(
        ({ prefix, area }) => matches(prefix) && (session.accessOptions ?? []).includes(area)
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
