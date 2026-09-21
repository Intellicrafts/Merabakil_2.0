"use client";

import { cn } from "@/lib/utils";

type RegisterStepIndicatorProps = {
  currentStep: 1 | 2 | 3;
  labels: [string, string, string];
};

export function RegisterStepIndicator({ currentStep, labels }: RegisterStepIndicatorProps) {
  return (
    <div className="mb-1 flex items-center justify-center gap-2">
      {labels.map((label, index) => {
        const step = (index + 1) as 1 | 2 | 3;
        const active = step === currentStep;
        const completed = step < currentStep;
        return (
          <div key={label} className="flex items-center gap-2">
            <div className="flex flex-col items-center gap-1">
              <div
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors",
                  active && "bg-primary text-primary-foreground",
                  completed && "bg-primary/15 text-primary",
                  !active && !completed && "bg-black/[0.06] text-muted-foreground dark:bg-white/[0.08]",
                )}
                aria-current={active ? "step" : undefined}
              >
                {step}
              </div>
              <span
                className={cn(
                  "hidden text-[10px] font-medium sm:block",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                {label}
              </span>
            </div>
            {index < labels.length - 1 ? (
              <div
                className={cn(
                  "mb-4 h-px w-8 sm:w-10",
                  completed ? "bg-primary/40" : "bg-black/[0.08] dark:bg-white/[0.10]",
                )}
              />
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
