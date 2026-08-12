"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/app/components/ui/tabs";
import { Badge } from "@/app/components/ui/badge";
import { formatPrice } from "@/app/lib/utils";
import { AddProductDialog } from "./add-product-dialog";
import { BulkImportTab } from "./bulk-import-tab";
import { CategoriesTab } from "./categories-tab";
import type { Brand, Category, Product, StockStatus } from "@/app/lib/types";

const STOCK_BADGE: Record<StockStatus, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  "in-stock": { label: "In Stock", variant: "secondary" },
  "low-stock": { label: "Low Stock", variant: "default" },
  "out-of-stock": { label: "Out of Stock", variant: "destructive" },
};

export function ProductsClient({
  initialProducts,
  initialCategories,
  brands,
}: {
  initialProducts: Product[];
  initialCategories: Category[];
  brands: Brand[];
}) {
  const router = useRouter();
  const products = initialProducts;
  const categories = initialCategories;

  // Server data is refreshed after any admin write; router.refresh() re-runs
  // the server component (page.tsx), which re-reads mock-data.ts and passes
  // fresh props down to this client component (see mock-data.ts's per-request
  // re-evaluation caveat) — no local client state to go stale here.
  function refresh() {
    router.refresh();
  }

  const categoryName = (slug: string) => categories.find((c) => c.slug === slug)?.name ?? slug;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Products</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage the product catalog, run bulk imports, and create categories.
        </p>
      </div>

      <Tabs defaultValue="catalog">
        <TabsList>
          <TabsTrigger value="catalog">Catalog</TabsTrigger>
          <TabsTrigger value="bulk">Bulk Import</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
        </TabsList>

        <TabsContent value="catalog" className="mt-4">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">{products.length} products</p>
            <AddProductDialog categories={categories} brands={brands} onCreated={refresh} />
          </div>

          <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Product</th>
                  <th className="px-4 py-3 font-medium">Category</th>
                  <th className="px-4 py-3 font-medium">Price</th>
                  <th className="px-4 py-3 font-medium">Stock</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {products.map((p) => (
                  <tr key={p.slug} className="bg-card transition-colors duration-200 hover:bg-muted/50">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-muted">
                          <Image src={p.image} alt={p.name} fill sizes="40px" className="object-contain p-1" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">{p.name}</p>
                          <p className="truncate text-xs text-muted-foreground">{p.partNumber}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{categoryName(p.categorySlug)}</td>
                    <td className="px-4 py-3 font-medium text-foreground">{formatPrice(p.price)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-foreground">{p.stockQty}</span>
                        <Badge variant={STOCK_BADGE[p.stock].variant} className="transition-colors duration-200">{STOCK_BADGE[p.stock].label}</Badge>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="bulk" className="mt-4">
          <BulkImportTab categories={categories} onImported={refresh} />
        </TabsContent>

        <TabsContent value="categories" className="mt-4">
          <CategoriesTab categories={categories} onCreated={refresh} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
