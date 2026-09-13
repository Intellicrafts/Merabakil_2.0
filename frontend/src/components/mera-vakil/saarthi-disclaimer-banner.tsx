"use client";

import { AlertCircle, X } from "lucide-react";
import { useEffect, useState } from "react";

const STORAGE_KEY = "legalos.saarthi.disclaimer.dismissed";

export function SaarthiDisclaimerBanner() {
  const [ready, setReady] = useState(false);
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(window.localStorage.getItem(STORAGE_KEY) === "1");
    setReady(true);
  }, []);

  if (!ready || dismissed) return null;

  function dismiss() {
    window.localStorage.setItem(STORAGE_KEY, "1");
    setDismissed(true);
  }

  return (
    <div
      role="note"
      className="flex shrink-0 items-start gap-2 border-b border-amber-500/15 bg-amber-500/[0.05] px-3 py-2 sm:items-center sm:px-4"
    >
      <AlertCircle
        className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700/80 dark:text-amber-300/80 sm:mt-0"
        aria-hidden
      />
      <p className="min-w-0 flex-1 text-[11px] leading-snug text-amber-950/85 dark:text-amber-100/90 sm:text-xs">
        Saarthi provides informational guidance only — not legal advice. Consult a licensed advocate for
        advice specific to your situation.
      </p>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss disclaimer"
        className="shrink-0 rounded-md p-1 text-amber-800/70 transition-colors hover:bg-amber-500/10 hover:text-amber-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40 dark:text-amber-200/70 dark:hover:text-amber-50"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
