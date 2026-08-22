"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import { UploadCloud, ImageOff } from "lucide-react";
import { PageHeader, Panel, Pill } from "../admin-ui";
import type { HeroImageEntry } from "@/app/lib/catalog-data";
import { apiUpload, ApiError } from "@/app/lib/api-browser";

const SLOTS = [1, 2, 3, 4, 5];

function HeroSlotCard({
  slot,
  path,
  onChanged,
}: {
  slot: number;
  path: string | undefined;
  onChanged: () => void;
}) {
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
      // apiUpload, not fetch: a relative path resolves against this app's own
      // origin, which serves no API — in production that is a 404.
      await apiUpload("/api/admin/hero-images", form);
      toast.success(`Hero slot ${slot} updated.`);
      setFile(null);
      setPreview(null);
      onChanged();
    } catch (err) {
      toast.error(
        err instanceof ApiError ? err.message : "Could not upload hero image."
      );
    } finally {
      setUploading(false);
    }
  }

  const displaySrc = preview ?? path;

  return (
    <Panel className="overflow-hidden">
      <div className="relative aspect-video w-full bg-surface">
        {displaySrc ? (
          <Image
            src={displaySrc}
            alt=""
            fill
            sizes="(min-width: 640px) 33vw, 100vw"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-ink-muted">
            <ImageOff className="size-7" />
            <span className="font-mono text-[10.5px]">NO IMAGE SET</span>
          </div>
        )}
        <span className="absolute left-2.5 top-2.5 rounded-[5px] bg-ink/75 px-2 py-1 font-mono text-[10px] font-semibold text-white">
          SLOT {slot}
        </span>
        {preview && (
          <span className="absolute right-2.5 top-2.5">
            <Pill tone="warn">UNSAVED</Pill>
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 border-t border-slate-line p-3.5">
        <input
          type="file"
          accept="image/*"
          aria-label={`Replace hero slot ${slot}`}
          onChange={handleFileChange}
          className="min-w-0 flex-1 text-[11px] text-ink-muted file:mr-2 file:rounded-md file:border file:border-[#dde3ea] file:bg-white file:px-2 file:py-1 file:text-[11px] file:font-semibold file:text-ink-soft"
        />
        <button
          type="button"
          disabled={!file || uploading}
          onClick={handleUpload}
          className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-[#dde3ea] px-2.5 py-1.5 text-[11.5px] font-semibold text-ink-soft transition-colors hover:border-primary hover:text-primary disabled:opacity-50"
        >
          <UploadCloud className="size-3.5" /> {uploading ? "Uploading..." : "Replace"}
        </button>
      </div>
    </Panel>
  );
}

export function HeroImagesClient({ initialImages }: { initialImages: HeroImageEntry[] }) {
  const router = useRouter();
  const byslot = new Map(initialImages.map((e) => [e.slot, e.path]));
  const filled = SLOTS.filter((s) => byslot.get(s)).length;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Hero images"
        subtitle="Replace the background image for each of the storefront's five carousel slots. Headline text isn't editable here."
      >
        <Pill tone={filled === SLOTS.length ? "ok" : "warn"}>
          {filled} / {SLOTS.length} SET
        </Pill>
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {SLOTS.map((slot) => (
          <HeroSlotCard
            key={slot}
            slot={slot}
            path={byslot.get(slot)}
            onChanged={() => router.refresh()}
          />
        ))}
      </div>
    </div>
  );
}
