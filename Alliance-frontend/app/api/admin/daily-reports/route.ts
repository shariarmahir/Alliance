import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { addDailyReport } from "@/app/lib/admin-employees";
import { requireAdminSession, isSessionResponse } from "../_auth";
import type { DailyReport } from "@/app/lib/types";

const CreateDailyReportSchema = z.object({
  date: z.string().trim().min(1, "Date is required."),
  hoursWorked: z.coerce.number().min(0, "Hours worked must be a non-negative number.").max(24, "Hours worked cannot exceed 24."),
  summary: z.string().trim().min(1, "Summary is required."),
});

// POST /api/admin/daily-reports — sub-admin only, submitting their own
// report; employeeId derived from the session, same as leave requests.
export async function POST(request: NextRequest) {
  const session = await requireAdminSession();
  if (isSessionResponse(session)) return session;

  if (session.role !== "sub") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (!session.employeeId) {
    return NextResponse.json({ error: "This account has no employee record to report under." }, { status: 400 });
  }

  const body = await request.json().catch(() => null);
  const parsed = CreateDailyReportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", fields: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { date, hoursWorked, summary } = parsed.data;

  const report: DailyReport = {
    id: crypto.randomUUID(),
    employeeId: session.employeeId,
    date,
    hoursWorked,
    summary,
    submittedAt: new Date().toISOString(),
  };

  await addDailyReport(report);

  return NextResponse.json({ report }, { status: 201 });
}
