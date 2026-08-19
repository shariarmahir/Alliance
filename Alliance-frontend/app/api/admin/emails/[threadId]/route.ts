import { NextResponse } from "next/server";
import { getThreadDetail } from "@/app/lib/gmail-client";
import { requireAdminSession, isSessionResponse } from "../../_auth";

// GET /api/admin/emails/[threadId] — full body for one thread, fetched on
// selection rather than bundled into the list response (a full-body fetch
// per thread on every list load would be slow and mostly wasted).
export async function GET(_request: Request, { params }: { params: Promise<{ threadId: string }> }) {
  const session = await requireAdminSession();
  if (isSessionResponse(session)) return session;

  const { threadId } = await params;
  const detail = await getThreadDetail(threadId);
  if (!detail) {
    return NextResponse.json({ error: "Thread not found or mailbox not connected" }, { status: 404 });
  }
  return NextResponse.json({ thread: detail });
}
