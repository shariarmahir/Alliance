"use client";

import { useSyncExternalStore } from "react";

// Nothing to subscribe to: the value is read once per mount and never changes
// on its own, so the "store" never notifies.
const noop = () => () => {};

// Captured once rather than per call so every consumer in a render agrees on
// what "now" is, and so the value is stable across re-renders.
const mountedAt = Date.now();

/**
 * The current time on the client, or null while rendering on the server.
 *
 * Reading `Date.now()` during render is a hydration bug: the server renders at
 * one instant and the browser re-renders at another, so any "2 h ago" label
 * computed from it differs between the two and React discards the markup
 * (error #418 in production, where the message is stripped).
 *
 * useSyncExternalStore is the tool built for exactly this — it takes a separate
 * server snapshot, so the value is null during SSR and a real timestamp in the
 * browser without a mount-time setState and the extra render that costs.
 *
 * Callers should omit the relative age while this is null rather than
 * substituting a guess, which would reintroduce the mismatch.
 */
export function useClientNow(): number | null {
  return useSyncExternalStore(
    noop,
    () => mountedAt,
    () => null
  );
}
