import { NextRequest, NextResponse } from "next/server";
import { readProducts, addProduct, saveProductImage, slugify, uniqueSlug, deriveStockStatus } from "@/app/lib/admin-catalog";
import { requireAdminSession, isSessionResponse } from "../_auth";
import type { Product, StockStatus } from "@/app/lib/types";

export const runtime = "nodejs";

// POST /api/admin/products — single product add (multipart/form-data).
export async function POST(request: NextRequest) {
  const session = await requireAdminSession();
  if (isSessionResponse(session)) return session;

  const form = await request.formData();

  const name = String(form.get("name") ?? "").trim();
  const partNumber = String(form.get("partNumber") ?? "").trim();
  const brand = String(form.get("brand") ?? "").trim();
  const categorySlug = String(form.get("categorySlug") ?? "").trim();
  const priceRaw = String(form.get("price") ?? "");
  const warrantyYearsRaw = String(form.get("warrantyYears") ?? "2");
  const stockQtyRaw = String(form.get("stockQty") ?? "0");
  const shortSpecs = form.getAll("shortSpecs").map((v) => String(v).trim()).filter(Boolean);
  const description = form.getAll("description").map((v) => String(v).trim()).filter(Boolean);
  const alternatePartNumbers = form.getAll("alternatePartNumbers").map((v) => String(v).trim()).filter(Boolean);
  const specKeys = form.getAll("specKeys").map((v) => String(v).trim());
  const specValues = form.getAll("specValues").map((v) => String(v).trim());

  const errors: Record<string, string> = {};
  if (!name) errors.name = "Name is required.";
  if (!partNumber) errors.partNumber = "Part number is required.";
  if (!brand) errors.brand = "Brand is required.";
  if (!categorySlug) errors.categorySlug = "Category is required.";
  const price = Number(priceRaw);
  if (!priceRaw || Number.isNaN(price) || price < 0) errors.price = "Price must be a non-negative number.";
  const warrantyYears = Number(warrantyYearsRaw);
  if (Number.isNaN(warrantyYears) || warrantyYears < 0) errors.warrantyYears = "Warranty years must be a non-negative number.";
  const stockQty = Number(stockQtyRaw);
  if (Number.isNaN(stockQty) || stockQty < 0) errors.stockQty = "Stock quantity must be a non-negative number.";

  const primaryImage = form.get("image");
  if (!(primaryImage instanceof File) || primaryImage.size === 0) {
    errors.image = "A primary image is required.";
  }

  if (Object.keys(errors).length > 0) {
    return NextResponse.json({ errors }, { status: 400 });
  }

  const products = await readProducts();

  if (products.some((p) => p.partNumber.toLowerCase() === partNumber.toLowerCase())) {
    return NextResponse.json({ errors: { partNumber: "A product with this part number already exists." } }, { status: 400 });
  }

  const existingSlugs = new Set(products.map((p) => p.slug));
  const slug = uniqueSlug(slugify(name), existingSlugs);

  const specifications: Record<string, string> = {};
  for (let i = 0; i < specKeys.length; i++) {
    if (specKeys[i] && specValues[i]) specifications[specKeys[i]] = specValues[i];
  }

  const file = primaryImage as File;
  const primaryExt = extOf(file.name) || ".jpg";
  const primaryBuffer = Buffer.from(await file.arrayBuffer());
  const primaryPath = await saveProductImage(categorySlug, `${slug}${primaryExt}`, primaryBuffer);

  const galleryFiles = form.getAll("gallery").filter((f): f is File => f instanceof File && f.size > 0);
  const gallery: string[] = [];
  for (let i = 0; i < galleryFiles.length; i++) {
    const gFile = galleryFiles[i];
    const gExt = extOf(gFile.name) || ".jpg";
    const gBuffer = Buffer.from(await gFile.arrayBuffer());
    const gPath = await saveProductImage(categorySlug, `${slug}-${i + 1}${gExt}`, gBuffer);
    gallery.push(gPath);
  }
  if (gallery.length === 0) gallery.push(primaryPath);

  const stock: StockStatus = deriveStockStatus(stockQty);

  const product: Product = {
    slug,
    partNumber,
    name,
    brand,
    categorySlug,
    image: primaryPath,
    gallery,
    shortSpecs,
    description,
    alternatePartNumbers,
    specifications,
    price,
    stock,
    stockQty,
    warrantyYears,
  };

  await addProduct(product);

  return NextResponse.json({ product }, { status: 201 });
}

function extOf(filename: string): string {
  const idx = filename.lastIndexOf(".");
  return idx === -1 ? "" : filename.slice(idx);
}
