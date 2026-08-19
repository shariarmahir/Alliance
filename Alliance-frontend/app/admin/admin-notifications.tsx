"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { Bell, FileText, Package, MessageSquare, AlertTriangle, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
} from "@/app/components/ui/dropdown-menu";
import type { AdminNavCounts } from "./nav-config";

const DISMISSED_KEY = "autolink_admin_notifications_dismissed";

// Per-browser, not per-admin-account or server-persisted: Clear hides the
// items visible right now; an item reappears once its live count exceeds
// what was on screen when dismissed, so a genuinely new arrival is never
// hidden. This is a snapshot ceiling, not a read flag — nothing is
// "marked read" server-side, matching the counts staying fully live.
type DismissedSnapshot = Partial<Record<string, number>>;
const EMPTY_DISMISSED: DismissedSnapshot = {};

// useSyncExternalStore requires getSnapshot to return the SAME reference
// across calls when nothing changed, or it re-renders forever — parsing
// fresh JSON every call would violate that, so the parsed result is cached
// against the raw string that produced it (same pattern as quote-context.tsx).
let cache: DismissedSnapshot = EMPTY_DISMISSED;
let cacheRaw: string | null = null;

function readDismissed(): DismissedSnapshot {
  let raw: string | null;
  try {
    raw = localStorage.getItem(DISMISSED_KEY);
  } catch {
    return EMPTY_DISMISSED;
  }
  if (raw === cacheRaw) return cache;
  cacheRaw = raw;
  try {
    cache = raw ? JSON.parse(raw) : EMPTY_DISMISSED;
  } catch {
    cache = EMPTY_DISMISSED;
  }
  return cache;
}

function writeDismissed(snapshot: DismissedSnapshot) {
  try {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify(snapshot));
  } catch {
    // storage unavailable — Clear just won't persist across reloads
  }
  cacheRaw = null; // force readDismissed to re-parse on next call
  dismissedListeners.forEach((l) => l());
}

// useSyncExternalStore rather than an effect-driven useState: reading
// localStorage inside an effect body means setState fires after the first
// render, which react-hooks/set-state-in-effect flags (and which genuinely
// does cost a redundant render). This subscribes to writeDismissed instead.
const dismissedListeners = new Set<() => void>();

function subscribeDismissed(onChange: () => void) {
  dismissedListeners.add(onChange);
  return () => {
    dismissedListeners.delete(onChange);
  };
}

function getServerDismissed(): DismissedSnapshot {
  // Must return the SAME reference on every call — a fresh {} literal here
  // fails useSyncExternalStore's identity check and loops forever.
  return EMPTY_DISMISSED;
}

// Notifications are derived live from the same RBAC-scoped counts the sidebar
// badges use (see app/admin/(dashboard)/layout.tsx) rather than a stored feed:
// they describe what is still waiting on the admin right now, so actioning an
// item clears it without any read-state to persist. A sub-admin without the
// matching AccessArea grant gets 0 for that area — the layout skips the read —
// so nothing leaks into a list for a page they cannot open.
type NotificationItem = {
  key: string;
  count: number;
  label: string;
  hint: string;
  href: string;
  icon: typeof Bell;
  tone: "warn" | "info" | "danger";
};

const TONE: Record<NotificationItem["tone"], { dot: string; iconBg: string; icon: string }> = {
  warn: { dot: "bg-warn", iconBg: "bg-warn-bg", icon: "text-warn" },
  info: { dot: "bg-primary", iconBg: "bg-tint", icon: "text-primary" },
  danger: { dot: "bg-[#c22]", iconBg: "bg-[#fdecec]", icon: "text-[#c22]" },
};

function buildItems(counts: AdminNavCounts): NotificationItem[] {
  const all: NotificationItem[] = [
    {
      key: "quotations",
      hint: "Quote within 4 working hours",
      count: counts.pendingQuotations,
      label: counts.pendingQuotations === 1 ? "price request to quote" : "price requests to quote",
      href: "/admin/quotations",
      icon: FileText,
      tone: "warn",
    },
    {
      key: "orders",
      hint: "Confirm and arrange despatch",
      count: counts.pendingOrders,
      label: counts.pendingOrders === 1 ? "order to process" : "orders to process",
      href: "/admin/orders",
      icon: Package,
      tone: "info",
    },
    {
      key: "contact",
      hint: "Reply from the contact inbox",
      count: counts.openContactRequests,
      label:
        counts.openContactRequests === 1 ? "contact request to answer" : "contact requests to answer",
      href: "/admin/contact-requests",
      icon: MessageSquare,
      tone: "info",
    },
    {
      key: "stock",
      hint: "Restock before it sells out",
      count: counts.lowStock,
      label: counts.lowStock === 1 ? "product low on stock" : "products low on stock",
      href: "/admin/stock",
      icon: AlertTriangle,
      tone: "danger",
    },
  ];
  return all.filter((item) => item.count > 0);
}

// Hides an item once its count has already been cleared at this level or
// lower — a new arrival pushes the live count past the dismissed ceiling and
// the item comes back on its own.
function applyDismissed(items: NotificationItem[], dismissed: DismissedSnapshot): NotificationItem[] {
  return items.filter((item) => item.count > (dismissed[item.key] ?? 0));
}

export function AdminNotifications({ counts }: { counts: AdminNavCounts }) {
  const dismissed = useSyncExternalStore(subscribeDismissed, readDismissed, getServerDismissed);

  const allItems = buildItems(counts);
  const items = applyDismissed(allItems, dismissed);

  function clearAll() {
    const snapshot: DismissedSnapshot = { ...dismissed };
    for (const item of allItems) snapshot[item.key] = item.count;
    writeDismissed(snapshot);
  }
  const total = items.reduce((sum, i) => sum + i.count, 0);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={total > 0 ? `Notifications, ${total} items need attention` : "Notifications"}
        className="relative flex size-9 shrink-0 items-center justify-center rounded-full border border-[#dde3ea] text-ink-soft transition-colors hover:border-primary hover:text-primary"
      >
        <Bell className="size-4" />
        {total > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex min-w-4.5 items-center justify-center rounded-full bg-[#c22] px-1 font-mono text-[9.5px] font-bold text-white">
            {total > 99 ? "99+" : total}
          </span>
        )}
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-[344px] overflow-hidden rounded-[12px] border-slate-line p-0 shadow-[0_20px_48px_rgba(13,22,38,.16)]"
      >
        {/* Dark header mirrors the storefront's summary panels and the
            quotation email, so the admin surfaces read as one system. */}
        <div className="flex items-center justify-between bg-[#0d1626] px-4 py-3.5">
          <div>
            <strong className="block text-[13.5px] font-semibold text-white">Notifications</strong>
            <span className="text-[11px] text-[#94a3b8]">
              {total > 0 ? "Waiting on you right now" : "You are all caught up"}
            </span>
          </div>
          {total > 0 && (
            <span className="flex size-7 items-center justify-center rounded-full bg-[#c22] font-mono text-[11px] font-bold text-white">
              {total > 99 ? "99+" : total}
            </span>
          )}
        </div>

        {items.length > 0 && (
          <div className="flex justify-end border-b border-hairline bg-surface px-3 py-1.5">
            <button
              type="button"
              onClick={clearAll}
              className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] font-semibold text-ink-muted transition-colors hover:text-primary"
            >
              <X className="size-3" /> Clear
            </button>
          </div>
        )}

        {items.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <span className="mx-auto mb-3 flex size-11 items-center justify-center rounded-full bg-ok-bg">
              <Bell className="size-5 text-ok" />
            </span>
            <p className="text-[12.5px] font-semibold text-ink">
              {allItems.length > 0 ? "Cleared" : "Nothing needs your attention"}
            </p>
            <p className="mt-1 text-[11.5px] text-ink-muted">
              {allItems.length > 0
                ? "You'll see this again once something new comes in."
                : "New price requests and orders will appear here."}
            </p>
          </div>
        ) : (
          <ul className="max-h-[360px] overflow-y-auto p-2">
            {items.map((item) => {
              const tone = TONE[item.tone];
              return (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    className="group flex items-center gap-3 rounded-[10px] px-2.5 py-3 transition-colors hover:bg-surface"
                  >
                    <span
                      className={`flex size-9 shrink-0 items-center justify-center rounded-[10px] ${tone.iconBg}`}
                    >
                      <item.icon className={`size-4 ${tone.icon}`} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12.5px] font-semibold leading-snug text-ink">
                        {item.count} {item.label}
                      </span>
                      <span className="mt-0.5 block text-[11px] text-[#8a94a6]">{item.hint}</span>
                    </span>
                    <span
                      className={`size-1.5 shrink-0 rounded-full ${tone.dot} transition-transform group-hover:scale-125`}
                    />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
