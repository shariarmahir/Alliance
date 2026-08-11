import { products, categories, brands } from "@/app/lib/mock-data";
import { ProductsClient } from "./products-client";

export default function AdminProductsPage() {
  // Spread into plain arrays — products/categories are Proxies (see
  // mock-data.ts) that always re-read their JSON file; RSC prop
  // serialization requires a plain array when crossing into a Client Component.
  return <ProductsClient initialProducts={[...products]} initialCategories={[...categories]} brands={brands} />;
}
