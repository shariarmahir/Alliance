import { readOrders } from "@/app/lib/admin-operations";
import { OrdersClient } from "./orders-client";

// Reads fresh on every request (no module-level cache) — see
// app/lib/admin-operations.ts's header comment for why this sidesteps the
// stale-cache bug mock-data.ts had to work around with Proxies.
export default async function AdminOrdersPage() {
  const orders = await readOrders();
  return <OrdersClient initialOrders={orders} />;
}
