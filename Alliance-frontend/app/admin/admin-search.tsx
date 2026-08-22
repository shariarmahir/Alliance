"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Package, FileText, Box, User, Loader2 } from "lucide-react";
import type { SearchResult } from "@/app/lib/admin-data";
import { apiFetch } from "@/app/lib/api-browser";

type SearchResultType = SearchResult["type"];

const TYPE_META: Record<
  SearchResultType,
  { icon: typeof Package; label: string; iconBg: string; iconColor: string }
> = {
  order: { icon: Package, label: "Order", iconBg: "bg-tint", iconColor: "text-primary" },
  quotation: { icon: FileText, label: "Quotation", iconBg: "bg-warn-bg", iconColor: "text-warn" },
  product: { icon: Box, label: "Product", iconBg: "bg-[#f2f4f7]", iconColor: "text-ink-soft" },
  client: { icon: User, label: "Client", iconBg: "bg-ok-bg", iconColor: "text-ok" },
};

export function AdminSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounced so typing a part number does not fire a request per keystroke;
  // the abort controller drops responses from queries the user has moved past,
  // which would otherwise land out of order and show stale results.
  useEffect(() => {
    const trimmed = query.trim();
    // Too short to search — nothing to fetch or cancel. The results already
    // held in state are ignored while the query is short (see `visible`
    // below), so there is no stale state to clear here.
    if (trimmed.length < 2) return;

    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        // apiFetch, not fetch: a relative path resolves against this app's own
        // origin, which serves no API — in production that is a 404, so search
        // silently returned nothing.
        const data = await apiFetch<{ results?: SearchResult[] }>(
          `/api/admin/search?q=${encodeURIComponent(trimmed)}`,
          { signal: controller.signal }
        );
        setResults(data.results ?? []);
        setActiveIndex(0);
      } catch {
        // aborted or offline — keep whatever is on screen
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 250);

    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [query]);

  // Close on outside click, so the panel does not linger over the page.
  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
  }, []);

  const isSearchable = query.trim().length >= 2;
  const showPanel = open && isSearchable;
  // Results are only meaningful for the query that produced them; while the
  // box holds fewer than two characters there is nothing valid to show.
  const visible = isSearchable ? results : [];

  function go(result: SearchResult) {
    setOpen(false);
    setQuery("");
    router.push(result.href);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }
    if (!visible.length) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((i) => (i + 1) % visible.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((i) => (i - 1 + visible.length) % visible.length);
    } else if (event.key === "Enter") {
      event.preventDefault();
      const result = visible[activeIndex];
      if (result) go(result);
    }
  }

  return (
    <div ref={containerRef} className="relative hidden md:block">
      <div className="flex w-[300px] items-center gap-2.5 rounded-md border border-[#dde3ea] px-3.5 py-2.5 transition-colors focus-within:border-primary">
        <Search className="size-3.5 shrink-0 text-[#8a94a6]" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Search orders, parts, clients"
          aria-label="Search orders, parts and clients"
          className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-[#8a94a6]"
        />
        {loading && <Loader2 className="size-3.5 shrink-0 animate-spin text-[#8a94a6]" />}
      </div>

      {showPanel && (
        <div className="absolute left-0 top-[calc(100%+6px)] z-50 w-[380px] overflow-hidden rounded-[10px] border border-slate-line bg-white shadow-[0_16px_40px_rgba(13,22,38,.12)]">
          {visible.length === 0 ? (
            <p className="px-4 py-6 text-center text-[12.5px] text-ink-muted">
              {loading ? "Searching..." : `No matches for "${query.trim()}"`}
            </p>
          ) : (
            <ul className="max-h-[380px] overflow-y-auto py-1">
              {visible.map((result, i) => {
                const meta = TYPE_META[result.type];
                return (
                  <li key={`${result.type}-${result.id}`}>
                    <button
                      type="button"
                      onMouseEnter={() => setActiveIndex(i)}
                      onClick={() => go(result)}
                      className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                        i === activeIndex ? "bg-surface" : ""
                      }`}
                    >
                      <span
                        className={`flex size-8 shrink-0 items-center justify-center rounded-lg ${meta.iconBg}`}
                      >
                        <meta.icon className={`size-4 ${meta.iconColor}`} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[12.5px] font-semibold text-ink">
                          {result.title}
                        </span>
                        <span className="block truncate text-[11px] text-[#8a94a6]">
                          {result.subtitle}
                        </span>
                      </span>
                      <span className="mono-label shrink-0 text-[9.5px] tracking-[0.07em] text-[#8a94a6]">
                        {meta.label}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
