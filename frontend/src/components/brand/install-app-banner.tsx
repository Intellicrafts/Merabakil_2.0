"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

const DISMISS_KEY = "merabakil.install-banner-dismissed";

type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  const media = window.matchMedia?.("(display-mode: standalone)")?.matches;
  const ios = "standalone" in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone);
  return Boolean(media || ios);
}

export function InstallAppBanner() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (isStandalone() || localStorage.getItem(DISMISS_KEY) === "1") return;

    const onPrompt = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
      setOpen(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!open || !promptEvent || isStandalone()) return null;

  async function install() {
    await promptEvent?.prompt();
    const choice = await promptEvent?.userChoice;
    if (choice?.outcome === "accepted") {
      localStorage.setItem(DISMISS_KEY, "1");
    }
    setOpen(false);
    setPromptEvent(null);
  }

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, "1");
    setOpen(false);
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-[90] px-3 pb-[calc(env(safe-area-inset-bottom,0px)+12px)] pt-2 sm:px-4">
      <div
        role="dialog"
        aria-label="Install Mera Bakil"
        className="mx-auto flex max-w-lg items-center gap-3 rounded-2xl border border-black/[0.08] bg-white/95 p-3 shadow-[0_-8px_32px_rgba(15,23,42,0.16)] backdrop-blur-md dark:border-white/10 dark:bg-zinc-950/95"
      >
        <img
          src="/brand/app-icon-192.png"
          alt=""
          className="h-14 w-14 shrink-0 rounded-2xl object-cover"
        />
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-semibold tracking-tight">Install Mera Bakil</p>
          <p className="text-[12px] text-muted-foreground">Legal Help. Made Simple.</p>
        </div>
        <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row">
          <Button size="sm" className="rounded-full" onClick={() => void install()}>
            Install
          </Button>
          <Button size="sm" variant="ghost" className="rounded-full" onClick={dismiss}>
            Not now
          </Button>
        </div>
      </div>
    </div>
  );
}
