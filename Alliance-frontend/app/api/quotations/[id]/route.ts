import { NextResponse } from "next/server";
import { readQuotation } from "@/app/lib/admin-operations";

// GET /api/quotations/[id] — how the storefront learns whether its submitted
// quotation was approved. There are no customer accounts, so the random UUID
// handed back at submit time is the only credential: it is unguessable, and
// the customer's browser keeps it in localStorage.
//
// Returns the whole quotation including the issued confirmation, because the
// customer legitimately needs the priced lines to render the PDF client-side.

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const quotation = await readQuotation(id);
  if (!quotation) {
    return NextResponse.json({ error: "Quotation not found" }, { status: 404 });
  }
  return NextResponse.json({ quotation });
}
