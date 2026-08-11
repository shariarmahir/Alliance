import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { addLeaveRequest } from "@/app/lib/admin-employees";
import { requireAdminSession, isSessionResponse } from "../_auth";
import type { LeaveRequest } from "@/app/lib/types";

const CreateLeaveRequestSchema = z
  .object({
    startDate: z.string().trim().min(1, "Start date is required."),
    endDate: z.string().trim().min(1, "End date is required."),
    reason: z.string().trim().min(1, "Reason is required."),
  })
  .refine((data) => data.endDate >= data.startDate, {
    message: "End date must be on or after the start date.",
    path: ["endDate"],
  });

// POST /api/admin/leave-requests — both roles may call this, but employeeId
// is always derived from the session, never trusted from the client, so an
// employee cannot file a leave request as someone else.
export async function POST(request: NextRequest) {
  const session = await requireAdminSession();
  if (isSessionResponse(session)) return session;

  if (!session.employeeId) {
    return NextResponse.json({ error: "This account has no employee record to file leave under." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = CreateLeaveRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", fields: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { startDate, endDate, reason } = parsed.data;

  const leaveRequest: LeaveRequest = {
    id: crypto.randomUUID(),
    employeeId: session.employeeId,
    startDate,
    endDate,
    reason,
    status: "pending",
    submittedAt: new Date().toISOString(),
  };

  await addLeaveRequest(leaveRequest);

  return NextResponse.json({ leaveRequest }, { status: 201 });
}
