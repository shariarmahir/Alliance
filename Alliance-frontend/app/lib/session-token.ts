import { SignJWT, jwtVerify } from "jose";
import type { AdminSession } from "@/app/lib/types";

// Token signing/verification only — deliberately free of "server-only",
// bcrypt, and any storage import so proxy.ts can use it on the Edge runtime.
// admin-auth.ts (which does pull in bcrypt and Blob-backed employee reads)
// re-exports these, so app code keeps importing from there.

export const ADMIN_SESSION_COOKIE = "autolink_admin_session";

// Sessions are signed JWTs, not raw JSON. The previous implementation stored
// the session object as plain JSON and trusted whatever came back out of the
// cookie — anyone could type {"role":"super"} into their browser and become a
// super admin without ever logging in. Every RBAC check in the app (proxy.ts,
// _auth.ts, per-resource ownership) reads the session this returns, so the
// signature here is what makes all of them real.
const SESSION_TTL = "8h";

// Fail loudly rather than silently falling back to a default secret — a
// predictable signing key is the same vulnerability as no signing at all.
function sessionSecret(): Uint8Array {
  const raw = process.env.SESSION_SECRET;
  if (!raw || raw.length < 32) {
    throw new Error(
      "SESSION_SECRET is missing or too short (needs >= 32 chars). Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('base64url'))\""
    );
  }
  return new TextEncoder().encode(raw);
}

export async function createSessionToken(session: AdminSession): Promise<string> {
  return new SignJWT({ ...session })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(SESSION_TTL)
    .sign(sessionSecret());
}

// Async because signature verification is. Returns null for a missing,
// tampered, malformed or expired token — callers treat all four the same way.
export async function parseAdminSession(raw: string | undefined): Promise<AdminSession | null> {
  if (!raw) return null;
  try {
    const { payload } = await jwtVerify(raw, sessionSecret(), { algorithms: ["HS256"] });
    if (
      (payload.role === "super" || payload.role === "sub") &&
      typeof payload.name === "string" &&
      typeof payload.email === "string"
    ) {
      return {
        role: payload.role,
        name: payload.name,
        email: payload.email,
        ...(typeof payload.employeeId === "string" ? { employeeId: payload.employeeId } : {}),
        ...(Array.isArray(payload.accessOptions)
          ? { accessOptions: payload.accessOptions as AdminSession["accessOptions"] }
          : {}),
      };
    }
    return null;
  } catch {
    return null;
  }
}
