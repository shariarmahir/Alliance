"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import { Minus, Plus, Check } from "lucide-react";
import { Badge } from "@/app/components/ui/badge";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import type { Category, Product, StockStatus } from "@/app/lib/types";

const STOCK_BADGE: Record<StockStatus, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  "in-stock": { label: "In Stock", variant: "secondary" },
  "low-stock": { label: "Low Stock", variant: "default" },
  "out-of-stock": { label: "Out of Stock", variant: "destructive" },
};

function StockRow({ product, categoryName, onChanged }: { product: Product; categoryName: string; onChanged: () => void }) {
  const [stepQty, setStepQty] = useState("1");
  const [exactQty, setExactQty] = useState(String(product.stockQty));
  const [busy, setBusy] = useState(false);

  async function patch(body: { stockQty: number; delta?: boolean }) {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/products/${product.slug}/stock`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Could not update stock.");
        return;
      }
      toast.success(`${product.name}: stock updated to ${data.product.stockQty}.`);
      onChanged();
    } catch {
      toast.error("Could not save changes.");
    } finally {
      setBusy(false);
    }
  }

  const step = Math.max(1, Number(stepQty) || 1);

  return (
    <tr className="bg-card transition-colors duration-200 hover:bg-muted/50">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="relative size-10 shrink-0 overflow-hidden rounded-lg bg-muted">
            <Image src={product.image} alt={product.name} fill sizes="40px" className="object-contain p-1" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-medium text-foreground">{product.name}</p>
            <p className="truncate text-xs text-muted-foreground">{product.partNumber}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-3 text-muted-foreground">{categoryName}</td>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground">{product.stockQty}</span>
          <Badge variant={STOCK_BADGE[product.stock].variant} className="transition-colors duration-200">{STOCK_BADGE[product.stock].label}</Badge>
        </div>
      </td>
      <td className="px-4 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            type="number"
            min="1"
            value={stepQty}
            onChange={(e) => setStepQty(e.target.value)}
            className="w-16"
            disabled={busy}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => patch({ stockQty: step, delta: true })}
          >
            <Plus className="size-3.5" /> Stock In
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => patch({ stockQty: -step, delta: true })}
          >
            <Minus className="size-3.5" /> Stock Out
          </Button>
          <span className="mx-1 h-5 w-px bg-border" />
          <Input
            type="number"
            min="0"
            value={exactQty}
            onChange={(e) => setExactQty(e.target.value)}
            className="w-20"
            disabled={busy}
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={busy}
            onClick={() => patch({ stockQty: Number(exactQty) || 0, delta: false })}
          >
            <Check className="size-3.5" /> Set Exact
          </Button>
        </div>
      </td>
    </tr>
  );
}

export function StockClient({ initialProducts, categories }: { initialProducts: Product[]; categories: Category[] }) {
  const router = useRouter();
  const categoryName = (slug: string) => categories.find((c) => c.slug === slug)?.name ?? slug;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Stock</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Adjust stock levels with Stock In / Stock Out, or set an exact quantity directly.
        </p>
      </div>

      <div className="overflow-x-auto rounded-xl ring-1 ring-foreground/10">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Product</th>
              <th className="px-4 py-3 font-medium">Category</th>
              <th className="px-4 py-3 font-medium">Stock</th>
              <th className="px-4 py-3 font-medium">Adjust</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {initialProducts.map((p) => (
              <StockRow key={p.slug} product={p} categoryName={categoryName(p.categorySlug)} onChanged={() => router.refresh()} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
