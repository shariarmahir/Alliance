import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  readEmployees,
  addEmployee,
  updateEmployee,
  deleteEmployee,
  stripPassword,
} from "@/app/lib/admin-employees";
import { hashPassword } from "@/app/lib/admin-auth";
import { requireSuperAdminSession, isSessionResponse } from "../_auth";
import type { Employee } from "@/app/lib/types";

const DesignationSchema = z.enum([
  "sales-associate",
  "warehouse-staff",
  "support-agent",
  "catalog-manager",
  "other",
]);
const AccessAreaSchema = z.enum(["quotations", "orders", "emails", "contact-requests"]);

// 8 characters minimum: these accounts reach customer PII and pricing, and
// the login is public. The old 4-character floor allowed "1234".
const PasswordSchema = z.string().min(8, "Password must be at least 8 characters.");

const CreateEmployeeSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required."),
    email: z.string().trim().email("Enter a valid email."),
    password: PasswordSchema,
    employeeIdNumber: z.string().trim().min(1, "Employee ID is required."),
    designation: DesignationSchema,
    customDesignation: z.string().trim().max(60).optional(),
    accessOptions: z.array(AccessAreaSchema).default([]),
  })
  .refine((v) => v.designation !== "other" || Boolean(v.customDesignation), {
    message: "Enter a designation.",
    path: ["customDesignation"],
  });

const UpdateEmployeeSchema = z.object({
  id: z.string().min(1),
  name: z.string().trim().min(1).optional(),
  password: PasswordSchema.optional(),
  designation: DesignationSchema.optional(),
  customDesignation: z.string().trim().max(60).optional(),
  accessOptions: z.array(AccessAreaSchema).optional(),
  disabled: z.boolean().optional(),
});

// The bootstrap super admin lives in the environment, not the roster — a new
// employee must not claim that email or they would shadow the owner account.
function bootstrapEmail(): string | null {
  return process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase() ?? null;
}

// POST /api/admin/employees — super-admin-only, creates a real employee account.
export async function POST(request: NextRequest) {
  const session = await requireSuperAdminSession();
  if (isSessionResponse(session)) return session;

  const body = await request.json().catch(() => null);
  const parsed = CreateEmployeeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", fields: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { name, email, password, employeeIdNumber, designation, customDesignation, accessOptions } =
    parsed.data;
  const normalizedEmail = email.toLowerCase();

  if (normalizedEmail === bootstrapEmail()) {
    return NextResponse.json({ error: "This email is already in use." }, { status: 400 });
  }

  const employees = await readEmployees();
  if (employees.some((e) => e.email.toLowerCase() === normalizedEmail)) {
    return NextResponse.json({ error: "This email is already in use." }, { status: 400 });
  }
  if (employees.some((e) => e.employeeIdNumber.toLowerCase() === employeeIdNumber.toLowerCase())) {
    return NextResponse.json({ error: "This employee ID is already in use." }, { status: 400 });
  }

  const employee: Employee = {
    id: crypto.randomUUID(),
    employeeIdNumber,
    name,
    email,
    password: await hashPassword(password),
    designation,
    ...(designation === "other" && customDesignation ? { customDesignation } : {}),
    accessOptions,
    createdAt: new Date().toISOString(),
  };

  await addEmployee(employee);

  // stripPassword, not the raw record: the response used to echo the password
  // straight back to the browser.
  return NextResponse.json({ employee: stripPassword(employee) }, { status: 201 });
}

// PATCH /api/admin/employees — update access, reset a password, or disable an
// account. Without this there was no way to change or revoke staff access
// after creation.
export async function PATCH(request: NextRequest) {
  const session = await requireSuperAdminSession();
  if (isSessionResponse(session)) return session;

  const body = await request.json().catch(() => null);
  const parsed = UpdateEmployeeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", fields: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const { id, password, ...rest } = parsed.data;

  try {
    const updated = await updateEmployee(id, {
      ...rest,
      ...(password ? { password: await hashPassword(password) } : {}),
    });
    return NextResponse.json({ employee: stripPassword(updated) });
  } catch {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }
}

// DELETE /api/admin/employees?id=... — hard delete. Disabling via PATCH is
// usually the better choice; tasks and reports reference employees by id.
export async function DELETE(request: NextRequest) {
  const session = await requireSuperAdminSession();
  if (isSessionResponse(session)) return session;

  const id = request.nextUrl.searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "Missing employee id" }, { status: 400 });
  }

  const employees = await readEmployees();
  if (!employees.some((e) => e.id === id)) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }

  await deleteEmployee(id);
  return NextResponse.json({ ok: true });
}
