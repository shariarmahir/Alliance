import { getCategories, getProducts } from "@/app/lib/catalog-data";
import { StockClient } from "./stock-client";

export default async function AdminStockPage() {
  const [{ items: products }, categories] = await Promise.all([
    getProducts({ pageSize: 100 }),
    getCategories(),
  ]);
  return <StockClient initialProducts={products} categories={categories} />;
}
