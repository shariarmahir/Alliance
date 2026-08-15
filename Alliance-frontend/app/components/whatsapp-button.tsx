"use client";

// Design bundle renders this as a white pill card — green dot, bold label and
// the number in mono — not a bare icon circle. Collapses to a circle on small
// screens so it doesn't crowd the viewport.
export function WhatsAppButton() {
  return (
    <a
      href="https://wa.me/8801713116019"
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with an engineer on WhatsApp: +8801713-116019"
      className="group fixed bottom-5 right-5 z-50 flex items-center gap-2.5 rounded-[26px] border border-slate-line bg-white p-2.5 shadow-[0_12px_30px_rgba(16,25,45,.18)] transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_16px_36px_rgba(16,25,45,.24)] sm:py-2.5 sm:pl-3 sm:pr-4"
    >
      <span className="flex size-[34px] shrink-0 items-center justify-center rounded-full bg-[#25d366]">
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="size-5 text-white">
          <path d="M17.47 14.38c-.3-.15-1.75-.86-2.02-.96-.27-.1-.47-.15-.67.15-.2.3-.77.96-.94 1.16-.17.2-.35.22-.64.08-.3-.15-1.25-.46-2.38-1.47-.88-.79-1.48-1.76-1.65-2.06-.17-.3-.02-.46.13-.6.14-.14.3-.35.45-.53.15-.18.2-.3.3-.5.1-.2.05-.38-.02-.53-.08-.15-.67-1.61-.92-2.2-.24-.58-.49-.5-.67-.51h-.57c-.2 0-.52.07-.8.37-.27.3-1.04 1.02-1.04 2.48s1.07 2.88 1.22 3.08c.15.2 2.1 3.2 5.08 4.49.71.3 1.26.49 1.7.63.71.22 1.36.19 1.87.12.57-.09 1.75-.72 2-1.41.25-.69.25-1.28.17-1.41-.07-.13-.27-.2-.57-.35ZM12.04 21.5h-.01a9.44 9.44 0 0 1-4.8-1.32l-.35-.2-3.57.93.96-3.48-.23-.36a9.4 9.4 0 0 1-1.44-5.03c0-5.2 4.24-9.44 9.45-9.44a9.4 9.4 0 0 1 6.68 2.77 9.37 9.37 0 0 1 2.76 6.68c0 5.2-4.24 9.45-9.45 9.45Zm8.04-17.49A11.36 11.36 0 0 0 12.04.75C5.76.75.66 5.85.66 12.11c0 2 .52 3.95 1.52 5.67L.56 23.25l5.6-1.47a11.33 11.33 0 0 0 5.88 1.6h.01c6.27 0 11.38-5.1 11.38-11.37 0-3.04-1.19-5.89-3.34-8.04Z" />
        </svg>
      </span>
      <span className="hidden leading-tight sm:block">
        <strong className="block text-[13px] font-semibold text-ink">Chat with an engineer</strong>
        <span className="font-mono text-[11.5px] text-[#64748b]">+8801713-116019</span>
      </span>
    </a>
  );
}
