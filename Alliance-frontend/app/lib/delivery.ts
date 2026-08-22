// Delivery stages shared by the customer tracking page and the admin control
// that advances them. Deliberately not server-only — both a server component
// and a client component need the labels.

export const DELIVERY_STAGES = [
  { label: "Pending", hint: "Your order is confirmed and being prepared." },
  { label: "Submitted", hint: "Items are packed and awaiting collection." },
  { label: "In Transit", hint: "On the way to your delivery address." },
  { label: "Delivered", hint: "Delivered. Thank you for your business." },
] as const;

export const MAX_STAGE = DELIVERY_STAGES.length - 1;

export function stageLabel(stage: number): string {
  return DELIVERY_STAGES[clampStage(stage)].label;
}

export function clampStage(stage: number | undefined): number {
  if (typeof stage !== "number" || Number.isNaN(stage)) return 0;
  return Math.min(MAX_STAGE, Math.max(0, Math.trunc(stage)));
}
