"use server";

import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import {
  verifyAdminCredentials,
  landingPathForRole,
  createSessionToken,
  ADMIN_SESSION_COOKIE,
} from "@/app/lib/admin-auth";
import { checkRateLimit } from "@/app/lib/rate-limit";

export type LoginState = { error: string | null };

// Sessions expire after 8 hours (matching the JWT's own expiry — the cookie
// must not outlive the token it carries, or the user gets a confusing
// "logged in but rejected" state).
const SESSION_MAX_AGE = 8 * 60 * 60;

export async function loginAction(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  // Throttled per IP: without this the login form accepts unlimited password
  // guesses at full speed. Keyed on IP rather than email so an attacker can't
  // sidestep it by rotating the address they're guessing against.
  const forwarded = (await headers()).get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || "unknown";
  const limit = checkRateLimit(`login:${ip}`, { limit: 8, windowMs: 15 * 60_000 });
  if (!limit.ok) {
    return { error: "Too many sign-in attempts. Please wait a few minutes and try again." };
  }

  const session = await verifyAdminCredentials(email, password);
  if (!session) {
    return { error: "Invalid email or password." };
  }

  const token = await createSessionToken(session);
  const cookieStore = await cookies();
  cookieStore.set({
    name: ADMIN_SESSION_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_MAX_AGE,
  });

  redirect(landingPathForRole(session.role));
}

export async function logoutAction() {
  const cookieStore = await cookies();
  cookieStore.delete(ADMIN_SESSION_COOKIE);
  redirect("/admin/login");
}
