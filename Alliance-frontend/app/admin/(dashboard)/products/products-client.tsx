"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/app/components/ui/tabs";
import { AddProductDialog } from "./add-product-dialog";
import { BulkImportTab } from "./bulk-import-tab";
import { CategoriesTab } from "./categories-tab";
import { PageHeader, Panel, EmptyState, Pill, TH, TD, ROW, type PillTone } from "../admin-ui";
import type { Brand, Category, Product, StockStatus } from "@/app/lib/types";

const STOCK_PILL: Record<StockStatus, { label: string; tone: PillTone }> = {
  "in-stock": { label: "IN STOCK", tone: "ok" },
  "low-stock": { label: "LOW", tone: "warn" },
  "out-of-stock": { label: "OUT", tone: "danger" },
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
  const [query, setQuery] = useState("");

  // Server data is refreshed after any admin write; router.refresh() re-runs
  // the server component (page.tsx), which re-reads mock-data.ts and passes
  // fresh props down — no local client state to go stale here.
  function refresh() {
    router.refresh();
  }

  const categoryName = (slug: string) =>
    initialCategories.find((c) => c.slug === slug)?.name ?? slug;

  const q = query.trim().toLowerCase();
  const products = q
    ? initialProducts.filter(
        (p) =>
          p.partNumber.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q) ||
          p.brand.toLowerCase().includes(q)
      )
    : initialProducts;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Products"
        subtitle="Manage the product catalog, run bulk imports, and create categories."
      />

      <Tabs defaultValue="catalog">
        <TabsList>
          <TabsTrigger value="catalog">Catalog</TabsTrigger>
          <TabsTrigger value="bulk">Bulk import</TabsTrigger>
          <TabsTrigger value="categories">Categories</TabsTrigger>
        </TabsList>

        <TabsContent value="catalog" className="mt-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search part number, name or brand"
                className="w-full max-w-xs rounded-md border border-[#dde3ea] px-3 py-2 text-[12.5px] text-ink outline-none transition-colors placeholder:text-[#8a94a6] focus:border-primary"
              />
              <span className="font-mono text-[11px] text-[#8a94a6]">
                {products.length} OF {initialProducts.length}
              </span>
            </div>
            <AddProductDialog categories={initialCategories} brands={brands} onCreated={refresh} />
          </div>

          {products.length === 0 ? (
            <EmptyState>
              {initialProducts.length === 0
                ? "No products yet. Add one or run a bulk import."
                : `Nothing matches “${query}”.`}
            </EmptyState>
          ) : (
            <Panel className="overflow-hidden">
              <div className="scrollbar-slim overflow-x-auto">
                <table className="w-full text-[12.5px]">
                  <thead className="bg-surface">
                    <tr>
                      <th className={TH}>PRODUCT</th>
                      <th className={TH}>CATEGORY</th>
                      <th className={TH}>BRAND</th>
                      <th className={TH}>STOCK</th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.map((p) => (
                      <tr key={p.slug} className={ROW}>
                        <td className={TD}>
                          <div className="flex items-center gap-3">
                            <div className="relative size-10 shrink-0 overflow-hidden rounded-lg border border-hairline bg-surface">
                              <Image
                                src={p.image}
                                alt=""
                                fill
                                sizes="40px"
                                className="object-contain p-1"
                              />
                            </div>
                            <div className="min-w-0">
                              <p className="truncate font-mono text-[12px] font-semibold text-ink">
                                {p.partNumber}
                              </p>
                              <p className="truncate text-[11px] text-[#8a94a6]">{p.name}</p>
                            </div>
                          </div>
                        </td>
                        <td className={`${TD} text-ink-muted`}>{categoryName(p.categorySlug)}</td>
                        <td className={`${TD} text-ink-muted`}>{p.brand}</td>
                        <td className={TD}>
                          <div className="flex items-center gap-2">
                            <span className="w-8 shrink-0 font-mono font-bold text-ink">
                              {p.stockQty}
                            </span>
                            <Pill tone={STOCK_PILL[p.stock].tone}>{STOCK_PILL[p.stock].label}</Pill>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          )}
        </TabsContent>

        <TabsContent value="bulk" className="mt-4">
          <BulkImportTab categories={initialCategories} onImported={refresh} />
        </TabsContent>

        <TabsContent value="categories" className="mt-4">
          <CategoriesTab categories={initialCategories} onCreated={refresh} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
