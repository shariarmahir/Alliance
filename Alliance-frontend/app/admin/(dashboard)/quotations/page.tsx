import { cookies } from "next/headers";

import { ADMIN_SESSION_COOKIE, parseAdminSession } from "@/app/lib/session-token";
import { readQuotations } from "@/app/lib/admin-data";
import { QuotationsClient } from "./quotations-client";

export default async function AdminQuotationsPage() {
  const cookieStore = await cookies();
  const session = await parseAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  const quotations = await readQuotations();
  // Hiding "Remove anyway" from a sub-admin is presentation only — the backend
  // refuses the request regardless of which UI sent it. Showing a button that
  // always 403s is the part worth avoiding.
  return (
    <QuotationsClient
      initialQuotations={quotations}
      canPurge={session?.role === "super"}
    />
  );
}
