import { NextRequest, NextResponse } from "next/server";
import { searchAdmin } from "@/app/lib/admin-search";
import { requireAdminSession, isSessionResponse } from "../_auth";

// GET /api/admin/search?q= — topbar search. Any authenticated admin may call
// it; searchAdmin scopes the results to what this session can actually open.
export async function GET(request: NextRequest) {
  const session = await requireAdminSession();
  if (isSessionResponse(session)) return session;

  const query = request.nextUrl.searchParams.get("q") ?? "";
  const results = await searchAdmin(query, session);
  return NextResponse.json({ results });
}
