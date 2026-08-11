"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import { UploadCloud, ImageOff } from "lucide-react";
import { Card, CardContent } from "@/app/components/ui/card";
import { Button } from "@/app/components/ui/button";
import type { HeroImageEntry } from "@/app/lib/admin-catalog";

const SLOTS = [1, 2, 3, 4, 5];

function HeroSlotCard({ slot, path, onChanged }: { slot: number; path: string | undefined; onChanged: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    const form = new FormData();
    form.set("slot", String(slot));
    form.set("image", file);

    try {
      const res = await fetch("/api/admin/hero-images", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Could not upload hero image.");
        return;
      }
      toast.success(`Hero slot ${slot} updated.`);
      setFile(null);
      setPreview(null);
      onChanged();
    } catch {
      toast.error("Could not save changes.");
    } finally {
      setUploading(false);
    }
  }

  const displaySrc = preview ?? path;

  return (
    <Card className="overflow-hidden p-0">
      <div className="relative aspect-[420/480] w-full bg-muted sm:aspect-[16/9]">
        {displaySrc ? (
          <Image src={displaySrc} alt={`Hero slot ${slot}`} fill sizes="(min-width: 640px) 33vw, 100vw" className="object-cover" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <ImageOff className="size-8" />
            <span className="text-xs">No image set</span>
          </div>
        )}
        <span className="absolute top-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium text-white">
          Slot {slot}
        </span>
      </div>
      <CardContent className="flex items-center gap-2 p-4">
        <input
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="flex-1 text-xs text-muted-foreground file:mr-2 file:rounded-md file:border-0 file:bg-muted file:px-2 file:py-1 file:text-xs file:font-medium"
        />
        <Button type="button" size="sm" disabled={!file || uploading} onClick={handleUpload}>
          <UploadCloud className="size-3.5" /> {uploading ? "Uploading..." : "Replace"}
        </Button>
      </CardContent>
    </Card>
  );
}

export function HeroImagesClient({ initialImages }: { initialImages: HeroImageEntry[] }) {
  const router = useRouter();
  const byslot = new Map(initialImages.map((e) => [e.slot, e.path]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Hero Images</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Replace the background image for each of the storefront&apos;s 5 hero carousel slots. Headline and
          subheadline text are not editable here.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SLOTS.map((slot) => (
          <HeroSlotCard key={slot} slot={slot} path={byslot.get(slot)} onChanged={() => router.refresh()} />
        ))}
      </div>
    </div>
  );
}
