"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { API_BASE_URL } from "@/app/lib/api-client";
import { ADMIN_SESSION_COOKIE } from "@/app/lib/session-token";

export type LoginState = { error: string | null };

// Credential verification, password hashing and rate limiting all live in the
// backend now. This action forwards the form to it and copies the resulting
// session cookie onto this app's own origin, so the browser holds a
// first-party cookie while the API remains the only thing that can mint one.

const SESSION_MAX_AGE = 8 * 60 * 60; // matches the JWT's own 8h expiry

export async function loginAction(_prevState: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}/api/admin/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
    });
  } catch {
    return { error: "Could not reach the server. Please try again." };
  }

  if (response.status === 429) {
    return { error: "Too many sign-in attempts. Please wait a few minutes and try again." };
  }
  if (!response.ok) {
    // The backend deliberately returns the same 401 for unknown email, wrong
    // password and disabled account — don't add detail it withheld.
    return { error: "Invalid email or password." };
  }

  // The backend's Set-Cookie is scoped to the API origin, which the browser
  // will not send back to this app. Re-issue the same signed token here.
  const token = extractSessionToken(response);
  if (!token) {
    return { error: "Sign-in failed. Please try again." };
  }

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

  // Both roles land on /admin; the page branches on role.
  redirect("/admin");
}

function extractSessionToken(response: Response): string | null {
  // getSetCookie() returns every Set-Cookie header separately, which a plain
  // get() would collapse into one comma-joined string and corrupt.
  const headers =
    typeof response.headers.getSetCookie === "function"
      ? response.headers.getSetCookie()
      : [response.headers.get("set-cookie") ?? ""];

  for (const header of headers) {
    const match = header.match(new RegExp(`${ADMIN_SESSION_COOKIE}=([^;]+)`));
    if (match) return match[1];
  }
  return null;
}

export async function logoutAction() {
  const cookieStore = await cookies();
  const token = cookieStore.get(ADMIN_SESSION_COOKIE)?.value;

  // Best-effort: the local cookie is what actually gates this app, so a
  // backend that is down must not prevent signing out.
  if (token) {
    try {
      await fetch(`${API_BASE_URL}/api/admin/logout`, {
        method: "POST",
        headers: { Cookie: `${ADMIN_SESSION_COOKIE}=${token}` },
        cache: "no-store",
      });
    } catch {
      // Ignored deliberately.
    }
  }

  cookieStore.delete(ADMIN_SESSION_COOKIE);
  redirect("/admin/login");
}
