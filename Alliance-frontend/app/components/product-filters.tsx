"use client";

import { useState } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import type { Brand, Category } from "@/app/lib/types";
import { Switch } from "@/app/components/ui/switch";
import { Label } from "@/app/components/ui/label";
import { cn } from "@/app/lib/utils";

export function ProductFilters({ categories, brands }: { categories: Category[]; brands: Brand[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [open, setOpen] = useState(false);

  const activeCategory = searchParams.get("category") ?? "";
  const activeBrand = searchParams.get("brand") ?? "";
  const inStockOnly = searchParams.get("inStock") === "true";
  const q = searchParams.get("q") ?? "";
  const activeCount = [activeCategory, activeBrand, inStockOnly ? "1" : ""].filter(Boolean).length;

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
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mb-4 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm lg:hidden"
      >
        <SlidersHorizontal className="size-4" />
        Filters
        {activeCount > 0 && (
          <span className="flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-semibold text-white">
            {activeCount}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-slate-900/50" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-full max-w-xs flex-col overflow-y-auto bg-white p-4 shadow-xl">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-base font-bold text-slate-900">Filters</p>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close filters"
                className="flex size-8 items-center justify-center rounded-full text-slate-500 hover:bg-slate-100"
              >
                <X className="size-4" />
              </button>
            </div>
            <FilterBody
              categories={categories}
              brands={brands}
              activeCategory={activeCategory}
              activeBrand={activeBrand}
              inStockOnly={inStockOnly}
              q={q}
              updateParams={updateParams}
            />
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="btn-glass mt-6 w-full justify-center"
            >
              Show {activeCount > 0 ? "filtered" : "all"} results
            </button>
          </div>
        </div>
      )}

      <aside className="hidden flex-col gap-6 rounded-xl border border-slate-200 bg-white p-4 lg:sticky lg:top-24 lg:flex lg:h-fit">
        <FilterBody
          categories={categories}
          brands={brands}
          activeCategory={activeCategory}
          activeBrand={activeBrand}
          inStockOnly={inStockOnly}
          q={q}
          updateParams={updateParams}
        />
      </aside>
    </>
  );
}

function FilterBody({
  categories,
  brands,
  activeCategory,
  activeBrand,
  inStockOnly,
  q,
  updateParams,
}: {
  categories: Category[];
  brands: Brand[];
  activeCategory: string;
  activeBrand: string;
  inStockOnly: boolean;
  q: string;
  updateParams: (updates: Record<string, string | null>) => void;
}) {
  return (
    <>
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

      <div className="mt-6">
        <p className="mb-2 text-sm font-semibold text-slate-900">Category</p>
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => updateParams({ category: null })}
            className={cn(
              "rounded-md px-2 py-1.5 text-left text-sm",
              activeCategory === "" ? "bg-primary/10 font-medium text-primary" : "text-slate-600 hover:bg-slate-50"
            )}
          >
            All Categories
          </button>
          {categories.map((c) => (
            <button
              key={c.slug}
              type="button"
              onClick={() => updateParams({ category: activeCategory === c.slug ? null : c.slug })}
              className={cn(
                "flex items-center justify-between rounded-md px-2 py-1.5 text-left text-sm",
                activeCategory === c.slug ? "bg-primary/10 font-medium text-primary" : "text-slate-600 hover:bg-slate-50"
              )}
            >
              <span>{c.name}</span>
              <span className="text-xs text-slate-400">{c.productCount}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6">
        <p className="mb-2 text-sm font-semibold text-slate-900">Brand</p>
        <div className="flex flex-col gap-1.5">
          <button
            type="button"
            onClick={() => updateParams({ brand: null })}
            className={cn(
              "rounded-md px-2 py-1.5 text-left text-sm",
              activeBrand === "" ? "bg-primary/10 font-medium text-primary" : "text-slate-600 hover:bg-slate-50"
            )}
          >
            All Brands
          </button>
          {brands.map((b) => (
            <button
              key={b.slug}
              type="button"
              onClick={() => updateParams({ brand: activeBrand === b.slug ? null : b.slug })}
              className={cn(
                "rounded-md px-2 py-1.5 text-left text-sm",
                activeBrand === b.slug ? "bg-primary/10 font-medium text-primary" : "text-slate-600 hover:bg-slate-50"
              )}
            >
              {b.name}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <Label htmlFor="filter-instock" className="text-sm font-semibold text-slate-900">
          In Stock Only
        </Label>
        <Switch
          id="filter-instock"
          checked={inStockOnly}
          onCheckedChange={(checked) => updateParams({ inStock: checked ? "true" : null })}
        />
      </div>
    </>
  );
}
