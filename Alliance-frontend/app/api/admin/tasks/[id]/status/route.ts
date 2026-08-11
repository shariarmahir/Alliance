import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readTasks, updateTaskStatus } from "@/app/lib/admin-employees";
import { requireAdminSession, isSessionResponse } from "../../../_auth";

const StatusSchema = z.object({ status: z.enum(["pending", "in-progress", "completed"]) });

// PATCH /api/admin/tasks/[id]/status — both roles can call this: a sub-admin
// advancing their own assigned task is normal, but they may NOT update a
// task assigned to someone else (real per-employee authorization, not just
// a role check). Super admin may update any task.
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdminSession();
  if (isSessionResponse(session)) return session;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = StatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", fields: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  if (session.role === "sub") {
    const tasks = await readTasks();
    const task = tasks.find((t) => t.id === id);
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }
    if (task.assigneeEmployeeId !== session.employeeId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  try {
    const task = await updateTaskStatus(id, parsed.data.status);
    return NextResponse.json({ task });
  } catch {
    return NextResponse.json({ error: "Task not found" }, { status: 404 });
  }
}
