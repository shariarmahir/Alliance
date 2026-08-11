"use client";

import { Truck, Zap } from "lucide-react";
import type { DeliveryOption } from "@/app/lib/types";
import { addBusinessDays } from "@/app/lib/utils";
import { RadioGroup, RadioGroupItem } from "@/app/components/ui/radio-group";
import { Label } from "@/app/components/ui/label";

const options: {
  value: DeliveryOption;
  label: string;
  description: string;
  days: number;
  surcharge: string;
  icon: typeof Truck;
}[] = [
  {
    value: "standard",
    label: "Standard Shipping",
    description: "7-10 business days",
    days: 10,
    surcharge: "Free",
    icon: Truck,
  },
  {
    value: "express",
    label: "Express Shipping",
    description: "2-3 business days",
    days: 3,
    surcharge: "+$45.00",
    icon: Zap,
  },
];

export function DeliveryOptions({
  value,
  onChange,
}: {
  value: DeliveryOption;
  onChange: (v: DeliveryOption) => void;
}) {
  return (
    <RadioGroup value={value} onValueChange={(v) => onChange(v as DeliveryOption)} className="gap-3">
      {options.map((opt) => {
        const deliveryDate = addBusinessDays(new Date(), opt.days);
        const isActive = value === opt.value;
        return (
          <Label
            key={opt.value}
            htmlFor={`delivery-${opt.value}`}
            className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-colors ${
              isActive ? "border-primary bg-primary/5" : "border-slate-200 bg-white"
            }`}
          >
            <RadioGroupItem value={opt.value} id={`delivery-${opt.value}`} className="mt-1" />
            <opt.icon className="mt-0.5 size-5 text-primary" />
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-slate-900">{opt.label}</p>
                <p className="font-semibold text-slate-900">{opt.surcharge}</p>
              </div>
              <p className="text-sm text-slate-600">{opt.description}</p>
              <p className="text-xs text-slate-500">
                Estimated delivery:{" "}
                {deliveryDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              </p>
            </div>
          </Label>
        );
      })}
    </RadioGroup>
  );
}
