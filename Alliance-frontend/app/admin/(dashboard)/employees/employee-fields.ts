import type { AccessArea, Designation } from "@/app/lib/types";

// Shared by the Add and Edit dialogs. Kept in one place because a role or
// grant that exists on one form and not the other is not a cosmetic
// difference — it is an account that cannot be edited back to what it was.

export const DESIGNATIONS: { value: Designation; label: string }[] = [
  { value: "sales-associate", label: "Sales Associate" },
  { value: "warehouse-staff", label: "Warehouse Staff" },
  { value: "support-agent", label: "Support Agent" },
  { value: "catalog-manager", label: "Catalog Manager" },
  { value: "other", label: "Other" },
];

// Areas a sub-admin can't reach by default (see SUB_ADMIN_ALLOWED_PREFIXES
// in proxy.ts) — products/stock/tasks/leave etc. are already open to every
// sub-admin and aren't listed here since there's nothing to grant.
export const ACCESS_OPTIONS: { value: AccessArea; label: string; hint: string }[] = [
  { value: "quotations", label: "Quotations", hint: "Review, price and issue order confirmations" },
  { value: "orders", label: "Orders", hint: "View and update order status" },
  // Split out of Orders so billing and dispatch can be delegated apart —
  // whoever updates delivery status need not also approve invoices. Granting
  // Orders still opens both, so existing accounts keep what they had.
  { value: "invoices", label: "Invoices", hint: "Prepare, approve and record payment on invoices" },
  { value: "challans", label: "Challans", hint: "Prepare challans and record dispatch and delivery" },
  { value: "contact-requests", label: "Contact requests", hint: "Handle incoming contact form submissions" },
  { value: "emails", label: "Emails", hint: "View the mock inbox preview" },
];

// Mirrors IMPLIED_AREAS in the backend's schemas/session.py. Used to show an
// admin that granting Orders already covers invoices and challans, so the
// toggles do not look inconsistent with what the account can actually open.
export const IMPLIED_AREAS: Partial<Record<AccessArea, AccessArea[]>> = {
  orders: ["invoices", "challans"],
};

export function impliedBy(granted: AccessArea[], area: AccessArea): boolean {
  return granted.some((held) => (IMPLIED_AREAS[held] ?? []).includes(area));
}
