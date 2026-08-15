"use client";

import { useState } from "react";
import Image from "next/image";
import { toast } from "sonner";
import { Plus } from "lucide-react";
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
import type { Category } from "@/app/lib/types";

export function CategoriesTab({ categories, onCreated }: { categories: Category[]; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [icon, setIcon] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const form = new FormData();
    form.set("name", name);
    if (icon) form.set("icon", icon);

    try {
      const res = await fetch("/api/admin/categories", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setError(data.errors?.name ?? "Could not create category.");
        toast.error("Could not create category.");
        return;
      }
      toast.success(`Category "${name}" created.`);
      setName("");
      setIcon(null);
      setOpen(false);
      onCreated();
    } catch {
      toast.error("Could not save changes.");
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
          <div
            key={c.slug}
            className="rounded-[10px] border border-slate-line bg-white p-5 text-center transition-colors hover:border-primary/40"
          >
            <div className="relative mx-auto mb-3 size-12">
              <Image src={c.icon} alt="" fill sizes="48px" className="object-contain" />
            </div>
            <p className="text-[13px] font-semibold text-ink">{c.name}</p>
            <p className="mt-0.5 font-mono text-[11px] text-[#8a94a6]">
              {c.productCount} PRODUCTS
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
