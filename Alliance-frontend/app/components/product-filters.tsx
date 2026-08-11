"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { Brand, Category } from "@/app/lib/types";
import { Switch } from "@/app/components/ui/switch";
import { Label } from "@/app/components/ui/label";

export function ProductFilters({ categories, brands }: { categories: Category[]; brands: Brand[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const activeCategory = searchParams.get("category") ?? "";
  const activeBrand = searchParams.get("brand") ?? "";
  const inStockOnly = searchParams.get("inStock") === "true";
  const q = searchParams.get("q") ?? "";

  function updateParams(updates: Record<string, string | null>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value === null || value === "") {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    }
    params.delete("page");
    router.push(`/products?${params.toString()}`);
  }

  return (
    <aside className="flex flex-col gap-6 rounded-xl border border-slate-200 bg-white p-4 lg:sticky lg:top-24 lg:h-fit">
      <div>
        <Label htmlFor="filter-search" className="mb-2 block text-sm font-semibold text-slate-900">
          Search
        </Label>
        <input
          id="filter-search"
          type="text"
          defaultValue={q}
          placeholder="Part number or description..."
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              updateParams({ q: (e.target as HTMLInputElement).value || null });
            }
          }}
          onBlur={(e) => updateParams({ q: e.target.value || null })}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-primary focus:outline-none"
        />
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-slate-900">Category</p>
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => updateParams({ category: null })}
            className={`rounded-md px-2 py-1.5 text-left text-sm ${activeCategory === "" ? "bg-primary/10 font-medium text-primary" : "text-slate-600 hover:bg-slate-50"}`}
          >
            All Categories
          </button>
          {categories.map((c) => (
            <button
              key={c.slug}
              type="button"
              onClick={() => updateParams({ category: activeCategory === c.slug ? null : c.slug })}
              className={`flex items-center justify-between rounded-md px-2 py-1.5 text-left text-sm ${activeCategory === c.slug ? "bg-primary/10 font-medium text-primary" : "text-slate-600 hover:bg-slate-50"}`}
            >
              <span>{c.name}</span>
              <span className="text-xs text-slate-400">{c.productCount}</span>
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="mb-2 text-sm font-semibold text-slate-900">Brand</p>
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => updateParams({ brand: null })}
            className={`rounded-md px-2 py-1.5 text-left text-sm ${activeBrand === "" ? "bg-primary/10 font-medium text-primary" : "text-slate-600 hover:bg-slate-50"}`}
          >
            All Brands
          </button>
          {brands.map((b) => (
            <button
              key={b.slug}
              type="button"
              onClick={() => updateParams({ brand: activeBrand === b.slug ? null : b.slug })}
              className={`rounded-md px-2 py-1.5 text-left text-sm ${activeBrand === b.slug ? "bg-primary/10 font-medium text-primary" : "text-slate-600 hover:bg-slate-50"}`}
            >
              {b.name}
            </button>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <Label htmlFor="filter-instock" className="text-sm font-semibold text-slate-900">
          In Stock Only
        </Label>
        <Switch
          id="filter-instock"
          checked={inStockOnly}
          onCheckedChange={(checked) => updateParams({ inStock: checked ? "true" : null })}
        />
      </div>
    </aside>
  );
}
