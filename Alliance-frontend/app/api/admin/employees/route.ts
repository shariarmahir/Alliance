import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { readEmployees, addEmployee } from "@/app/lib/admin-employees";
import { requireSuperAdminSession, isSessionResponse } from "../_auth";
import type { Employee } from "@/app/lib/types";

// MOCK ACCOUNTS check must stay in sync with app/lib/admin-auth.ts's hardcoded
// list — a new employee must not collide with either of those emails.
const HARDCODED_ADMIN_EMAILS = ["nurulislam@gmail.com", "subadmin@gmail.com"];

const DesignationSchema = z.enum([
  "sales-associate",
  "warehouse-staff",
  "support-agent",
  "catalog-manager",
  "other",
]);
const AccessAreaSchema = z.enum(["quotations", "orders", "emails", "contact-requests"]);

const CreateEmployeeSchema = z
  .object({
    name: z.string().trim().min(1, "Name is required."),
    email: z.string().trim().email("Enter a valid email."),
    password: z.string().min(4, "Password must be at least 4 characters."),
    employeeIdNumber: z.string().trim().min(1, "Employee ID is required."),
    designation: DesignationSchema,
    customDesignation: z.string().trim().max(60).optional(),
    accessOptions: z.array(AccessAreaSchema).default([]),
  })
  .refine((v) => v.designation !== "other" || Boolean(v.customDesignation), {
    message: "Enter a designation.",
    path: ["customDesignation"],
  });

// POST /api/admin/employees — super-admin-only, creates a new real employee account.
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

  if (HARDCODED_ADMIN_EMAILS.includes(normalizedEmail)) {
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
    password,
    designation,
    ...(designation === "other" && customDesignation ? { customDesignation } : {}),
    accessOptions,
    createdAt: new Date().toISOString(),
  };

  await addEmployee(employee);

  return NextResponse.json({ employee }, { status: 201 });
}
