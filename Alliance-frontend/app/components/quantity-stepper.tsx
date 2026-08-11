"use client";
import { useState } from "react";
import { Button } from "@/app/components/ui/button";

export function QuantityStepper({
  initial = 1,
  min = 1,
  onChange,
}: {
  initial?: number;
  min?: number;
  onChange: (n: number) => void;
}) {
  const [qty, setQty] = useState(initial);
  function update(n: number) {
    const next = Math.max(min, n);
    setQty(next);
    onChange(next);
  }
  return (
    <div className="flex items-center gap-2">
      <Button type="button" variant="outline" size="icon" onClick={() => update(qty - 1)}>-</Button>
      <input
        type="number"
        value={qty}
        min={min}
        onChange={(e) => update(Number(e.target.value) || min)}
        className="w-16 rounded-md border border-slate-300 px-2 py-1.5 text-center"
      />
      <Button type="button" variant="outline" size="icon" onClick={() => update(qty + 1)}>+</Button>
    </div>
  );
}
