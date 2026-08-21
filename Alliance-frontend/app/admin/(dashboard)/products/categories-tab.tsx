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
import type { Category } from "@/app/lib/types";

export function CategoriesTab({
  categories,
  onCreated,
}: {
  categories: Category[];
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      // Two calls by design: the API creates the category from JSON and takes
      // the icon as a separate multipart upload, keyed by the slug it just
      // generated. The category is still created if the icon fails.
      const created = await apiFetch<Category>("/api/admin/categories", {
        method: "POST",
        body: { name },
      });

      if (icon) {
        const form = new FormData();
        form.set("file", icon);
        try {
          await apiUpload(
            `/api/admin/categories/${encodeURIComponent(created.slug)}/icon`,
            form
          );
        } catch {
          toast.warning(`Category "${name}" created, but the icon failed to upload.`);
          setName("");
          setIcon(null);
          setOpen(false);
          onCreated();
          return;
        }
      }

      toast.success(`Category "${name}" created.`);
      setName("");
      setIcon(null);
      setOpen(false);
      onCreated();
    } catch (err) {
      const message =
        err instanceof ApiError ? err.message : "Could not create category.";
      setError(message);
      toast.error(message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="font-mono text-[11px] text-[#8a94a6]">
          {categories.length} CATEGORIES
        </p>
        <Dialog
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            if (!next) {
              setName("");
              setIcon(null);
              setError(null);
            }
          }}
        >
          <DialogTrigger render={<Button><Plus /> Create Category</Button>} />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Category</DialogTitle>
              <DialogDescription>Add a new product category. Icon is optional — a default icon is used otherwise.</DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="category-name">Category Name</Label>
                <Input id="category-name" value={name} onChange={(e) => setName(e.target.value)} required />
                {error && <p className="text-xs text-destructive">{error}</p>}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="category-icon">Icon (optional)</Label>
                <Input id="category-icon" type="file" accept="image/*" onChange={(e) => setIcon(e.target.files?.[0] ?? null)} />
              </div>
              <DialogFooter>
                <Button type="submit" disabled={submitting}>
                  {submitting ? "Saving..." : "Create Category"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {categories.map((c) => (
          <CategoryCard key={c.slug} category={c} onChanged={onCreated} />
        ))}
      </div>
    </div>
  );
}

function CategoryCard({
  category,
  onChanged,
}: {
  category: Category;
  onChanged: () => void;
}) {
  const [renaming, setRenaming] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  return (
    <div className="group relative rounded-[10px] border border-slate-line bg-white p-5 text-center transition-colors hover:border-primary/40">
      {/* Revealed on hover, but always reachable by keyboard: focus-within
          keeps them visible once tabbed to, so they are not mouse-only. */}
      <div className="absolute right-2 top-2 flex gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
        <IconButton
          label={`Rename ${category.name}`}
          onClick={() => setRenaming(true)}
        >
          <Pencil className="size-3.5" />
        </IconButton>
        <IconButton
          label={`Delete ${category.name}`}
          tone="danger"
          onClick={() => setConfirmingDelete(true)}
        >
          <Trash2 className="size-3.5" />
        </IconButton>
      </div>

      <div className="relative mx-auto mb-3 size-12">
        <Image src={category.icon} alt="" fill sizes="48px" className="object-contain" />
      </div>
      <p className="text-[13px] font-semibold text-ink">{category.name}</p>
      <p className="mt-0.5 font-mono text-[11px] text-[#8a94a6]">
        {category.productCount} PRODUCTS
      </p>

      <RenameCategoryDialog
        category={category}
        open={renaming}
        onOpenChange={setRenaming}
        onRenamed={onChanged}
      />
      <DeleteCategoryDialog
        category={category}
        open={confirmingDelete}
        onOpenChange={setConfirmingDelete}
        onDeleted={onChanged}
      />
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

function RenameCategoryDialog({
  category,
  open,
  onOpenChange,
  onRenamed,
}: {
  category: Category;
  open: boolean;
  onOpenChange: (next: boolean) => void;
  onRenamed: () => void;
}) {
  const [name, setName] = useState(category.name);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || trimmed === category.name) {
      onOpenChange(false);
      return;
    }
    setBusy(true);
    try {
      await apiFetch(`/api/admin/categories/${encodeURIComponent(category.slug)}`, {
        method: "PATCH",
        body: { name: trimmed },
      });
      toast.success(`Renamed to "${trimmed}".`);
      onOpenChange(false);
      onRenamed();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Could not rename the category."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) setName(category.name);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Rename category</DialogTitle>
          <DialogDescription>
            Changes the display name only. Product links and the storefront
            address for this category stay as they are.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-4 text-left">
          <div className="space-y-1.5">
            <Label htmlFor={`rename-${category.slug}`}>Category name</Label>
            <Input
              id={`rename-${category.slug}`}
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

function DeleteCategoryDialog({
  category,
  open,
  onOpenChange,
  onDeleted,
}: {
  category: Category;
  open: boolean;
  onOpenChange: (next: boolean) => void;
  onDeleted: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const hasProducts = category.productCount > 0;

  async function remove() {
    setBusy(true);
    try {
      await apiFetch(`/api/admin/categories/${encodeURIComponent(category.slug)}`, {
        method: "DELETE",
      });
      toast.success(`Category "${category.name}" deleted.`);
      onOpenChange(false);
      onDeleted();
    } catch (err) {
      // The API refuses with 409 when products still reference it. Its message
      // names the count, so it is shown as-is rather than restated here.
      toast.error(
        err instanceof ApiError ? err.message : "Could not delete the category."
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete “{category.name}”?</DialogTitle>
          <DialogDescription>
            {hasProducts
              ? `This category still holds ${category.productCount} product${
                  category.productCount === 1 ? "" : "s"
                }. Move or delete ${
                  category.productCount === 1 ? "it" : "them"
                } first — a category in use cannot be deleted.`
              : "This category is empty and can be safely deleted. This cannot be undone."}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={busy}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={remove}
            disabled={busy || hasProducts}
          >
            {busy ? "Deleting..." : "Delete category"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
