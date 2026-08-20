import { getBrands, getCategories, getProducts } from "@/app/lib/catalog-data";
import { ProductsClient } from "./products-client";

export default async function AdminProductsPage() {
  const [{ items: products }, categories, brands] = await Promise.all([
    getProducts({ pageSize: 100 }),
    getCategories(),
    getBrands(),
  ]);
  return <ProductsClient initialProducts={products} initialCategories={categories} brands={brands} />;
}
