import "server-only";
import bcrypt from "bcryptjs";
import { readEmployees } from "@/app/lib/admin-employees";
import type { AdminRole, AdminSession } from "@/app/lib/types";

// Token handling lives in session-token.ts so proxy.ts (Edge runtime) can
// import it without pulling in bcrypt or Blob-backed storage. Re-exported
// here so the rest of the app keeps a single import site for auth.
export {
  ADMIN_SESSION_COOKIE,
  createSessionToken,
  parseAdminSession,
} from "@/app/lib/session-token";

// bcrypt hashes are self-identifying: "$2a$"/"$2b$"/"$2y$" prefix plus cost.
// Anything else in the password field is a legacy plaintext value.
function isHashed(password: string): boolean {
  return /^\$2[aby]\$\d{2}\$/.test(password);
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 12);
}

// Compares in constant time via bcrypt. Legacy plaintext rows still in storage
// are accepted once so existing staff aren't locked out mid-migration; run
// `npm run migrate:passwords` to hash them and remove this path's reason to
// exist.
async function passwordMatches(plain: string, stored: string): Promise<boolean> {
  if (isHashed(stored)) return bcrypt.compare(plain, stored);
  return plain === stored;
}

// SUPER_ADMIN_PASSWORD_HASH_B64 is base64, not a raw bcrypt string, because
// Next's env loader (@next/env, bundling dotenv-expand) performs $VAR/${VAR}
// substitution on every value it reads — a raw hash like "$2b$12$K..." has
// $2b, $12 and $K silently resolved to "" as undefined variable references,
// truncating the 60-character hash to 52 and rejecting every correct
// password. Base64 contains no $, so it passes through untouched.
function decodeBootstrapHash(): string | null {
  const b64 = process.env.SUPER_ADMIN_PASSWORD_HASH_B64;
  if (!b64) return null;
  try {
    const decoded = Buffer.from(b64, "base64").toString("utf8");
    return isHashed(decoded) ? decoded : null;
  } catch {
    return null;
  }
}

export async function verifyAdminCredentials(
  email: string,
  password: string
): Promise<AdminSession | null> {
  const normalizedEmail = email.trim().toLowerCase();

  // The bootstrap super admin lives in the environment, not in source. Without
  // it configured there is simply no hardcoded account — previously two were
  // compiled into the bundle with live passwords.
  const bootstrapEmail = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  const bootstrapHash = decodeBootstrapHash();
  if (bootstrapEmail && bootstrapHash && normalizedEmail === bootstrapEmail) {
    if (await bcrypt.compare(password, bootstrapHash)) {
      return {
        role: "super",
        name: process.env.SUPER_ADMIN_NAME || "Super Admin",
        email: bootstrapEmail,
      };
    }
    return null;
  }

  const employees = await readEmployees();
  const employee = employees.find((e) => e.email.toLowerCase() === normalizedEmail);
  if (!employee || employee.disabled) return null;
  if (!(await passwordMatches(password, employee.password))) return null;

  return {
    role: employee.role ?? "sub",
    name: employee.name,
    email: employee.email,
    employeeId: employee.id,
    accessOptions: employee.accessOptions,
  };
}

// /admin is role-branching: super admin sees the analytics Overview, sub-admin
// sees their personal dashboard. Both roles land here.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function landingPathForRole(role: AdminRole): string {
  return "/admin";
}

