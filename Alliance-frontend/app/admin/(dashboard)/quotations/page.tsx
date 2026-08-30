import { cookies } from "next/headers";

import { ADMIN_SESSION_COOKIE, parseAdminSession } from "@/app/lib/session-token";
import { readQuotations, readProducts } from "@/app/lib/admin-data";
import { QuotationsClient } from "./quotations-client";

export default async function AdminQuotationsPage() {
  const cookieStore = await cookies();
  const session = await parseAdminSession(cookieStore.get(ADMIN_SESSION_COOKIE)?.value);
  const [quotations, products] = await Promise.all([readQuotations(), readProducts()]);
  // readProducts, not getProducts: the public catalogue endpoint omits the
  // price, so the Prepare Quotation form couldn't default unit prices from it.
  const catalogPrices: Record<string, number> = {};
  for (const p of products) {
    if (p.price != null) catalogPrices[p.slug] = p.price;
  }
  // Hiding "Remove anyway" from a sub-admin is presentation only — the backend
  // refuses the request regardless of which UI sent it. Showing a button that
  // always 403s is the part worth avoiding.
  return (
    <QuotationsClient
      initialQuotations={quotations}
      canPurge={session?.role === "super"}
      catalogPrices={catalogPrices}
    />
  );
}
