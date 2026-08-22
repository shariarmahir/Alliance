import { readQuotations, readPaymentAnalytics } from "@/app/lib/admin-data";
import { OrdersClient } from "./orders-client";

// Orders are confirmed quotations, not a separate record. The standalone
// `orders` table this page used to read was fed by the customer checkout
// flow, which no longer exists — nothing has written to it since, so it
// could only ever render empty. A confirmed quotation already carries the
// priced lines, reference number and totals an order needs, so there is
// nothing to copy into a second table that could then drift out of sync.
export default async function AdminOrdersPage() {
  const [quotations, payments] = await Promise.all([
    readQuotations(),
    readPaymentAnalytics("month"),
  ]);
  return (
    <OrdersClient
      initialOrders={quotations.filter((q) => q.status === "confirmed")}
      payments={payments}
    />
  );
}
