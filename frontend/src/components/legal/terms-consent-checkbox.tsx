"use client";

import Link from "next/link";

import { cn } from "@/lib/utils";

interface TermsConsentCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  id?: string;
  className?: string;
}

export function TermsConsentCheckbox({
  checked,
  onChange,
  disabled = false,
  id = "terms-consent",
  className,
}: TermsConsentCheckboxProps) {
  return (
    <div className={cn("space-y-2", className)}>
      <label htmlFor={id} className="flex cursor-pointer items-start gap-2.5 text-sm leading-snug">
        <input
          id={id}
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0 rounded border-black/20 accent-primary"
          required
        />
        <span className="text-muted-foreground">
          I agree to the{" "}
          <Link href="/terms" target="_blank" className="font-medium text-primary underline-offset-2 hover:underline">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href="/privacy" target="_blank" className="font-medium text-primary underline-offset-2 hover:underline">
            Privacy Policy
          </Link>
        </span>
      </label>
      <p className="text-[11px] leading-relaxed text-muted-foreground/80">
        MeraBakil provides informational AI guidance only. It is not a substitute for advice from a licensed
        advocate.
      </p>
    </div>
  );
}
