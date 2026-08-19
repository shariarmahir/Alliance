import { NextResponse } from "next/server";

// REMOVED — this endpoint used to accept unauthenticated order writes with
// client-supplied `subtotal`, `shippingCost` and `grandTotal`, so anyone could
// POST an order into the admin dashboard for any amount, with fabricated line
// items and delivery addresses. It had no legitimate caller: the customer flow
// stopped creating orders when the order-confirm screen was removed (an
// admin's quotation confirmation is the order now).
//
// Kept as an explicit 410 rather than a deleted file so any stale client still
// calling it fails loudly instead of hitting a confusing 404, and so the
// reason it went away stays recorded here.
//
// If admin-side order creation is ever needed, rebuild it behind
// requireAreaSession("orders") and compute every monetary field server-side
// from the catalog — never from the request body.

export async function POST() {
  return NextResponse.json(
    { error: "This endpoint has been removed. Orders are created by confirming a quotation." },
    { status: 410 }
  );
}
