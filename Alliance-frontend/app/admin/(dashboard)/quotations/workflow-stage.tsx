"use client";

import type { Quotation } from "@/app/lib/types";

// The client's Recommended Workflow, named in their words:
//
//   Inbox -> View Request -> Prepare Quotation -> Save -> Pending
//   -> Review/Edit -> Send E-mail -> Submitted -> Customer Confirmation
//   -> Verify/Revise Quotation -> Upload Work Order/PO -> Order Confirmed
//   -> Documentation & Record
//
// Every stage was already reachable, but the workflow was invisible: the
// screen showed a row of buttons and left the admin to know the order they
// came in. This names the current stage and the next step, so the chain can
// be read off the row instead of remembered.

type Stage = {
  /** The stage's name in the client's document, not our internal status. */
  label: string;
  /** The next arrow in their chain, or null at the end of it. */
  next: string | null;
};

export function workflowStage(quotation: Quotation): Stage {
  switch (quotation.status) {
    case "inbox":
      return { label: "Inbox", next: "Prepare Quotation" };
    case "pending":
      // Their tab is "Pending"; the row pill used to read PREPARED, which
      // made one record look like two different things.
      return { label: "Pending", next: "Send E-mail" };
    case "submitted":
      return { label: "Submitted", next: "Customer Confirmation" };
    case "confirmed":
      // Item 13 sits between confirmation and the final record: until the
      // customer's PO is filed, the order is confirmed but not documented.
      return quotation.poNumber || quotation.poDocumentUrl
        ? { label: "Order Confirmed", next: null }
        : { label: "Order Confirmed", next: "Upload Work Order/PO" };
    case "cancelled":
      return { label: "Cancelled", next: null };
    default:
      return { label: quotation.status, next: null };
  }
}

/** The next step in the client's chain, shown beside the status pill. */
export function NextStep({ quotation }: { quotation: Quotation }) {
  const { next } = workflowStage(quotation);
  if (!next) return null;
  return (
    <span className="mt-1 block text-[10.5px] font-semibold text-ink-muted">
      Next: {next}
    </span>
  );
}
