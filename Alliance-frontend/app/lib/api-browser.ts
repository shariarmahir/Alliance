// Browser-side API access for "use client" components.
//
// Separate from api-client.ts because that one reads httpOnly cookies via
// next/headers, which does not exist in the browser. Here the cookie rides
// along automatically via `credentials: "include"` — which is also why the
// backend must send SameSite=None; Secure in production, where the frontend
// and API are different origins.

export const API_BASE_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000"
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

type FieldError = { loc?: unknown[]; msg?: string };

// A 422 carries the generic "Invalid request body." in `error` and the useful
// part — which field, and why — in `details`. Showing only the former tells an
// admin their input was rejected without saying what to change, so the field
// errors are folded into the message.
function fieldMessages(details: unknown): string | null {
  if (!Array.isArray(details)) return null;
  const parts = (details as FieldError[])
    .map((d) => {
      if (!d?.msg) return null;
      const field = Array.isArray(d.loc) ? d.loc[d.loc.length - 1] : undefined;
      return typeof field === "string" && field !== "body"
        ? `${field}: ${d.msg}`
        : d.msg;
    })
    .filter((p): p is string => Boolean(p));
  return parts.length > 0 ? parts.join("; ") : null;
}

async function parseError(response: Response): Promise<ApiError> {
  let message = `Request failed (${response.status})`;
  let details: unknown;
  try {
    const payload = await response.json();
    details = payload.details ?? payload.errors;
    message = fieldMessages(details) ?? payload.detail ?? payload.error ?? message;
  } catch {
    // Non-JSON body — keep the status-based message.
  }
  return new ApiError(response.status, message, details);
}

export async function apiFetch<T>(
  path: string,
  // `signal` is here for debounced callers (admin search) that must cancel a
  // request the user has already typed past.
  options: { method?: string; body?: unknown; signal?: AbortSignal } = {}
): Promise<T> {
  const { method = "GET", body, signal } = options;

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method,
    credentials: "include",
    headers: body === undefined ? {} : { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal,
  });

  if (!response.ok) throw await parseError(response);
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

// Multipart uploads (product images, hero images, bulk import). Content-Type
// is deliberately unset so the browser adds the multipart boundary itself.
export async function apiUpload<T>(path: string, formData: FormData): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });

  if (!response.ok) throw await parseError(response);
  return (await response.json()) as T;
}

// Streams a PDF (quotation, invoice) straight to a download without the bytes
// ever passing through this app's own origin.
export async function apiDownload(path: string, filename: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}${path}`, { credentials: "include" });
  if (!response.ok) throw await parseError(response);

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
