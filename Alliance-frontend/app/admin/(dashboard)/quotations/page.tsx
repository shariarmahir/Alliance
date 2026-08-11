import { readQuotations } from "@/app/lib/admin-operations";
import { QuotationsClient } from "./quotations-client";

export default async function AdminQuotationsPage() {
  const quotations = await readQuotations();
  return <QuotationsClient initialQuotations={quotations} />;
}
