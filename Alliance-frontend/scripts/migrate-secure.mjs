// One-time migration for the production-readiness fixes.
//
//   node scripts/migrate-secure.mjs
//
// What it does:
//   1. SEC-03 — bcrypt-hashes any plaintext password still in employees.json.
//      Runs against whichever store is configured; works today.
//   2. SEC-02 — if BLOB_PRIVATE=true, copies every data/*.json into the
//      private store and deletes the public originals.
//
// Private access is a STORE-LEVEL setting in Vercel Blob: a public store
// cannot accept private writes. So step 2 requires that you first create a
// private store in the Vercel dashboard and point BLOB_READ_WRITE_TOKEN at
// it. Until then this script still does step 1 and tells you what remains.
//
// Safe to re-run: already-hashed passwords are detected by their bcrypt
// prefix and skipped.

import { readFileSync } from "node:fs";
import { list, put, get, del } from "@vercel/blob";
import bcrypt from "bcryptjs";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*"?([^"\n]*)"?\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const DATA_PREFIX = "data/";
const PRIVATE = process.env.BLOB_PRIVATE === "true";

async function readBlob(pathname) {
  if (PRIVATE) {
    try {
      const res = await get(pathname, { access: "private", useCache: false });
      if (res) return await new Response(res.stream).json();
    } catch {
      // not in the private store yet — fall through to the public read
    }
  }
  const { blobs } = await list({ prefix: pathname });
  const match = blobs.find((b) => b.pathname === pathname);
  if (!match) return null;
  const res = await fetch(`${match.url}?cb=${Date.now()}`, { cache: "no-store" });
  return res.ok ? res.json() : null;
}

const { blobs } = await list({ prefix: DATA_PREFIX });
const dataBlobs = blobs.filter((b) => b.pathname.endsWith(".json"));

console.log(`Store mode: ${PRIVATE ? "PRIVATE" : "PUBLIC (data is world-readable)"}`);
console.log(`Found ${dataBlobs.length} data blobs.\n`);

let hashed = 0;
let moved = 0;

for (const blob of dataBlobs) {
  const { pathname } = blob;
  const data = await readBlob(pathname);
  if (data === null) {
    console.log(`  SKIP  ${pathname} — could not read`);
    continue;
  }

  let payload = data;
  let changed = false;

  if (pathname === `${DATA_PREFIX}employees.json` && Array.isArray(data)) {
    payload = [];
    for (const employee of data) {
      const stored = employee.password ?? "";
      if (stored && !/^\$2[aby]\$\d{2}\$/.test(stored)) {
        payload.push({ ...employee, password: await bcrypt.hash(stored, 12) });
        hashed++;
        changed = true;
        console.log(`  HASH  ${employee.email}`);
      } else {
        payload.push(employee);
      }
    }
  }

  if (PRIVATE) {
    await put(pathname, JSON.stringify(payload, null, 2) + "\n", {
      access: "private",
      contentType: "application/json",
      allowOverwrite: true,
    });
    moved++;
    console.log(`  PRIV  ${pathname}`);
  } else if (changed) {
    await put(pathname, JSON.stringify(payload, null, 2) + "\n", {
      access: "public",
      contentType: "application/json",
      allowOverwrite: true,
    });
    console.log(`  SAVE  ${pathname}`);
  }
}

if (PRIVATE) {
  console.log("\nRemoving public copies still readable without auth...");
  const { blobs: after } = await list({ prefix: DATA_PREFIX });
  for (const blob of after) {
    if (!blob.pathname.endsWith(".json")) continue;
    const res = await fetch(`${blob.url}?cb=${Date.now()}`, { cache: "no-store" }).catch(() => null);
    if (res && res.ok) {
      await del(blob.url);
      console.log(`  DEL   ${blob.pathname}`);
    }
  }
}

console.log(`\nDone. ${hashed} passwords hashed${PRIVATE ? `, ${moved} blobs made private` : ""}.`);
if (!PRIVATE) {
  console.log(
    "\nSTILL EXPOSED: data/*.json remain world-readable.\n" +
      "  1. Create a private Blob store at vercel.com/dashboard/stores\n" +
      "  2. Point BLOB_READ_WRITE_TOKEN at it and set BLOB_PRIVATE=true\n" +
      "  3. Re-run this script to copy the data across and delete the public originals"
  );
}
