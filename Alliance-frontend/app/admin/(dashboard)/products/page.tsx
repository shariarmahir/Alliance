import { products, categories, brands } from "@/app/lib/mock-data";
import { ProductsClient } from "./products-client";

export default function AdminProductsPage() {
  return <ProductsClient initialProducts={products} initialCategories={categories} brands={brands} />;
}
