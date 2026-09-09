"use client";

import { Select } from "@/components/ui/select";
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
    <Select
      value={value}
      onValueChange={onChange}
      options={options}
      placeholder={placeholder}
      icon={icon}
      aria-label={ariaLabel}
      className={cn("h-11 rounded-2xl", className)}
    />
  );
}
