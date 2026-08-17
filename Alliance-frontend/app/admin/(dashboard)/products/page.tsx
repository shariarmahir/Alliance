import { getAllProducts, getAllCategories, brands } from "@/app/lib/mock-data";
import { ProductsClient } from "./products-client";

export default async function AdminProductsPage() {
  const products = await getAllProducts();
  const categories = await getAllCategories();
  return <ProductsClient initialProducts={products} initialCategories={categories} brands={brands} />;
}
