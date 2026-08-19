import "server-only";
import { put, get, list } from "@vercel/blob";

// Blob-backed JSON storage for every business record (quotations, orders,
// employees, contact requests, catalog).
//
// SECURITY — read this before changing BLOB_PRIVATE:
//
// Private access is a STORE-LEVEL setting in Vercel Blob, not a per-write
// flag: a store created as public can never accept access:"private" writes
// ("Cannot use private access on a public store"). So securing this data is a
// two-part job — this code, plus a private store you create in the Vercel
// dashboard.
//
// While BLOB_PRIVATE is not "true", every data/*.json file is world-readable
// at a guessable URL on the store's public hostname: employees.json (names,
// emails, password hashes), quotations.json and orders.json (customer PII,
// addresses, pricing). That is a live data-exposure risk, not a theoretical
// one. See SECURITY.md for the migration steps.
//
// useCache:false on private reads is deliberate: Vercel's CDN briefly serves
// a stale copy after a write, which previously caused a just-confirmed
// quotation to read back as unissued on the first email attempt.

export const BLOB_PREFIX = "data/";

const PRIVATE = process.env.BLOB_PRIVATE === "true";

export async function readBlobJson<T>(pathname: string): Promise<T> {
  const key = BLOB_PREFIX + pathname;

  if (PRIVATE) {
    const result = await get(key, { access: "private", useCache: false });
    if (!result) throw new Error(`Blob read failed for ${pathname}: not found`);
    return new Response(result.stream).json() as Promise<T>;
  }

  // Public-store path. Resolved via list() rather than a stored URL so it
  // works whether or not the pathname carries a random suffix.
  const { blobs } = await list({ prefix: key });
  const match = blobs.find((b) => b.pathname === key);
  if (!match) throw new Error(`Blob read failed for ${pathname}: not found`);
  const res = await fetch(`${match.url}?cb=${Date.now()}`, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Blob read failed for ${pathname}: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

export async function writeBlobJson<T>(pathname: string, data: T): Promise<void> {
  await put(BLOB_PREFIX + pathname, JSON.stringify(data, null, 2) + "\n", {
    access: PRIVATE ? "private" : "public",
    contentType: "application/json",
    allowOverwrite: true,
  });
}
