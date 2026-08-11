"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/app/components/ui/tabs";
import { ProductCard } from "@/app/components/product-card";
import { getTopSelling } from "@/app/lib/mock-data";

const periods = [
  { key: "week", label: "This Week" },
  { key: "month", label: "This Month" },
  { key: "year", label: "This Year" },
] as const;

export function ProductTabsSection() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-12">
      <h2 className="mb-6 text-2xl font-bold text-slate-900">Top-Selling Products</h2>
      <Tabs defaultValue="week">
        <TabsList>
          {periods.map((p) => (
            <TabsTrigger key={p.key} value={p.key}>
              {p.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {periods.map((p) => (
          <TabsContent key={p.key} value={p.key}>
            <div className="grid grid-cols-1 gap-4 pt-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
              {getTopSelling(p.key).map((product) => (
                <ProductCard key={product.slug} product={product} />
              ))}
            </div>
          </TabsContent>
        ))}
      </Tabs>
    </section>
  );
}
