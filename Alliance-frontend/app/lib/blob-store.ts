import "server-only";
import { put, head } from "@vercel/blob";

// Shared Blob-backed replacement for the old fs.readFile/fs.writeFile JSON
// helpers duplicated across admin-operations.ts, admin-catalog.ts, and
// admin-employees.ts. Vercel's serverless functions run on a read-only
// filesystem outside /tmp, so those fs calls threw in production — every
// JSON file now lives at a fixed pathname in the project's connected Blob
// store instead, addressed the same way on every read/write.

export const BLOB_PREFIX = "data/";

function blobUrl(pathname: string): string {
  return `https://${process.env.BLOB_STORE_ID}.public.blob.vercel-storage.com/${pathname}`;
}

export async function readBlobJson<T>(pathname: string): Promise<T> {
  const url = blobUrl(BLOB_PREFIX + pathname);
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Blob read failed for ${pathname}: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function writeBlobJson<T>(pathname: string, data: T): Promise<void> {
  await put(BLOB_PREFIX + pathname, JSON.stringify(data, null, 2) + "\n", {
    access: "public",
    contentType: "application/json",
    allowOverwrite: true,
  });
}
