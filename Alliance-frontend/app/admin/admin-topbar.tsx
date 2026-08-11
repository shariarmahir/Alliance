"use client";

import { ChevronDown, LogOut, UserCircle } from "lucide-react";
import type { AdminSession } from "@/app/lib/types";
import { logoutAction } from "./login/actions";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/app/components/ui/dropdown-menu";

export function AdminTopbar({ session }: { session: AdminSession }) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-end gap-4 border-b border-border bg-background/80 px-6 backdrop-blur-sm">
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium hover:bg-muted">
          <UserCircle className="size-5 text-muted-foreground" />
          <span className="max-w-[140px] truncate">{session.name}</span>
          <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-secondary-foreground">
            {session.role === "super" ? "Super Admin" : "Sub Admin"}
          </span>
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel className="font-normal">
            <div className="flex flex-col">
              <span className="font-medium text-foreground">{session.name}</span>
              <span className="text-xs text-muted-foreground">{session.email}</span>
            </div>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <form action={logoutAction}>
            <DropdownMenuItem variant="destructive" render={<button type="submit" className="w-full" />}>
              <LogOut className="size-4" /> Log out
            </DropdownMenuItem>
          </form>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
