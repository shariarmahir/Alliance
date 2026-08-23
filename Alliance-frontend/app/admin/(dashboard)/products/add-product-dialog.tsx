"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Plus, X } from "lucide-react";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import type { Brand, Category } from "@/app/lib/types";
import { apiFetch, apiUpload, ApiError } from "@/app/lib/api-browser";

type RepeatableListProps = {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder: string;
};

function RepeatableList({ label, values, onChange, placeholder }: RepeatableListProps) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <div className="space-y-1.5">
        {values.map((value, idx) => (
          <div key={idx} className="flex items-center gap-1.5">
            <Input
              value={value}
              placeholder={placeholder}
              onChange={(e) => {
                const next = [...values];
                next[idx] = e.target.value;
                onChange(next);
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={() => onChange(values.filter((_, i) => i !== idx))}
            >
              <X className="size-3.5" />
            </Button>
          </div>
        ))}
        <Button type="button" variant="outline" size="sm" onClick={() => onChange([...values, ""])}>
          <Plus className="size-3.5" /> Add
        </Button>
      </div>
    </div>
  );
}

type SpecRow = { key: string; value: string };

// Matches MAX_GALLERY_IMAGES in the backend's catalog router; the API rejects
// anything beyond this, so the picker stops offering slots at the same point.
const MAX_GALLERY = 3;

export function AddProductDialog({
  categories,
  brands,
  onCreated,
}: {
  categories: Category[];
  brands: Brand[];
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const [name, setName] = useState("");
  const [partNumber, setPartNumber] = useState("");
  const [categorySlug, setCategorySlug] = useState("");
  const [brand, setBrand] = useState("");
  const [warrantyYears, setWarrantyYears] = useState("2");
  const [stockQty, setStockQty] = useState("50");
  const [shortSpecs, setShortSpecs] = useState<string[]>(["", "", ""]);
  const [description, setDescription] = useState<string[]>([""]);
  const [alternatePartNumbers, setAlternatePartNumbers] = useState<string[]>([]);
  const [specs, setSpecs] = useState<SpecRow[]>([{ key: "", value: "" }]);
  const [image, setImage] = useState<File | null>(null);
  // null = an empty slot the admin added but has not picked a file for yet.
  const [gallery, setGallery] = useState<(File | null)[]>([]);

  function resetForm() {
    setName("");
    setPartNumber("");
    setCategorySlug("");
    setBrand("");
    setWarrantyYears("2");
    setStockQty("50");
    setShortSpecs(["", "", ""]);
    setDescription([""]);
    setAlternatePartNumbers([]);
    setSpecs([{ key: "", value: "" }]);
    setImage(null);
    setGallery([]);
    setErrors({});
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErrors({});

    // The endpoint takes a JSON body, not multipart. Sending FormData made
    // Pydantic reject the whole request with "Input should be a valid
    // dictionary or object to extract fields from", because there was no JSON
    // object to read fields out of. Images are a separate upload below, since
    // a file cannot travel inside a JSON body.
    const specifications: Record<string, string> = {};
    specs.forEach((s) => {
      if (s.key.trim()) specifications[s.key.trim()] = s.value.trim();
    });

    try {
      const created = await apiFetch<{ slug: string }>("/api/admin/products", {
        method: "POST",
        body: {
          name,
          partNumber,
          categorySlug,
          brand,
          warrantyYears: Number(warrantyYears) || 0,
          stockQty: Number(stockQty) || 0,
          shortSpecs: shortSpecs.filter((s) => s.trim()),
          description: description.filter((s) => s.trim()),
          alternatePartNumbers: alternatePartNumbers.filter((s) => s.trim()),
          specifications,
        },
      });

      // Keyed by the slug the API just assigned. A failure here leaves a real
      // product with no picture rather than losing the whole submission, so it
      // warns instead of throwing away everything typed above.
      if (image) {
        const imageForm = new FormData();
        imageForm.set("file", image);
        try {
          await apiUpload(
            `/api/admin/products/${encodeURIComponent(created.slug)}/image`,
            imageForm
          );
        } catch {
          toast.warning(`"${name}" was saved, but the image could not be uploaded.`);
        }
      }

      // After the main image, which leads the gallery. Empty slots are
      // skipped so adding a picker and not using it is harmless.
      const extras = gallery.filter((f): f is File => f !== null);
      if (extras.length > 0) {
        const galleryForm = new FormData();
        extras.forEach((file) => galleryForm.append("files", file));
        try {
          await apiUpload(
            `/api/admin/products/${encodeURIComponent(created.slug)}/gallery`,
            galleryForm
          );
        } catch (err) {
          toast.warning(
            `"${name}" was saved, but the additional images could not be uploaded.`,
            { description: err instanceof ApiError ? err.message : undefined }
          );
        }
      }

      toast.success(`"${name}" added to the catalog.`);
      resetForm();
      setOpen(false);
      onCreated();
    } catch (err) {
      // A 422 carries per-field detail; keep surfacing it against the fields
      // rather than collapsing everything into one banner.
      const fields =
        err instanceof ApiError && err.details && !Array.isArray(err.details)
          ? (err.details as Record<string, string>)
          : null;
      setErrors(fields ?? { form: err instanceof ApiError ? err.message : "Could not save product." });
      toast.error(
        err instanceof ApiError ? err.message : "Could not add product."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) resetForm();
      }}
    >
      <DialogTrigger render={<Button><Plus /> Add Product</Button>} />
      <DialogContent className="max-h-[85vh] w-full max-w-2xl overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add Product</DialogTitle>
          <DialogDescription>Add a single product to the catalog with full details and images.</DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="name">Product Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
              {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="partNumber">Part Number</Label>
              <Input id="partNumber" value={partNumber} onChange={(e) => setPartNumber(e.target.value)} required />
              {errors.partNumber && <p className="text-xs text-destructive">{errors.partNumber}</p>}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label>Category</Label>
              <Select value={categorySlug} onValueChange={(v) => setCategorySlug(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.slug} value={c.slug}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.categorySlug && <p className="text-xs text-destructive">{errors.categorySlug}</p>}
            </div>
            <div className="space-y-1.5">
              <Label>Brand</Label>
              <Select value={brand} onValueChange={(v) => setBrand(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select brand" />
                </SelectTrigger>
                <SelectContent>
                  {brands.map((b) => (
                    <SelectItem key={b.slug} value={b.slug}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.brand && <p className="text-xs text-destructive">{errors.brand}</p>}
            </div>
          </div>

          {/* No price field: this is a quotation business, and the figure that
              reaches a customer is the one set when a quote is accepted. */}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="warrantyYears">Warranty (years)</Label>
              <Input id="warrantyYears" type="number" min="0" value={warrantyYears} onChange={(e) => setWarrantyYears(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="stockQty">Initial Stock Qty</Label>
              <Input id="stockQty" type="number" min="0" value={stockQty} onChange={(e) => setStockQty(e.target.value)} />
              {errors.stockQty && <p className="text-xs text-destructive">{errors.stockQty}</p>}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Short Specs (shown on product cards)</Label>
            <div className="grid gap-1.5 sm:grid-cols-3">
              {shortSpecs.map((s, idx) => (
                <Input
                  key={idx}
                  value={s}
                  placeholder={`Spec ${idx + 1}`}
                  onChange={(e) => {
                    const next = [...shortSpecs];
                    next[idx] = e.target.value;
                    setShortSpecs(next);
                  }}
                />
              ))}
            </div>
          </div>

          <RepeatableList label="Description Bullets" values={description} onChange={setDescription} placeholder="Description bullet" />
          <RepeatableList label="Alternate Part Numbers" values={alternatePartNumbers} onChange={setAlternatePartNumbers} placeholder="Alternate part number" />

          <div className="space-y-1.5">
            <Label>Specifications</Label>
            <div className="space-y-1.5">
              {specs.map((row, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                  <Input
                    value={row.key}
                    placeholder="Key (e.g. Output Power)"
                    onChange={(e) => {
                      const next = [...specs];
                      next[idx] = { ...next[idx], key: e.target.value };
                      setSpecs(next);
                    }}
                  />
                  <Input
                    value={row.value}
                    placeholder="Value (e.g. 120 W)"
                    onChange={(e) => {
                      const next = [...specs];
                      next[idx] = { ...next[idx], value: e.target.value };
                      setSpecs(next);
                    }}
                  />
                  <Button type="button" variant="ghost" size="icon-sm" onClick={() => setSpecs(specs.filter((_, i) => i !== idx))}>
                    <X className="size-3.5" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => setSpecs([...specs, { key: "", value: "" }])}>
                <Plus className="size-3.5" /> Add Spec
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="image">Product Image</Label>
            <Input id="image" type="file" accept="image/*" onChange={(e) => setImage(e.target.files?.[0] ?? null)} required />
            <p className="text-xs text-muted-foreground">
              The main photo, shown first on the product page.
            </p>
            {errors.image && <p className="text-xs text-destructive">{errors.image}</p>}
          </div>

          {/* Up to three extra shots, which become the thumbnail strip under
              the main image on the product page. Added one slot at a time so
              a picker is only shown when it is wanted. */}
          <div className="space-y-1.5">
            <Label>Additional Images (optional)</Label>
            <div className="space-y-1.5">
              {gallery.map((file, idx) => (
                <div key={idx} className="flex items-center gap-1.5">
                  <Input
                    type="file"
                    accept="image/*"
                    aria-label={`Additional image ${idx + 1}`}
                    onChange={(e) => {
                      const next = [...gallery];
                      next[idx] = e.target.files?.[0] ?? null;
                      setGallery(next);
                    }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove additional image ${idx + 1}`}
                    onClick={() => setGallery(gallery.filter((_, i) => i !== idx))}
                  >
                    <X className="size-3.5" />
                  </Button>
                </div>
              ))}
              {gallery.length < MAX_GALLERY && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setGallery([...gallery, null])}
                >
                  <Plus className="size-3.5" /> Add Image
                </Button>
              )}
              <p className="text-xs text-muted-foreground">
                {gallery.length}/{MAX_GALLERY} added &middot; shown as thumbnails beside the
                main image.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting ? "Saving..." : "Save Product"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
