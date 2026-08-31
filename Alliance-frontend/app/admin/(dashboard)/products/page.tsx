import { getCategories } from "@/app/lib/catalog-data";
import { readProducts, readBrands } from "@/app/lib/admin-data";
import { ProductsClient } from "./products-client";

export default async function AdminProductsPage() {
  // readProducts and readBrands, not getProducts/getBrands: the public
  // catalogue endpoints omit price and productCount, so fetching this screen
  // through them showed every product as "Not set" and gave the Brands tab
  // nothing to gate deletion on.
  const [products, categories, brands] = await Promise.all([
    readProducts(),
    getCategories(),
    readBrands(),
  ]);
  return <ProductsClient initialProducts={products} initialCategories={categories} brands={brands} />;
}
