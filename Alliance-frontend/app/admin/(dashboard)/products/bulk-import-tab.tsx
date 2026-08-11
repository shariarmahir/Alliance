"use client";

import { useState } from "react";
import { toast } from "sonner";
import { UploadCloud, AlertTriangle } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import { Textarea } from "@/app/components/ui/textarea";
import { Label } from "@/app/components/ui/label";
import { Input } from "@/app/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import type { BulkImportError, Category } from "@/app/lib/types";

const PLACEHOLDER = `1. SIMATIC S7-1500 CPU | 6ES7515-2AM02-0AB0 | 1250 | Compact PLC, 24V DC, PROFINET | in-stock
2. SINAMICS G120C Drive | 6SL3210-1KE21-3UF1 | 890 | 3-phase, 1.3kW, IP20 | in-stock
3. SIRIUS Contactor 9A | 3RT2015-1BB41 | 45 | 24V DC coil, AC-3 rated | low-stock`;

export function BulkImportTab({ categories, onImported }: { categories: Category[]; onImported: () => void }) {
  const [categorySlug, setCategorySlug] = useState("");
  const [productsText, setProductsText] = useState("");
  const [images, setImages] = useState<File[]>([]);
  const [errors, setErrors] = useState<BulkImportError[]>([]);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setErrors([]);

    const form = new FormData();
    form.set("categorySlug", categorySlug);
    form.set("productsText", productsText);
    images.forEach((f) => form.append("images", f));

    try {
      const res = await fetch("/api/admin/products/bulk", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setErrors(data.errors ?? [{ lineNumber: null, message: "Could not import products." }]);
        toast.error("Bulk import failed. Fix the errors below and try again.");
        return;
      }
      toast.success(`${data.products?.length ?? 0} products imported.`);
      setProductsText("");
      setImages([]);
      setCategorySlug("");
      onImported();
    } catch {
      toast.error("Could not save changes.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Card className="p-6">
      <CardHeader className="px-0">
        <CardTitle>Bulk Import</CardTitle>
        <CardDescription>
          Paste a numbered product list and upload matching images. Image filenames must start with the same
          number as the product line (e.g. line &quot;2.&quot; matches &quot;2.png&quot; or &quot;2-drive.jpg&quot;).
          The whole batch is validated before anything is saved.
        </CardDescription>
      </CardHeader>
      <CardContent className="px-0">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="max-w-xs space-y-1.5">
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
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="productsText">Product List</Label>
            <Textarea
              id="productsText"
              value={productsText}
              onChange={(e) => setProductsText(e.target.value)}
              placeholder={PLACEHOLDER}
              className="min-h-48 font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Format: <code>N. Name | Part Number | Price | Short Specs (comma-separated) | stock status</code> — stock
              status is one of <code>in-stock</code>, <code>low-stock</code>, <code>out-of-stock</code>.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="bulk-images">Product Images</Label>
            <Input
              id="bulk-images"
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setImages(e.target.files ? Array.from(e.target.files) : [])}
            />
            {images.length > 0 && <p className="text-xs text-muted-foreground">{images.length} file(s) selected.</p>}
          </div>

          <Button type="submit" disabled={submitting}>
            <UploadCloud /> {submitting ? "Validating..." : "Validate & Import"}
          </Button>

          {errors.length > 0 && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-destructive">
                <AlertTriangle className="size-4" />
                {errors.length} error{errors.length > 1 ? "s" : ""} found — nothing was imported
              </div>
              <ul className="space-y-1 text-sm text-destructive">
                {errors.map((err, idx) => (
                  <li key={idx}>
                    {err.lineNumber !== null ? <span className="font-medium">Line {err.lineNumber}: </span> : null}
                    {err.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
