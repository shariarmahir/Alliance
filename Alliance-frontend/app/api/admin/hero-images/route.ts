import { NextRequest, NextResponse } from "next/server";
import { saveHeroImage } from "@/app/lib/admin-catalog";
import { requireAdminSession, isSessionResponse } from "../_auth";

export const runtime = "nodejs";

const MAX_SLOT = 5;

// POST /api/admin/hero-images — replace one hero slot (multipart/form-data: slot 1-5, image file).
export async function POST(request: NextRequest) {
  const session = await requireAdminSession();
  if (isSessionResponse(session)) return session;

  const form = await request.formData();
  const slotRaw = String(form.get("slot") ?? "");
  const image = form.get("image");

  const slot = Number(slotRaw);
  if (!Number.isInteger(slot) || slot < 1 || slot > MAX_SLOT) {
    return NextResponse.json({ error: `Slot must be an integer between 1 and ${MAX_SLOT}.` }, { status: 400 });
  }

  if (!(image instanceof File) || image.size === 0) {
    return NextResponse.json({ error: "An image file is required." }, { status: 400 });
  }

  const buffer = Buffer.from(await image.arrayBuffer());
  const path = await saveHeroImage(slot, image.name, buffer);

  return NextResponse.json({ slot, path }, { status: 201 });
}
