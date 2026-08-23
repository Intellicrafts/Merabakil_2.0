"use client";

import { Loader2 } from "lucide-react";
import { useEffect, useRef } from "react";

import { GoogleLogo } from "@/components/auth/google-logo";
import { renderGoogleSignInButton } from "@/lib/google-identity";
import { cn } from "@/lib/utils";

interface GoogleSignInButtonProps {
  disabled?: boolean;
  loading?: boolean;
  onReadyError?: (message: string) => void;
  className?: string;
}

/** Premium shell + invisible official Google button for OAuth compliance. */
export function GoogleSignInButton({
  disabled = false,
  loading = false,
  onReadyError,
  className,
}: GoogleSignInButtonProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = overlayRef.current;
    if (!node || disabled) return;

    let cancelled = false;
    renderGoogleSignInButton(node, { width: node.offsetWidth || 360 }).catch(() => {
      if (!cancelled) onReadyError?.("Could not load Google sign-in.");
    });

    return () => {
      cancelled = true;
    };
  }, [disabled, onReadyError]);

  const isBusy = disabled || loading;

  return (
    <div
      className={cn(
        "group relative w-full",
        isBusy && "pointer-events-none opacity-75",
        className,
      )}
    >
      {/* Premium visual layer (decorative) */}
      <div
        className={cn(
          "pointer-events-none flex h-[52px] w-full items-center justify-center gap-3 rounded-2xl",
          "border border-black/[0.07] bg-gradient-to-b from-white to-zinc-50/90",
          "shadow-[0_1px_2px_rgba(0,0,0,0.06),0_4px_12px_rgba(0,0,0,0.04)]",
          "ring-1 ring-black/[0.04]",
          "transition-all duration-200 group-hover:shadow-[0_2px_8px_rgba(0,0,0,0.08),0_8px_24px_rgba(0,0,0,0.06)]",
          "group-hover:-translate-y-px group-active:translate-y-0",
          "dark:border-white/10 dark:from-zinc-900 dark:to-zinc-950 dark:ring-white/[0.06]",
        )}
      >
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white shadow-sm ring-1 ring-black/[0.05] dark:bg-zinc-800 dark:ring-white/10">
          <GoogleLogo className="h-[18px] w-[18px]" />
        </span>
        <span className="text-[15px] font-semibold tracking-[-0.01em] text-foreground/90">
          Continue with Google
        </span>
        {loading ? (
          <Loader2 className="ml-1 h-4 w-4 animate-spin text-muted-foreground" aria-hidden />
        ) : null}
      </div>

      {/* Official GIS button — transparent overlay captures clicks */}
      <div
        ref={overlayRef}
        className="google-signin-overlay absolute inset-0 z-10 overflow-hidden rounded-2xl opacity-[0.011]"
        aria-label="Continue with Google"
      />
    </div>
  );
}
