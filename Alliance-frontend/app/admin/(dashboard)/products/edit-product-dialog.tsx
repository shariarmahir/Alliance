"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/app/components/ui/dialog";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/app/components/ui/select";
import { apiFetch, apiUpload, ApiError } from "@/app/lib/api-browser";
import type { Brand, Category, Product } from "@/app/lib/types";

// Matches the Add dialog. slugify() lowercases and strips punctuation, so no
// stored brand slug can collide with this.
const OTHER_BRAND = "__other__";

// Editing an existing product. Deliberately narrower than Add: the fields an
// admin actually revisits are the price, the stock, the commercial details
// and the picture. Specs and alternate part numbers are set once when the
// product is catalogued, and re-typing them here is how a good record gets
// damaged.
//
// The slug is not editable either. It is the product's public URL, and
// changing it breaks every link and quotation line already pointing at it.

export function EditProductDialog({
  product,
  categories,
  brands,
  onSaved,
}: {
  product: Product;
  categories: Category[];
  brands: Brand[];
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(product.name);
  const [partNumber, setPartNumber] = useState(product.partNumber);
  const [categorySlug, setCategorySlug] = useState(product.categorySlug);
  const [brand, setBrand] = useState(product.brand);
  const [customBrand, setCustomBrand] = useState("");
  // Empty rather than "0": a product nobody has costed reads "Not set" in the
  // table, and pre-filling a zero here would quietly turn that into a price.
  const [price, setPrice] = useState(product.price ? String(product.price) : "");
  const [stockQty, setStockQty] = useState(String(product.stockQty));
  const [warrantyYears, setWarrantyYears] = useState(String(product.warrantyYears));
  const [image, setImage] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim() || !partNumber.trim()) {
      toast.error("Name and part number are required.");
      return;
    }
    if (brand === OTHER_BRAND && !customBrand.trim()) {
      toast.error("Type the new brand name.");
      return;
    }
    setBusy(true);
    try {
      await apiFetch(`/api/admin/products/${encodeURIComponent(product.slug)}`, {
        method: "PATCH",
        body: {
          name: name.trim(),
          partNumber: partNumber.trim(),
          categorySlug,
          brand: brand === OTHER_BRAND ? customBrand.trim() : brand,
          price: Number(price) || 0,
          stockQty: Number(stockQty) || 0,
          warrantyYears: Number(warrantyYears) || 0,
        },
      });

      // A failed picture must not discard the fields that already saved, so
      // this warns rather than throwing.
      if (image) {
        const form = new FormData();
        form.set("file", image);
        try {
          await apiUpload(
            `/api/admin/products/${encodeURIComponent(product.slug)}/image`,
            form
          );
        } catch {
          toast.warning("Details saved, but the image could not be uploaded.");
        }
      }

      toast.success(`${partNumber} updated.`);
      setOpen(false);
      setImage(null);
      onSaved();
    } catch (error) {
      toast.error(
        error instanceof ApiError ? error.message : "Could not update the product."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={
          <button
            type="button"
            aria-label={`Edit ${product.partNumber}`}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-[#dde3ea] text-ink-soft transition-colors hover:border-primary hover:text-primary"
          >
            <Pencil className="size-3.5" />
          </button>
        }
      />
      <DialogContent className="max-h-[85vh] w-full max-w-lg overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-[17px] font-bold text-ink">Edit product</DialogTitle>
          <DialogDescription className="font-mono text-[11.5px] text-[#8a94a6]">
            {product.slug}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={save} className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="edit-name">Name</Label>
            <Input id="edit-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-part">Part number</Label>
              <Input
                id="edit-part"
                value={partNumber}
                onChange={(e) => setPartNumber(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-price">Price (admin only)</Label>
              <Input
                id="edit-price"
                type="number"
                min="0"
                step="0.01"
                placeholder="Not set"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={categorySlug} onValueChange={(v) => setCategorySlug(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.slug} value={c.slug}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Brand</Label>
              <Select value={brand} onValueChange={(v) => setBrand(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a brand" />
                </SelectTrigger>
                <SelectContent>
                  {brands.map((b) => (
                    <SelectItem key={b.slug} value={b.slug}>
                      {b.name}
                    </SelectItem>
                  ))}
                  <SelectItem value={OTHER_BRAND}>Other (type a new brand)</SelectItem>
                </SelectContent>
              </Select>
              {brand === OTHER_BRAND && (
                <Input
                  autoFocus
                  placeholder="e.g. Delta Electronics"
                  value={customBrand}
                  onChange={(e) => setCustomBrand(e.target.value)}
                />
              )}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-stock">Stock quantity</Label>
              <Input
                id="edit-stock"
                type="number"
                min="0"
                value={stockQty}
                onChange={(e) => setStockQty(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-warranty">Warranty (years)</Label>
              <Input
                id="edit-warranty"
                type="number"
                min="0"
                value={warrantyYears}
                onChange={(e) => setWarrantyYears(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="edit-image">Replace image</Label>
            <Input
              id="edit-image"
              type="file"
              accept="image/*"
              onChange={(e) => setImage(e.target.files?.[0] ?? null)}
            />
            <p className="text-[11px] text-[#8a94a6]">
              Leave empty to keep the current picture.
            </p>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving..." : "Save changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
