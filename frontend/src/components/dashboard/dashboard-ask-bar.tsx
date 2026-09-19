"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowUpRight, AudioLines, Sparkles } from "lucide-react";

import { isVoiceBotSupported } from "@/hooks/use-voice-bot";
import type { HeroAccent } from "@/lib/dashboard-config";
import { FEATURES } from "@/lib/features";
import { useTranslation } from "@/lib/i18n";
import { markNavigationStart } from "@/lib/navigation-feedback";
import { setMeraVakilPrefill, setMeraVakilVoiceOpen } from "@/lib/prefill-store";
import { cn } from "@/lib/utils";

export function DashboardAskBar({
  className,
  accent = "default",
}: {
  className?: string;
  accent?: HeroAccent;
}) {
  const router = useRouter();
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const [voiceReady, setVoiceReady] = useState(false);

  useEffect(() => {
    setVoiceReady(FEATURES.VOICE && isVoiceBotSupported());
  }, []);

  function goToSaarthi(opts?: { voice?: boolean }) {
    const trimmed = query.trim();
    if (trimmed) setMeraVakilPrefill(trimmed);
    if (opts?.voice) setMeraVakilVoiceOpen();
    markNavigationStart();
    router.push("/mera-vakil");
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    goToSaarthi();
  }

  const accentClass =
    accent === "citizen"
      ? "dash-ask--citizen"
      : accent === "advocate"
        ? "dash-ask--advocate"
        : "dash-ask--default";

  return (
    <form
      onSubmit={onSubmit}
      role="search"
      className={cn("dash-ask-bar dash-ask-bar-premium w-full min-w-0", accentClass, className)}
      aria-labelledby="ask-bar-heading"
    >
      <h2 id="ask-bar-heading" className="sr-only">
        {t("dashboard.askSaarthi")}
      </h2>

      <div className="dash-ask-shell">
        <div className="dash-ask-input-row">
          <span className="dash-ask-icon" aria-hidden>
            <Sparkles className="h-4 w-4" strokeWidth={1.75} />
          </span>
          <label htmlFor="dashboard-ask" className="sr-only">
            {t("dashboard.askSaarthi")}
          </label>
          <input
            id="dashboard-ask"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("dashboard.askSaarthiPlaceholder")}
            autoComplete="off"
            enterKeyHint="search"
            className="dash-ask-input"
          />
        </div>

        <div className="dash-ask-actions">
          {voiceReady ? (
            <button
              type="button"
              onClick={() => goToSaarthi({ voice: true })}
              aria-label={t("dashboard.voiceMode")}
              title={t("dashboard.voiceMode")}
              className="dash-ask-btn dash-ask-btn-secondary dash-ask-btn-icon"
            >
              <AudioLines className="h-4 w-4 shrink-0" strokeWidth={1.85} />
              <span className="hidden sm:inline">{t("dashboard.voice")}</span>
            </button>
          ) : null}
          <button type="submit" className="dash-ask-btn dash-ask-btn-primary">
            <span>{t("dashboard.askCta")}</span>
            <ArrowUpRight className="h-4 w-4 shrink-0" strokeWidth={2.25} />
          </button>
        </div>
      </div>
    </form>
  );
}
