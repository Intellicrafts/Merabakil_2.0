"use client";

import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

interface PremiumSelectOption {
  value: string;
  label: string;
}

interface PremiumSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: PremiumSelectOption[];
  placeholder?: string;
  icon?: React.ReactNode;
  "aria-label"?: string;
  className?: string;
}

export function PremiumSelect({
  value,
  onChange,
  options,
  placeholder,
  icon,
  "aria-label": ariaLabel,
  className,
}: PremiumSelectProps) {
  return (
    <div className={cn("relative", className)}>
      {icon && (
        <div className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-muted-foreground">
          {icon}
        </div>
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={ariaLabel}
        className={cn(
          "w-full appearance-none rounded-2xl border border-black/[0.06] bg-white/60 py-2.5 text-sm shadow-[0_2px_8px_rgba(15,23,42,0.04)] backdrop-blur-md transition-all duration-200",
          "hover:border-slate-300/60 hover:bg-white/80 hover:shadow-[0_4px_14px_rgba(15,23,42,0.07)]",
          "focus:border-slate-400/50 focus:outline-none focus:ring-2 focus:ring-slate-400/30",
          "dark:border-white/10 dark:bg-white/[0.06] dark:hover:border-white/20 dark:hover:bg-white/[0.09]",
          icon ? "pl-9 pr-9" : "px-3.5 pr-9",
        )}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
    </div>
  );
}
