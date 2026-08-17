import { getAllProducts, getAllCategories } from "@/app/lib/mock-data";
import { StockClient } from "./stock-client";

export default async function AdminStockPage() {
  const products = await getAllProducts();
  const categories = await getAllCategories();
  return <StockClient initialProducts={products} categories={categories} />;
}
