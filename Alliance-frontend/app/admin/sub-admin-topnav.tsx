"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/app/lib/utils";
import { logoutAction } from "./login/actions";
import type { AdminSession } from "@/app/lib/types";
import type { ResolvedNavGroup } from "./nav-config";

// Design bundle 2d: the sub-admin gets a dark horizontal bar instead of the
// super admin's sidebar rail — their shell is narrow enough that a rail wastes
// a whole column. Routes still come from the role-filtered nav groups, so RBAC
// is identical to the sidebar's.
function initials(name: string): string {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export function SubAdminTopnav({
  groups,
  session,
}: {
  groups: ResolvedNavGroup[];
  session: AdminSession;
}) {
  const pathname = usePathname();

  // /admin is super-only in nav-config (the Overview), but a sub-admin lands
  // there on their own task desk — so the bar needs an explicit first slot back
  // to it. Everything after comes from the role-filtered groups, unchanged.
  const items = [
    { href: "/admin", label: "Task desk" },
    ...groups.flatMap((g) => g.items).map((i) => ({ href: i.href, label: i.label })),
  ].filter((item, idx, all) => all.findIndex((o) => o.href === item.href) === idx);

  return (
    <header className="bg-[#0d1626]">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
        <div className="flex min-w-0 flex-wrap items-center gap-x-6 gap-y-2">
          <Link href="/admin" className="text-[17px] font-bold leading-none text-white">
            AutoLink<span className="text-accent">.</span>
          </Link>
          <nav className="flex flex-wrap items-center gap-x-5 gap-y-1 text-[12.5px]">
            {items.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/admin" && pathname.startsWith(`${item.href}/`));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "pb-0.5 font-medium transition-colors",
                    active
                      ? "border-b-2 border-accent text-white"
                      : "text-white/65 hover:text-white"
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="flex items-center gap-3">
          <span className="flex size-7 items-center justify-center rounded-full bg-white/[0.14] text-[11px] font-bold text-white">
            {initials(session.name)}
          </span>
          <span className="leading-tight">
            <span className="block text-[12px] font-semibold text-white">{session.name}</span>
            <span className="font-mono text-[9.5px] font-semibold text-white/55">
              {session.employeeId ? "SUB ADMIN" : "SUB ADMIN · DEMO"}
            </span>
          </span>
          <form action={logoutAction}>
            <button
              type="submit"
              className="rounded-md border border-white/20 px-3 py-1.5 text-[11.5px] font-semibold text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
