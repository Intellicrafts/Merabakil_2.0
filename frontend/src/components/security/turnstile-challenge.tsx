"use client";

import { useEffect, useRef } from "react";

/**
 * Cloudflare Turnstile bot check. Loaded only when the server asks for one
 * (many guests on one network), so ordinary visitors never download it.
 */
export const TURNSTILE_SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

type TurnstileApi = {
  render: (el: HTMLElement, options: Record<string, unknown>) => string;
  remove: (widgetId: string) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

let scriptPromise: Promise<void> | null = null;

function loadTurnstile(): Promise<void> {
  if (window.turnstile) return Promise.resolve();
  scriptPromise ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = SCRIPT_SRC;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => {
      scriptPromise = null;
      reject(new Error("turnstile_load_failed"));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export function TurnstileChallenge({
  lang,
  onToken,
  onError,
}: {
  lang: string;
  onToken: (token: string) => void;
  onError: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const handlers = useRef({ onToken, onError });
  handlers.current = { onToken, onError };

  useEffect(() => {
    let widgetId: string | undefined;
    let cancelled = false;
    loadTurnstile()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;
        widgetId = window.turnstile.render(containerRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          language: lang,
          callback: (token: string) => handlers.current.onToken(token),
          "error-callback": () => handlers.current.onError(),
        });
      })
      .catch(() => {
        if (!cancelled) handlers.current.onError();
      });
    return () => {
      cancelled = true;
      if (widgetId) window.turnstile?.remove(widgetId);
    };
  }, [lang]);

  return <div ref={containerRef} className="flex min-h-[65px] justify-center" />;
}
