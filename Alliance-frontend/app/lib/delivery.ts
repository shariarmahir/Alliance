// Order states shown on the admin Orders screen. Two, not a delivery
// pipeline: freight is arranged directly with the customer, so the middle
// stages were never tracked against anything real. Moving an order to
// "Confirmed" emails the customer, so these must stay in step with
// DELIVERY_STAGES in the backend's services/operations.py — the index is
// what gets stored and what the email trigger compares against.

export const DELIVERY_STAGES = [
  { label: "Pending", hint: "Your order is being prepared." },
  {
    label: "Confirmed",
    hint: "Your order is confirmed. Our team will arrange delivery with you.",
  },
] as const;

export const MAX_STAGE = DELIVERY_STAGES.length - 1;

export function stageLabel(stage: number): string {
  return DELIVERY_STAGES[clampStage(stage)].label;
}

export function clampStage(stage: number | undefined): number {
  if (typeof stage !== "number" || Number.isNaN(stage)) return 0;
  return Math.min(MAX_STAGE, Math.max(0, Math.trunc(stage)));
}
