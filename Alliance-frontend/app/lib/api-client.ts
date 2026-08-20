import { cookies } from "next/headers";
import { ADMIN_SESSION_COOKIE } from "@/app/lib/session-token";

// The single place this app talks to the FastAPI backend. Server components
// and server actions call these; client components go through `apiFetch` in
// api-browser.ts instead (it cannot read httpOnly cookies).
//
// Every backend response is camelCase, matching the types in types.ts, so
// responses are used as-is with no field remapping.

export const API_BASE_URL = (
  process.env.API_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"
).replace(/\/$/, "");

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type ApiOptions = {
  method?: string;
  body?: unknown;
  // Forward the caller's admin session so the backend can authorise. Off by
  // default: public catalog reads must not leak an admin cookie upstream.
  auth?: boolean;
  // Server components render per request and admin data changes constantly,
  // so nothing is cached unless a caller opts in.
  revalidate?: number;
  tags?: string[];
};

async function request<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const { method = "GET", body, auth = false, revalidate, tags } = options;

  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";

  if (auth) {
    // Server components cannot rely on the browser attaching the cookie —
    // this is a server-to-server call, so it is forwarded explicitly.
    const token = (await cookies()).get(ADMIN_SESSION_COOKIE)?.value;
    if (token) headers.Cookie = `${ADMIN_SESSION_COOKIE}=${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    ...(revalidate === undefined ? { cache: "no-store" } : { next: { revalidate, tags } }),
  });

  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    let details: unknown;
    try {
      const payload = await response.json();
      // FastAPI uses `detail`; our validation handler uses `error`.
      message = payload.detail ?? payload.error ?? message;
      details = payload.details ?? payload.errors;
    } catch {
      // Non-JSON error body — keep the status-based message.
    }
    throw new ApiError(response.status, message, details);
  }

  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

export const api = {
  get: <T>(path: string, options?: Omit<ApiOptions, "method" | "body">) =>
    request<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: Omit<ApiOptions, "method" | "body">) =>
    request<T>(path, { ...options, method: "POST", body }),
  patch: <T>(path: string, body?: unknown, options?: Omit<ApiOptions, "method" | "body">) =>
    request<T>(path, { ...options, method: "PATCH", body }),
  delete: <T>(path: string, options?: Omit<ApiOptions, "method" | "body">) =>
    request<T>(path, { ...options, method: "DELETE" }),
};

// Returns null instead of throwing on 404, for pages that render their own
// "not found" state rather than an error boundary.
export async function getOrNull<T>(
  path: string,
  options?: Omit<ApiOptions, "method" | "body">
): Promise<T | null> {
  try {
    return await api.get<T>(path, options);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

// Falls back to a default when the backend is unreachable. Used only for
// non-essential storefront sections (top sellers, hero images) where an empty
// section is better than a failed page render.
export async function getOrDefault<T>(
  path: string,
  fallback: T,
  options?: Omit<ApiOptions, "method" | "body">
): Promise<T> {
  try {
    return await api.get<T>(path, options);
  } catch {
    return fallback;
  }
}
