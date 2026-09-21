"use client";

import { cn } from "@/lib/utils";

type AuthMethod = "password" | "otp";

type AuthMethodTabsProps = {
  value: AuthMethod;
  onChange: (value: AuthMethod) => void;
  passwordLabel: string;
  otpLabel: string;
  disabled?: boolean;
};

export function AuthMethodTabs({
  value,
  onChange,
  passwordLabel,
  otpLabel,
  disabled = false,
}: AuthMethodTabsProps) {
  return (
    <div
      className="grid grid-cols-2 gap-1 rounded-xl border border-black/[0.08] bg-black/[0.03] p-1 dark:border-white/[0.10] dark:bg-white/[0.04]"
      role="tablist"
      aria-label="Sign-in method"
    >
      {(
        [
          { id: "password" as const, label: passwordLabel },
          { id: "otp" as const, label: otpLabel },
        ] as const
      ).map(({ id, label }) => {
        const selected = value === id;
        return (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={selected}
            disabled={disabled}
            onClick={() => onChange(id)}
            className={cn(
              "h-10 rounded-lg text-sm font-medium transition-all duration-150",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              selected
                ? "bg-white text-primary shadow-sm dark:bg-zinc-800"
                : "text-muted-foreground hover:text-foreground",
              disabled && "opacity-60",
            )}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
