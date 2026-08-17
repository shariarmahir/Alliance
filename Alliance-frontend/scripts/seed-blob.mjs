// scripts/seed-blob.mjs
// One-time migration: uploads every data/*.json file and every binary under
// public/images/{products,categories,hero}/ into the connected Vercel Blob
// store, patching image-path fields in the JSON to point at the new Blob
// URLs before uploading the JSON itself. Run once after BLOB_READ_WRITE_TOKEN
// is configured; not part of the app's runtime code path.
import { put } from "@vercel/blob";
import { readFile, readdir } from "fs/promises";
import path from "path";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data");
const IMAGES_DIR = path.join(ROOT, "public", "images");

async function uploadBinaryDir(localSubdir, blobPrefix) {
  const dir = path.join(IMAGES_DIR, localSubdir);
  const urlByLocalPath = new Map();
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true, recursive: true });
  } catch {
    return urlByLocalPath; // directory doesn't exist — nothing to seed
  }
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const relDir = path.relative(dir, entry.parentPath ?? entry.path);
    const relPath = relDir ? `${relDir}/${entry.name}` : entry.name;
    const localFsPath = path.join(dir, relPath);
    const buffer = await readFile(localFsPath);
    const blob = await put(`${blobPrefix}/${relPath}`, buffer, {
      access: "public",
      allowOverwrite: true,
    });
    urlByLocalPath.set(`/images/${localSubdir}/${relPath}`.replace(/\\/g, "/"), blob.url);
  }
  return urlByLocalPath;
}

async function uploadJson(filename, data) {
  await put(`data/${filename}`, JSON.stringify(data, null, 2) + "\n", {
    access: "public",
    contentType: "application/json",
    allowOverwrite: true,
  });
  console.log(`  uploaded data/${filename}`);
}

async function main() {
  console.log("Seeding product images...");
  const productUrls = await uploadBinaryDir("products", "images/products");
  console.log(`  ${productUrls.size} product image(s) uploaded`);

  console.log("Seeding category icons...");
  const categoryUrls = await uploadBinaryDir("categories", "images/categories");
  console.log(`  ${categoryUrls.size} category icon(s) uploaded`);

  console.log("Seeding hero images...");
  const heroUrls = await uploadBinaryDir("hero", "images/hero");
  console.log(`  ${heroUrls.size} hero image(s) uploaded`);

  console.log("Patching and uploading data/products.json...");
  const products = JSON.parse(await readFile(path.join(DATA_DIR, "products.json"), "utf-8"));
  for (const p of products) {
    if (productUrls.has(p.image)) p.image = productUrls.get(p.image);
    p.gallery = (p.gallery ?? []).map((g) => productUrls.get(g) ?? g);
  }
  await uploadJson("products.json", products);

  console.log("Patching and uploading data/categories.json...");
  const categories = JSON.parse(await readFile(path.join(DATA_DIR, "categories.json"), "utf-8"));
  for (const c of categories) {
    if (c.icon && categoryUrls.has(c.icon)) c.icon = categoryUrls.get(c.icon);
  }
  await uploadJson("categories.json", categories);

  console.log("Patching and uploading data/hero-images.json...");
  const heroEntries = JSON.parse(await readFile(path.join(DATA_DIR, "hero-images.json"), "utf-8"));
  for (const h of heroEntries) {
    const withoutQuery = h.path.split("?")[0];
    if (heroUrls.has(withoutQuery)) h.path = heroUrls.get(withoutQuery);
  }
  await uploadJson("hero-images.json", heroEntries);

  const remaining = [
    "orders.json",
    "quotations.json",
    "contact-requests.json",
    "emails.json",
    "employees.json",
    "tasks.json",
    "leave-requests.json",
    "daily-reports.json",
  ];
  for (const filename of remaining) {
    console.log(`Uploading ${filename}...`);
    const data = JSON.parse(await readFile(path.join(DATA_DIR, filename), "utf-8"));
    await uploadJson(filename, data);
  }

  console.log("\nDone. All data/*.json files and public/images binaries are now in Blob.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
