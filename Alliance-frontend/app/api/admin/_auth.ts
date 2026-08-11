import "server-only";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { ADMIN_SESSION_COOKIE, parseAdminSession } from "@/app/lib/admin-auth";
import type { AdminSession } from "@/app/lib/types";

// Shared session check for admin Route Handlers. All five admin write routes
// (products, products/bulk, products/[slug]/stock, categories, hero-images)
// are in the sub-admin allowlist per the phase 2 spec, so any authenticated
// admin (super or sub) may call them — only missing/invalid session is rejected.
export async function requireAdminSession(): Promise<AdminSession | NextResponse> {
  const cookieStore = await cookies();
  const session = parseAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return session;
}

export function isSessionResponse(value: AdminSession | NextResponse): value is NextResponse {
  return value instanceof NextResponse;
}

// Stricter check for Phase 3's operations routes (orders, quotations,
// contact requests, emails), which are super-admin-only per the spec —
// unlike Phase 2's product/catalog routes, which any authenticated admin
// (super or sub) may call. 401 if no session, 403 if role is "sub".
export async function requireSuperAdminSession(): Promise<AdminSession | NextResponse> {
  const session = await requireAdminSession();
  if (isSessionResponse(session)) return session;
  if (session.role !== "super") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return session;
}
