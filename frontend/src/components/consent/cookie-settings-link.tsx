"use client";

import { clearConsent } from "@/lib/consent";
import { cn } from "@/lib/utils";

interface CookieSettingsLinkProps {
  className?: string;
}

export function CookieSettingsLink({ className }: CookieSettingsLinkProps) {
  return (
    <button
      type="button"
      className={cn("hover:text-foreground", className)}
      onClick={() => clearConsent()}
    >
      Cookie settings
    </button>
  );
}
