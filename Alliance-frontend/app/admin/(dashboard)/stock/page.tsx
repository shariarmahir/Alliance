import { products, categories } from "@/app/lib/mock-data";
import { StockClient } from "./stock-client";

export default function AdminStockPage() {
  return <StockClient initialProducts={products} categories={categories} />;
}
