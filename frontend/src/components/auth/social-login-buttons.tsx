"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { Badge } from "@/components/ui/badge";
import { handleGoogleCredential, isGoogleAuthEnabled } from "@/lib/auth/google-flow";
import { getGoogleOriginHint, subscribeGoogleCredential } from "@/lib/google-identity";

function XIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

interface SocialLoginButtonsProps {
  onError?: (message: string) => void;
  nextPath?: string | null;
  disabled?: boolean;
}

export function SocialLoginButtons({
  onError,
  nextPath,
  disabled = false,
}: SocialLoginButtonsProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const googleEnabled = isGoogleAuthEnabled();

  useEffect(() => {
    if (!googleEnabled) return;

    const unsubscribe = subscribeGoogleCredential(async (credential) => {
      if (disabled || loading) return;
      setLoading(true);
      try {
        await handleGoogleCredential(credential, router, nextPath);
      } catch (err) {
        const message = (err as Error).message || "Google sign-in failed.";
        if (message.toLowerCase().includes("origin") || message.toLowerCase().includes("oauth")) {
          onError?.(`${message} ${getGoogleOriginHint()}`);
        } else {
          onError?.(message);
        }
      } finally {
        setLoading(false);
      }
    });

    return unsubscribe;
  }, [googleEnabled, router, nextPath, onError, disabled]);

  return (
    <div className="space-y-3">
      {googleEnabled ? (
        <GoogleSignInButton
          disabled={disabled}
          loading={loading}
          onReadyError={(message) => onError?.(message)}
        />
      ) : null}

      <button
        type="button"
        disabled
        className="relative flex w-full items-center justify-center gap-2.5 rounded-2xl border border-black/[0.08] bg-white/60 px-4 py-3 text-sm font-medium text-foreground/80 opacity-70 backdrop-blur-sm dark:border-white/10 dark:bg-white/[0.05]"
        aria-label="Continue with X (coming soon)"
      >
        <XIcon />
        Continue with X
        <Badge variant="outline" className="ml-1 text-[10px]">
          Soon
        </Badge>
      </button>
    </div>
  );
}
