import {
  readQuotations,
  readPaymentAnalytics,
  readInvoices,
  readChallans,
} from "@/app/lib/admin-data";
import { OrdersClient } from "./orders-client";

// Orders are confirmed quotations, not a separate record. The standalone
// `orders` table this page used to read was fed by the customer checkout
// flow, which no longer exists — nothing has written to it since, so it
// could only ever render empty. A confirmed quotation already carries the
// priced lines, reference number and totals an order needs, so there is
// nothing to copy into a second table that could then drift out of sync.
export default async function AdminOrdersPage() {
  const [quotations, payments, invoices, challans] = await Promise.all([
    readQuotations(),
    readPaymentAnalytics("month"),
    readInvoices(),
    readChallans(),
  ]);

  // One order can have several invoices (partial billing) or challans
  // (partial shipping), so "has an invoice/challan been raised at all" has
  // to come from whether any record names this order — the summary fields
  // on the confirmation (amountInvoiced, deliveryComplete) can't tell "never
  // invoiced" apart from "invoiced for zero".
  const invoicedOrderIds = new Set(invoices.map((i) => i.quotationId));
  const challanedOrderIds = new Set(challans.map((c) => c.quotationId));

  return (
    <OrdersClient
      initialOrders={quotations.filter((q) => q.status === "confirmed")}
      payments={payments}
      invoicedOrderIds={[...invoicedOrderIds]}
      challanedOrderIds={[...challanedOrderIds]}
    />
  );
}
