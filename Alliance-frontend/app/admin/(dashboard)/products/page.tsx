import { getBrands, getCategories } from "@/app/lib/catalog-data";
import { readProducts } from "@/app/lib/admin-data";
import { ProductsClient } from "./products-client";

export default async function AdminProductsPage() {
  // readProducts, not getProducts: the public catalogue endpoint omits the
  // price, so fetching this screen through it showed every product as
  // "Not set" no matter what had been saved.
  const [products, categories, brands] = await Promise.all([
    readProducts(),
    getCategories(),
    getBrands(),
  ]);
  return <ProductsClient initialProducts={products} initialCategories={categories} brands={brands} />;
}
