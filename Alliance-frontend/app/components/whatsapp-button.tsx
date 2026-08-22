"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

// Single floating icon — the earlier white "pill" card (icon + label + phone
// number inline) was wide enough to overlap footer links and form controls
// at common viewport widths. A fixed circular launcher never collides with
// page content, which is the whole point of a corner widget.
//
// Clicking it opens a compact assistant-style popup. There is no LLM/chat
// backend in this project (per CLAUDE.md: JSON-file persistence only, no
// FastAPI/Python backend), so this does not fake a live AI conversation.
// Instead it gives the "chatbot" shape — a greeting plus quick replies —
// routed to the real channels the business already uses: WhatsApp and the
// Ask Price flow. There is no self-service order lookup — status on a
// submitted request is handled directly by an engineer over WhatsApp/email.
const QUICK_REPLIES = [
  { label: "Ask a price on a part", href: "/products", external: false },
  { label: "Check on a request I sent", href: "https://wa.me/8801315770099", external: true },
] as const;

export function WhatsAppButton() {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;

    function onPointerDown(e: PointerEvent) {
      const target = e.target as Node;
      if (panelRef.current?.contains(target) || launcherRef.current?.contains(target)) return;
      setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-3">
      {open && (
        <div
          ref={panelRef}
          role="dialog"
          aria-label="AutoLink assistant"
          className="flex w-[320px] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-slate-line bg-white shadow-[0_20px_50px_rgba(16,25,45,.25)]"
        >
          <div className="flex items-center gap-3 bg-ink px-4 py-3.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#25d366]">
              <WhatsAppGlyph className="size-4.5 text-white" />
            </span>
            <div className="min-w-0 leading-tight">
              <p className="text-[13px] font-semibold text-white">AutoLink Assistant</p>
              <p className="flex items-center gap-1.5 text-[11.5px] text-white/60">
                <span className="size-1.5 rounded-full bg-[#25d366]" />
                Engineers online now
              </p>
            </div>
            <button
              type="button"
              aria-label="Close chat"
              onClick={() => setOpen(false)}
              className="ml-auto flex size-7 shrink-0 items-center justify-center rounded-full text-white/60 transition-colors hover:bg-white/10 hover:text-white"
            >
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>

          <div className="flex flex-col gap-2.5 px-4 pb-2 pt-4">
            <div className="max-w-[85%] rounded-xl rounded-tl-sm bg-surface px-3.5 py-2.5 text-[13px] leading-relaxed text-ink">
              Hi, I&apos;m here to help. What can I do for you?
            </div>
          </div>

          <div className="flex flex-col gap-2 px-4 pb-4 pt-1">
            {QUICK_REPLIES.map((q) =>
              q.external ? (
                <a
                  key={q.label}
                  href={q.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-slate-line px-3.5 py-2.5 text-left text-[13px] font-medium text-ink-soft transition-colors hover:border-primary hover:text-primary"
                >
                  {q.label}
                </a>
              ) : (
                <Link
                  key={q.label}
                  href={q.href}
                  onClick={() => setOpen(false)}
                  className="rounded-lg border border-slate-line px-3.5 py-2.5 text-left text-[13px] font-medium text-ink-soft transition-colors hover:border-primary hover:text-primary"
                >
                  {q.label}
                </Link>
              )
            )}
          </div>

          <div className="border-t border-hairline bg-surface px-4 py-2.5 text-center text-[11px] text-ink-muted">
            Or WhatsApp us directly at{" "}
            <span className="font-mono font-semibold text-ink">+8801315-770099</span>
          </div>
        </div>
      )}

      <button
        ref={launcherRef}
        type="button"
        aria-label={open ? "Close AutoLink assistant" : "Open AutoLink assistant"}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="group relative flex size-14 items-center justify-center rounded-full bg-primary text-white shadow-[0_12px_30px_rgba(0,125,204,.35)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(0,125,204,.42)]"
      >
        <svg
          viewBox="0 0 24 24"
          className={`absolute size-6 transition-all duration-200 ${open ? "scale-0 opacity-0" : "scale-100 opacity-100"}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 3C6.9 3 3 6.4 3 10.6c0 2.4 1.3 4.6 3.4 6-.1.8-.5 2.2-1.4 3.3 1.5-.1 3-.7 4.2-1.5.9.3 1.8.4 2.8.4 5.1 0 9-3.4 9-7.6S17.1 3 12 3Z"
          />
          <circle cx="8.5" cy="10.6" r="1" fill="currentColor" stroke="none" />
          <circle cx="12" cy="10.6" r="1" fill="currentColor" stroke="none" />
          <circle cx="15.5" cy="10.6" r="1" fill="currentColor" stroke="none" />
        </svg>
        <svg
          viewBox="0 0 24 24"
          className={`absolute size-5 transition-all duration-200 ${open ? "scale-100 opacity-100" : "scale-0 opacity-0"}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" d="M6 6l12 12M18 6L6 18" />
        </svg>
      </button>
    </div>
  );
}

function WhatsAppGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.14-.14.3-.35.45-.53.15-.18.2-.3.3-.5.1-.2.05-.38-.02-.53-.08-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.7.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.28.17-1.41-.07-.13-.27-.2-.57-.35ZM12.04 21.5h-.01a9.44 9.44 0 0 1-4.8-1.32l-.35-.2-3.57.93.96-3.48-.23-.36a9.4 9.4 0 0 1-1.44-5.03c0-5.2 4.24-9.44 9.45-9.44a9.4 9.4 0 0 1 6.68 2.77 9.37 9.37 0 0 1 2.76 6.68c0 5.2-4.24 9.45-9.45 9.45Zm8.04-17.49A11.36 11.36 0 0 0 12.04.75C5.76.75.66 5.85.66 12.11c0 2 .52 3.95 1.52 5.67L.56 23.25l5.6-1.47a11.33 11.33 0 0 0 5.88 1.6h.01c6.27 0 11.38-5.1 11.38-11.37 0-3.04-1.19-5.89-3.34-8.04Z" />
    </svg>
  );
}
