import { NextRequest, NextResponse } from "next/server";
import {
  readProducts,
  writeProducts,
  saveProductImage,
  slugify,
  uniqueSlug,
  defaultStockQtyForStatus,
  deriveStockStatus,
} from "@/app/lib/admin-catalog";
import { requireAdminSession, isSessionResponse } from "../../_auth";
import type { BulkImportError, BulkProductRow, Product, StockStatus } from "@/app/lib/types";

export const runtime = "nodejs";

const LINE_RE = /^(\d+)\.\s*(.+)$/;
const IMAGE_NUM_RE = /^(\d+)[.\-_]/;
const VALID_STOCK: StockStatus[] = ["in-stock", "low-stock", "out-of-stock"];

// POST /api/admin/products/bulk — atomic bulk product + image import.
// Validates the ENTIRE batch before any write; if errors.length > 0 nothing
// is written to disk. See design spec "Bulk Import Validation" for the
// filename-number matching algorithm this implements.
export async function POST(request: NextRequest) {
  const session = await requireAdminSession();
  if (isSessionResponse(session)) return session;

  const form = await request.formData();
  const categorySlug = String(form.get("categorySlug") ?? "").trim();
  const productsText = String(form.get("productsText") ?? "");
  const imageFiles = form.getAll("images").filter((f): f is File => f instanceof File && f.size > 0);

  const errors: BulkImportError[] = [];

  if (!categorySlug) {
    errors.push({ lineNumber: null, message: "A category must be selected." });
  }

  // 1. Parse each non-empty text line.
  const rows: BulkProductRow[] = [];
  const lines = productsText.split("\n").map((l) => l.trim()).filter((l) => l.length > 0);

  for (const line of lines) {
    const lineMatch = line.match(LINE_RE);
    if (!lineMatch) {
      errors.push({ lineNumber: null, message: `Line does not match the expected "N. ..." format: "${line}"` });
      continue;
    }
    const lineNumber = Number(lineMatch[1]);
    const fields = lineMatch[2].split("|").map((f) => f.trim());

    if (fields.length !== 5) {
      errors.push({ lineNumber, message: `Expected 5 fields separated by "|" (name, part number, price, short specs, stock), found ${fields.length}.` });
      continue;
    }

    const [fName, fPartNumber, fPrice, fShortSpecs, fStock] = fields;
    const price = Number(fPrice);
    const rowErrors: string[] = [];
    if (!fName) rowErrors.push("name is empty");
    if (!fPartNumber) rowErrors.push("part number is empty");
    if (!fPrice || Number.isNaN(price) || price < 0) rowErrors.push("price is not a valid non-negative number");
    if (!VALID_STOCK.includes(fStock as StockStatus)) rowErrors.push(`stock must be one of ${VALID_STOCK.join(", ")}`);

    if (rowErrors.length > 0) {
      errors.push({ lineNumber, message: `Invalid line: ${rowErrors.join(", ")}.` });
      continue;
    }

    rows.push({
      lineNumber,
      name: fName,
      partNumber: fPartNumber,
      price,
      shortSpecs: fShortSpecs,
      stock: fStock as StockStatus,
    });
  }

  // 2. Extract leading number from each image filename.
  const imagesByNumber = new Map<number, File>();
  for (const file of imageFiles) {
    const match = file.name.match(IMAGE_NUM_RE);
    if (!match) {
      errors.push({ lineNumber: null, message: `Image "${file.name}" does not start with a number and cannot be matched to a product line.` });
      continue;
    }
    const num = Number(match[1]);
    if (imagesByNumber.has(num)) {
      errors.push({ lineNumber: null, message: `Multiple images match number ${num} (only one image per product line is allowed).` });
      continue;
    }
    imagesByNumber.set(num, file);
  }

  // 3. Cross-check: every product line must have exactly one matching image, and vice versa.
  const rowNumbers = new Set(rows.map((r) => r.lineNumber));
  for (const row of rows) {
    if (!imagesByNumber.has(row.lineNumber)) {
      errors.push({ lineNumber: row.lineNumber, message: `No image uploaded for product #${row.lineNumber}.` });
    }
  }
  for (const [num, file] of imagesByNumber) {
    if (!rowNumbers.has(num)) {
      errors.push({ lineNumber: null, message: `Image "${file.name}" does not match any product line (no line starting with "${num}.").` });
    }
  }

  if (rows.length === 0 && lines.length === 0) {
    errors.push({ lineNumber: null, message: "No product lines were provided." });
  }

  // 4. Atomic: any validation failure blocks all writes.
  if (errors.length > 0) {
    return NextResponse.json({ errors }, { status: 400 });
  }

  // 5. Valid — generate slugs, save images, build Product records, append in one write.
  const existingProducts = await readProducts();

  const partNumberCollision = rows.find((row) =>
    existingProducts.some((p) => p.partNumber.toLowerCase() === row.partNumber.toLowerCase())
  );
  if (partNumberCollision) {
    return NextResponse.json(
      {
        errors: [
          {
            lineNumber: partNumberCollision.lineNumber,
            message: `Part number "${partNumberCollision.partNumber}" already exists in the catalog.`,
          },
        ],
      },
      { status: 400 }
    );
  }

  const existingSlugs = new Set(existingProducts.map((p) => p.slug));
  const newProducts: Product[] = [];

  for (const row of rows) {
    const slug = uniqueSlug(slugify(row.name), existingSlugs);
    existingSlugs.add(slug);

    const file = imagesByNumber.get(row.lineNumber)!;
    const ext = extOf(file.name) || ".jpg";
    const buffer = Buffer.from(await file.arrayBuffer());
    const imagePath = await saveProductImage(categorySlug, `${slug}${ext}`, buffer);

    const stockQty = defaultStockQtyForStatus(row.stock);
    const shortSpecsList = row.shortSpecs.split(",").map((s) => s.trim()).filter(Boolean);

    newProducts.push({
      slug,
      partNumber: row.partNumber,
      name: row.name,
      brand: "",
      categorySlug,
      image: imagePath,
      gallery: [imagePath],
      shortSpecs: shortSpecsList,
      description: shortSpecsList,
      alternatePartNumbers: [],
      specifications: {},
      price: row.price,
      stock: deriveStockStatus(stockQty),
      stockQty,
      warrantyYears: 2,
    });
  }

  await writeProducts([...existingProducts, ...newProducts]);

  return NextResponse.json({ products: newProducts }, { status: 201 });
}

function extOf(filename: string): string {
  const idx = filename.lastIndexOf(".");
  return idx === -1 ? "" : filename.slice(idx);
}
