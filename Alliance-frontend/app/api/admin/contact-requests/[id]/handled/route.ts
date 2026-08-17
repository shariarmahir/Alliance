import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { markContactRequestHandled } from "@/app/lib/admin-operations";
import { requireAreaSession, isSessionResponse } from "../../../_auth";

const HandledSchema = z.object({ handled: z.boolean() });

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAreaSession("contact-requests");
  if (isSessionResponse(session)) return session;

  const { id } = await params;
  const body = await request.json();
  const parsed = HandledSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", fields: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  try {
    const contactRequest = await markContactRequestHandled(id, parsed.data.handled);
    return NextResponse.json({ contactRequest });
  } catch {
    return NextResponse.json({ error: "Contact request not found" }, { status: 404 });
  }
}
