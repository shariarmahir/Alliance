import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { updateLeaveStatus } from "@/app/lib/admin-employees";
import { requireSuperAdminSession, isSessionResponse } from "../../../_auth";

const StatusSchema = z.object({ status: z.enum(["approved", "rejected"]) });

// PATCH /api/admin/leave-requests/[id]/status — super-admin-only.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireSuperAdminSession();
  if (isSessionResponse(session)) return session;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = StatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", fields: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  try {
    const leaveRequest = await updateLeaveStatus(id, parsed.data.status);
    return NextResponse.json({ leaveRequest });
  } catch {
    return NextResponse.json({ error: "Leave request not found" }, { status: 404 });
  }
}
