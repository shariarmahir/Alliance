import { products, categories } from "@/app/lib/mock-data";
import { StockClient } from "./stock-client";

export default function AdminStockPage() {
  // Spread into plain arrays — see products/page.tsx for why (Proxy props
  // cannot cross the Server->Client Component boundary).
  return <StockClient initialProducts={[...products]} categories={[...categories]} />;
}
