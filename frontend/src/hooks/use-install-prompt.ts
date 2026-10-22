"use client";

import { useEffect, useState } from "react";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "merabakil.install-banner-dismissed";

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const media = window.matchMedia?.("(display-mode: standalone)")?.matches;
  const ios =
    "standalone" in navigator &&
    Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return Boolean(media || ios);
}

/**
 * Shared hook for the PWA install prompt.
 * Returns `canInstall` (true when the browser has queued an install event and
 * the app is not already running standalone), the `install()` trigger, and
 * `standalone` so callers can hide themselves when already installed.
 */
export function useInstallPrompt() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(
    null,
  );
  const [standalone, setStandalone] = useState(false);

  useEffect(() => {
    setStandalone(isStandalone());

    if (isStandalone() || localStorage.getItem(DISMISS_KEY) === "1") return;

    const handler = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  async function install() {
    if (!promptEvent) return false;
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    const accepted = choice?.outcome === "accepted";
    if (accepted) {
      localStorage.setItem(DISMISS_KEY, "1");
      setPromptEvent(null);
    }
    return accepted;
  }

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setPromptEvent(null);
  }

  return {
    canInstall: Boolean(promptEvent) && !standalone,
    standalone,
    install,
    dismiss,
  };
}
