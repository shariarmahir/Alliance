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

      <aside className="hidden lg:sticky lg:top-24 lg:block lg:h-fit">
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
      <div className="mb-4 overflow-hidden rounded-[10px] border border-slate-line">
        <div className="bg-[#0d1626] px-4 py-3.5">
          <strong className="text-[13px] font-semibold text-white">Product search</strong>
        </div>
        <div className="flex flex-col gap-3.5 p-4">
          <label className="block">
            <span className="mono-label mb-1.5 block text-[10.5px] tracking-[0.06em] text-ink-muted">
              PART NUMBER OR KEYWORD
            </span>
            <input
              id="filter-search"
              type="text"
              defaultValue={q}
              placeholder="1762-"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  updateParams({ q: (e.target as HTMLInputElement).value || null });
                }
              }}
              onBlur={(e) => updateParams({ q: e.target.value || null })}
              className="w-full rounded-[7px] border border-[#dde3ea] px-2.5 py-2.5 font-mono text-[13px] text-ink outline-none focus:border-primary"
            />
          </label>

          <label className="block">
            <span className="mono-label mb-1.5 block text-[10.5px] tracking-[0.06em] text-ink-muted">
              CATEGORY
            </span>
            <select
              value={activeCategory}
              onChange={(e) => updateParams({ category: e.target.value || null })}
              className="w-full rounded-[7px] border border-[#dde3ea] px-2.5 py-2.5 text-[13px] text-ink outline-none focus:border-primary"
            >
              <option value="">All categories</option>
              {categories.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.name} ({c.productCount})
                </option>
              ))}
            </select>
          </label>

          <div className="flex items-center justify-between">
            <Label htmlFor="filter-instock" className="text-[12.5px] font-medium text-ink-soft">
              In stock only
            </Label>
            <Switch
              id="filter-instock"
              checked={inStockOnly}
              onCheckedChange={(checked) => updateParams({ inStock: checked ? "true" : null })}
            />
          </div>
        </div>
      </div>

      <div className="rounded-[10px] border border-slate-line p-4">
        <strong className="mb-3 block text-[12.5px] font-semibold text-ink">Brand</strong>
        <div className="flex flex-col gap-2.5 text-[12.5px] text-ink-soft">
          <button
            type="button"
            onClick={() => updateParams({ brand: null })}
            className={cn(
              "text-left transition-colors hover:text-primary",
              activeBrand === "" && "font-semibold text-primary"
            )}
          >
            All brands
          </button>
          {brands.map((b) => (
            <button
              key={b.slug}
              type="button"
              onClick={() => updateParams({ brand: activeBrand === b.slug ? null : b.slug })}
              className="flex items-center justify-between text-left transition-colors hover:text-primary"
            >
              <span className="flex items-center gap-2">
                <span
                  className={cn(
                    "flex size-[15px] items-center justify-center rounded border text-[10px] font-bold text-white",
                    activeBrand === b.slug ? "border-primary bg-primary" : "border-[#c8d0da]"
                  )}
                >
                  {activeBrand === b.slug ? "✓" : ""}
                </span>
                {b.name}
              </span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
