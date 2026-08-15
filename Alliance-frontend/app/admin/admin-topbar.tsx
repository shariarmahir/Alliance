"use client";

import { LogOut, Menu } from "lucide-react";
import type { AdminSession } from "@/app/lib/types";
import { logoutAction } from "./login/actions";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/app/components/ui/dropdown-menu";

function initials(name: string) {
  return name
    .split(" ")
    .map((n) => n[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

// Rendered on the server pass as a stable string so the markup does not differ
// between server and client (a live clock would hydrate-mismatch). GMT+6 is
// the business's operating timezone, per the design bundle.
function todayLabel() {
  return new Date()
    .toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Dhaka",
    })
    .toUpperCase();
}

export function AdminTopbar({ session, onOpenMobile }: { session: AdminSession; onOpenMobile: () => void }) {
  return (
    <header className="sticky top-0 z-30 flex h-[66px] items-center justify-between gap-4 border-b border-slate-line bg-white px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-3.5">
        <button
          type="button"
          onClick={onOpenMobile}
          aria-label="Open menu"
          className="flex size-9 shrink-0 items-center justify-center rounded-lg text-ink-soft transition-colors hover:bg-surface lg:hidden"
        >
          <Menu className="size-5" />
        </button>

        <div className="hidden w-[300px] items-center gap-2.5 rounded-md border border-[#dde3ea] px-3.5 py-2.5 text-[13px] text-[#8a94a6] md:flex">
          <span aria-hidden="true">⌕</span>
          Search orders, parts, clients
        </div>
        <span className="hidden rounded-md bg-[#f2f4f7] px-3 py-1.5 font-mono text-[11.5px] font-semibold text-ink-muted lg:block">
          GMT+6 · {todayLabel()}
        </span>
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger className="flex shrink-0 items-center gap-2.5 rounded-[22px] border border-[#dde3ea] py-1.5 pl-1.5 pr-3 transition-colors hover:border-primary">
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-tint font-bold text-[11px] text-primary">
            {initials(session.name)}
          </span>
          <span className="hidden text-left leading-tight sm:block">
            <span className="block text-[12.5px] font-semibold text-ink">{session.name}</span>
            <span className="mono-label text-[9.5px] tracking-[0.07em] text-primary">
              {session.role === "super" ? "SUPER ADMIN" : "SUB ADMIN"}
            </span>
          </span>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <div className="flex flex-col px-1.5 py-1">
            <span className="text-sm font-medium text-foreground">{session.name}</span>
            <span className="text-xs text-muted-foreground">{session.email}</span>
          </div>
          <DropdownMenuSeparator />
          <form action={logoutAction}>
            <DropdownMenuItem
              variant="destructive"
              nativeButton
              render={<button type="submit" className="w-full" />}
            >
              <LogOut className="size-4" /> Log out
            </DropdownMenuItem>
          </form>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
