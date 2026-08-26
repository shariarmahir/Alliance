import { readInvoices, readQuotations } from "@/app/lib/admin-data";
import { InvoicesClient } from "./invoices-client";

// Invoices are raised against confirmed orders, so the screen needs both: the
// invoice list itself, and the confirmed orders available to bill.
//
// `?order=<id>` arrives from the Prepare Invoice quick option on a confirmed
// price request. Read here rather than with useSearchParams, which would need
// its own Suspense boundary or the production build fails — a failure neither
// tsc nor eslint catches.
export default async function AdminInvoicesPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const [invoices, quotations, params] = await Promise.all([
    readInvoices(),
    readQuotations(),
    searchParams,
  ]);
  return (
    <InvoicesClient
      initialInvoices={invoices}
      orders={quotations.filter((q) => q.status === "confirmed")}
      presetOrderId={params.order}
    />
  );
}
