import { NextRequest, NextResponse } from "next/server";
import { readCategories, addCategory, saveCategoryIcon, slugify, uniqueSlug } from "@/app/lib/admin-catalog";
import { requireAdminSession, isSessionResponse } from "../_auth";
import type { Category } from "@/app/lib/types";

export const runtime = "nodejs";

// POST /api/admin/categories — create category (multipart/form-data: name, optional icon file).
export async function POST(request: NextRequest) {
  const session = await requireAdminSession();
  if (isSessionResponse(session)) return session;

  const form = await request.formData();
  const name = String(form.get("name") ?? "").trim();
  const icon = form.get("icon");

  if (!name) {
    return NextResponse.json({ errors: { name: "Category name is required." } }, { status: 400 });
  }

  const categories = await readCategories();
  const existingSlugs = new Set(categories.map((c) => c.slug));
  const slug = uniqueSlug(slugify(name), existingSlugs);

  let iconPath = "/images/categories/default.svg";
  if (icon instanceof File && icon.size > 0) {
    const buffer = Buffer.from(await icon.arrayBuffer());
    iconPath = await saveCategoryIcon(slug, icon.name, buffer);
  }

  const category: Category = { slug, name, icon: iconPath, productCount: 0 };
  await addCategory(category);

  return NextResponse.json({ category }, { status: 201 });
}
