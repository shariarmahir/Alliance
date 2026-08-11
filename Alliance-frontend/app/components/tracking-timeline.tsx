import { Check } from "lucide-react";

export function TrackingTimeline({
  currentStep,
  steps,
}: {
  currentStep: number;
  steps: { label: string; date: string }[];
}) {
  return (
    <div className="flex flex-col gap-0 sm:flex-row sm:items-start">
      {steps.map((step, i) => {
        const isComplete = i < currentStep;
        const isCurrent = i === currentStep;
        const isFuture = i > currentStep;

        return (
          <div key={step.label} className="flex flex-1 flex-row items-start gap-3 sm:flex-col sm:items-center">
            <div className="flex flex-row items-center gap-3 sm:w-full sm:flex-col">
              <div className="flex items-center sm:w-full">
                {i > 0 && (
                  <div
                    className={`hidden h-0.5 flex-1 sm:block ${isComplete || isCurrent ? "bg-primary" : "bg-slate-200"}`}
                  />
                )}
                <div
                  className={`flex size-9 shrink-0 items-center justify-center rounded-full border-2 ${
                    isComplete
                      ? "border-primary bg-primary text-white"
                      : isCurrent
                        ? "border-accent bg-accent text-slate-900 animate-pulse"
                        : "border-slate-300 bg-white text-slate-400"
                  }`}
                >
                  {isComplete ? <Check className="size-4" /> : <span className="text-sm font-semibold">{i + 1}</span>}
                </div>
                {i < steps.length - 1 && (
                  <div className={`hidden h-0.5 flex-1 sm:block ${isComplete ? "bg-primary" : "bg-slate-200"}`} />
                )}
              </div>
            </div>
            <div className="pb-6 sm:pt-3 sm:text-center">
              <p className={`text-sm font-semibold ${isFuture ? "text-slate-400" : "text-slate-900"}`}>{step.label}</p>
              <p className="text-xs text-slate-500">{step.date}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
