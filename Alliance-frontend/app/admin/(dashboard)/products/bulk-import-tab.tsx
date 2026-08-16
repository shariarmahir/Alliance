"use client";

import { useState } from "react";
import { toast } from "sonner";
import { UploadCloud, AlertTriangle } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Textarea } from "@/app/components/ui/textarea";
import { Label } from "@/app/components/ui/label";
import { Input } from "@/app/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/app/components/ui/select";
import type { BulkImportError, Category } from "@/app/lib/types";

// Prices are BDT — the example figures reflect that scale so a new admin
// pasting a real line doesn't anchor on 100x-too-small numbers.
const PLACEHOLDER = `1. SIMATIC S7-1500 CPU | 6ES7515-2AM02-0AB0 | 152500 | Compact PLC, 24V DC, PROFINET | in-stock
2. SINAMICS G120C Drive | 6SL3210-1KE21-3UF1 | 108580 | 3-phase, 1.3kW, IP20 | in-stock
3. SIRIUS Contactor 9A | 3RT2015-1BB41 | 5490 | 24V DC coil, AC-3 rated | low-stock`;

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

  // Leading "N." on each non-empty line — drives the parsed-line count and the
  // per-image LINE badge, mirroring the design's match validation panel.
  const lineNumbers = productsText
    .split("\n")
    .map((l) => Number(/^\s*(\d+)\./.exec(l)?.[1]))
    .filter((n) => Number.isFinite(n));

  function matchedLine(file: File): number | null {
    const n = Number(/^(\d+)/.exec(file.name)?.[1]);
    return Number.isFinite(n) && lineNumbers.includes(n) ? n : null;
  }

  const selectedCategory = categories.find((c) => c.slug === categorySlug);

  return (
    <form onSubmit={handleSubmit}>
      <h2 className="mb-1 text-[23px] font-bold tracking-[-0.02em] text-ink">
        Bulk import{selectedCategory ? ` — ${selectedCategory.name}` : ""}
      </h2>
      <p className="mb-5 max-w-3xl text-[13px] leading-[1.65] text-ink-muted">
        Paste a numbered product list, then drop the matching images. Line{" "}
        <strong className="font-mono text-ink">1.</strong> pairs with{" "}
        <strong className="font-mono text-ink">1.&lt;name&gt;.jpg</strong>. Anything that doesn&apos;t
        pair is refused before saving.
      </p>

      <div className="mb-5 max-w-xs">
        <Label className="mono-label mb-1.5 block text-[10.5px] tracking-[0.06em] text-ink-muted">
          CATEGORY
        </Label>
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

      <div className="grid gap-4.5 lg:grid-cols-2">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="mono-label text-[11px] tracking-[0.07em] text-ink-muted">PRODUCT LIST</span>
            <span className="font-mono text-[11px] text-[#8a94a6]">
              {lineNumbers.length} LINES PARSED
            </span>
          </div>
          <Textarea
            id="productsText"
            value={productsText}
            onChange={(e) => setProductsText(e.target.value)}
            placeholder={PLACEHOLDER}
            className="min-h-[210px] rounded-[9px] border-[#dde3ea] bg-[#0d1626] font-mono text-xs leading-[2] text-[#cfe0ee] placeholder:text-[#4a5a6e]"
          />
          <p className="mt-2 font-mono text-[11px] text-[#8a94a6]">
            {"// name | part number | price | short specs | stock status"}
          </p>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="mono-label text-[11px] tracking-[0.07em] text-ink-muted">
              PRODUCT IMAGES
            </span>
            <span className="font-mono text-[11px] text-[#8a94a6]">{images.length} FILES</span>
          </div>
          <div className="flex min-h-[210px] flex-col gap-2 rounded-[9px] border-[1.5px] border-dashed border-tint-line bg-[#f4faff] p-3.5">
            {images.map((file) => {
              const line = matchedLine(file);
              return (
                <div
                  key={file.name}
                  className={`flex items-center gap-2.5 rounded-[7px] border bg-white px-2.5 py-2.5 ${
                    line ? "border-[#d8ecf9]" : "border-[#f6cfcf]"
                  }`}
                >
                  <span
                    className={`flex size-6.5 shrink-0 items-center justify-center rounded-[5px] text-xs font-bold ${
                      line ? "bg-ok-bg text-ok-dot" : "bg-[#fdecec] text-[#c22]"
                    }`}
                  >
                    {line ? "✓" : "!"}
                  </span>
                  <span className="min-w-0 flex-1 truncate font-mono text-xs text-ink">{file.name}</span>
                  <span
                    className={`shrink-0 font-mono text-[10.5px] font-medium ${
                      line ? "text-ok" : "text-[#c22]"
                    }`}
                  >
                    {line ? `LINE ${line}` : "NO MATCH"}
                  </span>
                </div>
              );
            })}
            <Input
              id="bulk-images"
              type="file"
              accept="image/*"
              multiple
              onChange={(e) => setImages(e.target.files ? Array.from(e.target.files) : [])}
              className="mt-auto border-0 bg-transparent text-[11.5px] text-[#00618f] shadow-none"
            />
          </div>
        </div>
      </div>

      {errors.length > 0 && (
        <div className="mt-4 rounded-[9px] border border-[#f6cfcf] bg-[#fef6f6] p-4.5">
          <p className="mb-2.5 flex items-center gap-2 text-[13px] font-semibold text-[#c22]">
            <AlertTriangle className="size-4" />
            {errors.length} problem{errors.length > 1 ? "s" : ""} must be fixed before saving
          </p>
          <div className="flex flex-col gap-2 text-[12.5px] text-[#7a2f2f]">
            {errors.map((err, idx) => (
              <span key={idx} className="flex gap-2.5">
                <strong className="min-w-14 shrink-0 font-mono text-[11px] font-semibold text-[#c22]">
                  {err.lineNumber !== null ? `LINE ${err.lineNumber}` : "IMAGE"}
                </strong>
                {err.message}
              </span>
            ))}
          </div>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <span className="text-[12.5px] text-[#8a94a6]">
          {lineNumbers.length} line{lineNumbers.length === 1 ? "" : "s"} ready · images are written to{" "}
          <strong className="font-mono text-ink-soft">
            /public/products/{categorySlug || "<category>"}/
          </strong>
        </span>
        <Button type="submit" disabled={submitting}>
          <UploadCloud /> {submitting ? "Validating..." : `Import ${lineNumbers.length} products`}
        </Button>
      </div>
    </form>
  );
}
