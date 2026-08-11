import { NextResponse } from "next/server";
import { z } from "zod";
import { addContactRequest } from "@/app/lib/admin-operations";
import type { ContactRequest } from "@/app/lib/types";

const ContactRequestSchema = z.object({
  name: z.string().min(1, "Name is required."),
  email: z.string().email("A valid email is required."),
  subject: z.string().min(1, "Subject is required."),
  message: z.string().min(1, "Message is required."),
});

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = ContactRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input", fields: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const contactRequest: ContactRequest = {
    id: crypto.randomUUID(),
    ...parsed.data,
    submittedAt: new Date().toISOString(),
    handled: false,
  };
  await addContactRequest(contactRequest);

  return NextResponse.json({ contactRequest }, { status: 201 });
}
