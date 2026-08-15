"use client";

import { useState } from "react";
import { Plus, Minus } from "lucide-react";

type FaqItem = { question: string; answer: string };

export function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200">
      {items.map((item, i) => {
        const isOpen = openIndex === i;
        return (
          <div key={item.question} className={i > 0 ? "border-t border-slate-200" : ""}>
            <button
              type="button"
              onClick={() => setOpenIndex(isOpen ? null : i)}
              className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
              aria-expanded={isOpen}
            >
              <span className="text-sm font-semibold text-slate-900">{item.question}</span>
              {isOpen ? (
                <Minus className="size-4 shrink-0 text-primary" />
              ) : (
                <Plus className="size-4 shrink-0 text-slate-400" />
              )}
            </button>
            {isOpen && (
              <p className="px-5 pb-4 text-sm leading-relaxed text-slate-600">{item.answer}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}
