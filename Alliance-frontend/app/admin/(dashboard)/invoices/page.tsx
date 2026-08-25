import { readInvoices, readQuotations } from "@/app/lib/admin-data";
import { InvoicesClient } from "./invoices-client";

// Invoices are raised against confirmed orders, so the screen needs both: the
// invoice list itself, and the confirmed orders available to bill.
export default async function AdminInvoicesPage() {
  const [invoices, quotations] = await Promise.all([readInvoices(), readQuotations()]);
  return (
    <InvoicesClient
      initialInvoices={invoices}
      orders={quotations.filter((q) => q.status === "confirmed")}
    />
  );
}
