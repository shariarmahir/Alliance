"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import { Minus, Plus, Check } from "lucide-react";
import {
  PageHeader,
  Panel,
  EmptyState,
  FilterBar,
  Pill,
  TH,
  TD,
  ROW,
  type PillTone,
} from "../admin-ui";
import { apiFetch, ApiError } from "@/app/lib/api-browser";
import type { Category, Product, StockStatus } from "@/app/lib/types";

const STOCK_PILL: Record<StockStatus, { label: string; tone: PillTone }> = {
  "in-stock": { label: "IN STOCK", tone: "ok" },
  "low-stock": { label: "LOW", tone: "warn" },
  "out-of-stock": { label: "OUT", tone: "danger" },
};

// Bar fill for the quantity column, mirroring the Overview's warehouse-alerts
// panel. Capped at a nominal healthy level so low stock reads as a short bar.
const FULL_STOCK = 40;

function StockRow({
  product,
  categoryName,
  onChanged,
}: {
  product: Product;
  categoryName: string;
  onChanged: () => void;
}) {
  const [step, setStep] = useState("1");
  const [exact, setExact] = useState(String(product.stockQty));
  const [busy, setBusy] = useState(false);

  // The API takes an absolute quantity only, so a stock-in/out step is
  // resolved against the quantity on screen before sending. Clamped at zero:
  // stocking out more than is held should empty the shelf, not go negative.
  async function patch(body: { stockQty: number; delta?: boolean }) {
    const nextQty = body.delta
      ? Math.max(0, product.stockQty + body.stockQty)
      : body.stockQty;
    setBusy(true);
    try {
      const updated = await apiFetch<{ stockQty: number }>(
        `/api/admin/products/${encodeURIComponent(product.slug)}/stock`,
        { method: "PATCH", body: { stockQty: nextQty } }
      );
      toast.success(`${product.partNumber}: stock updated to ${updated.stockQty}.`);
      onChanged();
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Could not save changes."
      );
    } finally {
      setBusy(false);
    }
  }

  const n = Math.max(1, Number(step) || 1);
  const pill = STOCK_PILL[product.stock];
  const pct = Math.min(100, Math.round((product.stockQty / FULL_STOCK) * 100));
  const barTone =
    product.stock === "out-of-stock"
      ? "bg-[#e04545]"
      : product.stock === "low-stock"
        ? "bg-accent"
        : "bg-ok-dot";

  const stepperBtn =
    "flex size-7 shrink-0 items-center justify-center rounded-md border border-[#dde3ea] text-ink-soft transition-colors hover:border-primary hover:text-primary disabled:opacity-50";
  const numInput =
    "rounded-md border border-[#dde3ea] px-2 py-1 text-center font-mono text-[12px] text-ink outline-none transition-colors focus:border-primary disabled:opacity-50";

  return (
    <tr className={ROW}>
      <td className={TD}>
        <div className="flex items-center gap-3">
          <div className="relative size-10 shrink-0 overflow-hidden rounded-lg border border-hairline bg-surface">
            <Image src={product.image} alt="" fill sizes="40px" className="object-contain p-1" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-mono text-[12px] font-semibold text-ink">
              {product.partNumber}
            </p>
            <p className="truncate text-[11px] text-[#8a94a6]">{product.name}</p>
          </div>
        </div>
      </td>
      <td className={`${TD} text-ink-muted`}>{categoryName}</td>
      <td className={TD}>
        <div className="flex items-center gap-2.5">
          <span className="w-8 shrink-0 font-mono text-[13px] font-bold text-ink">
            {product.stockQty}
          </span>
          <span className="hidden h-1.5 w-14 shrink-0 overflow-hidden rounded-full bg-hairline sm:block">
            <span className={`block h-full rounded-full ${barTone}`} style={{ width: `${pct}%` }} />
          </span>
          <Pill tone={pill.tone}>{pill.label}</Pill>
        </div>
      </td>
      <td className={TD}>
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            aria-label={`Stock out ${n}`}
            className={stepperBtn}
            disabled={busy}
            onClick={() => patch({ stockQty: -n, delta: true })}
          >
            <Minus className="size-3.5" />
          </button>
          <input
            type="number"
            min="1"
            aria-label="Adjustment amount"
            value={step}
            onChange={(e) => setStep(e.target.value)}
            disabled={busy}
            className={`${numInput} w-12`}
          />
          <button
            type="button"
            aria-label={`Stock in ${n}`}
            className={stepperBtn}
            disabled={busy}
            onClick={() => patch({ stockQty: n, delta: true })}
          >
            <Plus className="size-3.5" />
          </button>

          <span className="mx-1 hidden h-5 w-px bg-slate-line sm:block" />

          <input
            type="number"
            min="0"
            aria-label="Exact quantity"
            value={exact}
            onChange={(e) => setExact(e.target.value)}
            disabled={busy}
            className={`${numInput} w-16`}
          />
          <button
            type="button"
            disabled={busy}
            onClick={() => patch({ stockQty: Number(exact) || 0, delta: false })}
            className="inline-flex shrink-0 items-center gap-1 rounded-md border border-[#dde3ea] px-2.5 py-1.5 text-[11.5px] font-semibold text-ink-soft transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
          >
            <Check className="size-3.5" /> Set
          </button>
        </div>
      </td>
    </tr>
  );
}

export function StockClient({
  initialProducts,
  categories,
}: {
  initialProducts: Product[];
  categories: Category[];
}) {
  const router = useRouter();
  const [filter, setFilter] = useState<"all" | StockStatus>("all");

  const categoryName = (slug: string) => categories.find((c) => c.slug === slug)?.name ?? slug;
  const count = (s: StockStatus) => initialProducts.filter((p) => p.stock === s).length;

  // Needs-attention first: out of stock, then low, then the rest.
  const RANK: Record<StockStatus, number> = { "out-of-stock": 0, "low-stock": 1, "in-stock": 2 };
  const sorted = [
    ...(filter === "all" ? initialProducts : initialProducts.filter((p) => p.stock === filter)),
  ].sort((a, b) => RANK[a.stock] - RANK[b.stock] || a.stockQty - b.stockQty);

  const needsAttention = count("low-stock") + count("out-of-stock");

  return (
    <div className="space-y-4">
      <PageHeader
        title="Stock control"
        subtitle="Adjust stock levels with stock in / stock out, or set an exact quantity."
      >
        <FilterBar
          value={filter}
          onChange={setFilter}
          options={[
            { value: "all", label: "All", count: initialProducts.length },
            { value: "low-stock", label: "Low", count: count("low-stock") },
            { value: "out-of-stock", label: "Out", count: count("out-of-stock") },
            { value: "in-stock", label: "In stock", count: count("in-stock") },
          ]}
        />
      </PageHeader>

      {needsAttention > 0 && (
        <div className="flex flex-wrap items-center gap-2.5 rounded-[10px] border border-[#f6cfcf] bg-[#fef6f6] px-4 py-3">
          <Pill tone="danger">{needsAttention} LOW</Pill>
          <p className="text-[12.5px] text-[#7a2f2f]">
            {count("out-of-stock")} out of stock · {count("low-stock")} running low. Shown first.
          </p>
        </div>
      )}

      {sorted.length === 0 ? (
        <EmptyState>No products in this view.</EmptyState>
      ) : (
        <Panel className="overflow-hidden">
          <div className="scrollbar-slim overflow-x-auto">
            <table className="w-full text-[12.5px]">
              <thead className="bg-surface">
                <tr>
                  <th className={TH}>PRODUCT</th>
                  <th className={TH}>CATEGORY</th>
                  <th className={TH}>ON HAND</th>
                  <th className={TH}>ADJUST</th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((p) => (
                  <StockRow
                    key={p.slug}
                    product={p}
                    categoryName={categoryName(p.categorySlug)}
                    onChanged={() => router.refresh()}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
}
