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

/** Matched-height social row: branded shell + official GIS overlay for clicks. */
export function GoogleSignInButton({
  disabled = false,
  loading = false,
  onReadyError,
  className,
}: GoogleSignInButtonProps) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const onReadyErrorRef = useRef(onReadyError);
  onReadyErrorRef.current = onReadyError;

  useEffect(() => {
    const node = overlayRef.current;
    if (!node || disabled) return;

    let cancelled = false;
    let lastWidth = 0;

    const render = () => {
      const width = Math.max(node.offsetWidth || 0, 280);
      if (lastWidth > 0 && Math.abs(width - lastWidth) < 8) return;
      lastWidth = width;
      renderGoogleSignInButton(node, { width }).catch(() => {
        if (!cancelled) onReadyErrorRef.current?.("Could not load Google sign-in.");
      });
    };

    render();
    const observer = new ResizeObserver(render);
    observer.observe(node);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [disabled]);

  const isBusy = disabled || loading;

  return (
    <div
      className={cn(
        "relative h-12 w-full",
        isBusy && "pointer-events-none opacity-75",
        className,
      )}
    >
      <div
        className={cn(
          "pointer-events-none flex h-12 w-full items-center justify-center gap-2.5 rounded-2xl",
          "border border-black/[0.08] bg-white",
          "dark:border-white/10 dark:bg-white/[0.06]",
        )}
      >
        <GoogleLogo className="h-[18px] w-[18px]" />
        <span className="text-sm font-medium text-foreground">Continue with Google</span>
        {loading ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden /> : null}
      </div>
      <div
        ref={overlayRef}
        className="google-signin-overlay absolute inset-0 z-10 overflow-hidden rounded-2xl opacity-[0.02]"
        aria-label="Continue with Google"
      />
    </div>
  );
}
