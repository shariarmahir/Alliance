import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { addTask, readEmployees } from "@/app/lib/admin-employees";
import { requireSuperAdminSession, isSessionResponse } from "../_auth";
import type { Task } from "@/app/lib/types";

const CreateTaskSchema = z.object({
  title: z.string().trim().min(1, "Title is required."),
  description: z.string().trim().min(1, "Description is required."),
  assigneeEmployeeId: z.string().trim().min(1, "Assignee is required."),
  dueDate: z.string().trim().min(1, "Due date is required."),
});

// POST /api/admin/tasks — super-admin-only, assigns a task to an employee.
export async function POST(request: NextRequest) {
  const session = await requireSuperAdminSession();
  if (isSessionResponse(session)) return session;

  const body = await request.json().catch(() => null);
  const parsed = CreateTaskSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", fields: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { title, description, assigneeEmployeeId, dueDate } = parsed.data;

  const employees = await readEmployees();
  if (!employees.some((e) => e.id === assigneeEmployeeId)) {
    return NextResponse.json({ error: "Assignee employee not found." }, { status: 400 });
  }

  const task: Task = {
    id: crypto.randomUUID(),
    title,
    description,
    assigneeEmployeeId,
    dueDate,
    status: "pending",
    createdAt: new Date().toISOString(),
  };

  await addTask(task);

  return NextResponse.json({ task }, { status: 201 });
}
