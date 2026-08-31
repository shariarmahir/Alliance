"use client";

import { useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { Button } from "@/app/components/ui/button";
import { Input } from "@/app/components/ui/input";
import { Label } from "@/app/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogTrigger,
} from "@/app/components/ui/dialog";
import { apiFetch, apiUpload, ApiError } from "@/app/lib/api-browser";
import type { Brand } from "@/app/lib/types";

export function BrandsTab({
  brands,
  onCreated,
}: {
  brands: Brand[];
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [logo, setLogo] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      // Two calls by design, same as Categories: the API creates the brand
      // from JSON and takes the logo as a separate multipart upload, keyed by
      // the slug it just generated. The brand is still created if the logo
      // upload fails.
      const created = await apiFetch<Brand>("/api/admin/brands", {
        method: "POST",
        body: { name },
      });

      if (logo) {
        const form = new FormData();
        form.set("file", logo);
        try {
          await apiUpload(`/api/admin/brands/${encodeURIComponent(created.slug)}/logo`, form);
        } catch {
          toast.warning(`Brand "${name}" created, but the logo failed to upload.`);
          setName("");
          setLogo(null);
          setOpen(false);
          onCreated();
          return;
        }
      }

      toast.success(`Brand "${name}" created.`);
      setName("");
      setLogo(null);
      setOpen(false);
      onCreated();
    } catch (err) {
      const message = err instanceof ApiError ? err.message : "Could not create brand.";
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[11px] text-[#8a94a6]">{brands.length} BRANDS</p>
        <Dialog
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (!next) {
              setName("");
              setLogo(null);
              setError(null);
            }
          }}
        >
          <DialogTrigger render={<Button><Plus /> Add Brand</Button>} />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Brand</DialogTitle>
              <DialogDescription>
                Add a new product brand. Logo is optional — a text wordmark is used
                otherwise.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="brand-name">Brand Name</Label>
                <Input id="brand-name" value={name} onChange={(e) => setName(e.target.value)} required />
                {error && <p className="text-xs text-destructive">{error}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="brand-logo">Logo (optional)</Label>
                <Input
                  id="brand-logo"
                  type="file"
                  accept="image/*"
                  onChange={(e) => setLogo(e.target.files?.[0] ?? null)}
                />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Saving..." : "Add Brand"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {brands.map((b) => (
          <BrandCard key={b.slug} brand={b} onChanged={onCreated} />
        ))}
      </div>
    </div>
  );
}

function BrandCard({
  brand,
  onChanged,
}: {
  brand: Brand;
  onChanged: () => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <div className="group relative rounded-[10px] border border-slate-line bg-white p-5 text-center transition-colors hover:border-primary/40">
      {/* Revealed on hover, but always reachable by keyboard: focus-within
          keeps them visible once tabbed to, so they are not mouse-only. */}
      <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
        <IconButton label={`Rename ${brand.name}`} onClick={() => setRenaming(true)}>
          <Pencil className="size-3.5" />
        </IconButton>
        <IconButton label={`Delete ${brand.name}`} tone="danger" onClick={() => setConfirmingDelete(true)}>
          <Trash2 className="size-3.5" />
        </IconButton>
      </div>

      <div className="relative mx-auto mb-3 flex size-12 items-center justify-center">
        {brand.logo ? (
          <Image src={brand.logo} alt="" fill sizes="48px" className="object-contain" />
        ) : (
          <span className="text-[13px] font-bold text-ink-muted">{brand.name.slice(0, 2).toUpperCase()}</span>
        )}
      </div>
      <p className="text-[13px] font-semibold text-ink">{brand.name}</p>
      <p className="mt-0.5 font-mono text-[11px] text-[#8a94a6]">
        {brand.productCount ?? 0} PRODUCTS
      </p>

      <RenameBrandDialog brand={brand} open={renaming} onOpenChange={setRenaming} onRenamed={onChanged} />
      <DeleteBrandDialog brand={brand} open={confirmingDelete} onOpenChange={setConfirmingDelete} onDeleted={onChanged} />
    </div>
  );
}

function IconButton({
  label,
  tone = "default",
  onClick,
  children,
}: {
  label: string;
  tone?: "default" | "danger";
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={`flex size-7 items-center justify-center rounded-md border bg-white transition-colors ${
        tone === "danger"
          ? "border-[#f0d0d0] text-[#c22] hover:border-[#c22] hover:bg-[#c22] hover:text-white"
          : "border-[#dde3ea] text-ink-soft hover:border-primary hover:text-primary"
      }`}
    >
      {children}
    </button>
  );
}

function RenameBrandDialog({
  brand,
  open,
  onOpenChange,
  onRenamed,
}: {
  brand: Brand;
  open: boolean;
  onOpenChange: (next: boolean) => void;
  onRenamed: () => void;
}) {
  const [name, setName] = useState(brand.name);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || trimmed === brand.name) {
      onOpenChange(false);
      return;
    }
    setBusy(true);
    try {
      await apiFetch(`/api/admin/brands/${encodeURIComponent(brand.slug)}`, {
        method: "PATCH",
        body: { name: trimmed },
      });
      toast.success(`Renamed to "${trimmed}".`);
      onOpenChange(false);
      onRenamed();
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Could not rename the brand.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setName(brand.name);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename brand</DialogTitle>
          <DialogDescription>
            Every product currently under this brand is updated to the new name too —
            there is no separate link between them to leave behind.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4 text-left">
          <div className="space-y-1.5">
            <Label htmlFor={`rename-${brand.slug}`}>Brand name</Label>
            <Input
              id={`rename-${brand.slug}`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              required
            />
          </div>
          <DialogFooter>
            <Button type="submit" disabled={busy}>
              {busy ? "Saving..." : "Save name"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function DeleteBrandDialog({
  brand,
  open,
  onOpenChange,
  onDeleted,
}: {
  brand: Brand;
  open: boolean;
  onOpenChange: (next: boolean) => void;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const productCount = brand.productCount ?? 0;
  const hasProducts = productCount > 0;

  async function remove() {
    setBusy(true);
    try {
      await apiFetch(`/api/admin/brands/${encodeURIComponent(brand.slug)}`, {
        method: "DELETE",
      });
      toast.success(`Brand "${brand.name}" deleted.`);
      onOpenChange(false);
      onDeleted();
    } catch (err) {
      // The API refuses with 409 when products still reference it. Its
      // message names the count, so it is shown as-is rather than restated.
      toast.error(err instanceof ApiError ? err.message : "Could not delete the brand.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete &ldquo;{brand.name}&rdquo;?</DialogTitle>
          <DialogDescription>
            {hasProducts
              ? `This brand still holds ${productCount} product${
                  productCount === 1 ? "" : "s"
                }. Move or delete ${
                  productCount === 1 ? "it" : "them"
                } first — a brand in use cannot be deleted.`
              : "This brand is unused and can be safely deleted. This cannot be undone."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" onClick={remove} disabled={busy || hasProducts}>
            {busy ? "Deleting..." : "Delete brand"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
