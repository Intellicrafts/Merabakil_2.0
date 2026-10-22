"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowUpRight, AudioLines, Sparkles } from "lucide-react";

import { isVoiceBotSupported } from "@/hooks/use-voice-bot";
import { CLARITY_MASK } from "@/lib/analytics/clarity-mask";
import type { HeroAccent } from "@/lib/dashboard-config";
import { FEATURES } from "@/lib/features";
import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

const MAX_LEN = 2000;

/**
 * Question composer on the free ask page and the homepage hero. Visually matches
 * the dashboard ask bar but delegates the action to `onAsk` so the caller can
 * answer in place, open voice, or navigate.
 */
export function AskComposer({
  value,
  onChange,
  onAsk,
  accent = "default",
  className,
  autoFocus = false,
  allowEmpty = false,
  onEmpty,
}: {
  value: string;
  onChange: (value: string) => void;
  onAsk: (query: string, opts?: { voice?: boolean }) => void;
  accent?: HeroAccent;
  className?: string;
  /** Focus the box on load — on devices with a mouse only, so phones don't pop the keyboard over the page. */
  autoFocus?: boolean;
  /** Ask with an empty box still calls `onAsk` (e.g. the home page opens the ask page). */
  allowEmpty?: boolean;
  /** Ask pressed with an empty box (when `allowEmpty` is off). */
  onEmpty?: () => void;
}) {
  const { t } = useTranslation();
  const [voiceReady, setVoiceReady] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setVoiceReady(FEATURES.VOICE && isVoiceBotSupported());
    if (autoFocus && window.matchMedia?.("(pointer: fine)").matches) {
      inputRef.current?.focus({ preventScroll: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function submit(opts?: { voice?: boolean }) {
    const trimmed = value.trim().slice(0, MAX_LEN);
    if (!trimmed && !opts?.voice && !allowEmpty) {
      onEmpty?.();
      inputRef.current?.focus();
      return;
    }
    onAsk(trimmed, opts);
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    submit();
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
      aria-label={t("ask.headline")}
    >
      <div className="dash-ask-shell">
        <div className="dash-ask-input-row">
          <span className="dash-ask-icon" aria-hidden>
            <Sparkles className="h-4 w-4" strokeWidth={1.75} />
          </span>
          <label htmlFor="ask-composer" className="sr-only">
            {t("ask.placeholder")}
          </label>
          <input
            {...CLARITY_MASK}
            ref={inputRef}
            id="ask-composer"
            value={value}
            onChange={(e) => onChange(e.target.value.slice(0, MAX_LEN))}
            placeholder={t("ask.placeholder")}
            autoComplete="off"
            enterKeyHint="send"
            maxLength={MAX_LEN}
            className="dash-ask-input"
          />
        </div>

        <div className="dash-ask-actions">
          {voiceReady ? (
            <button
              type="button"
              onClick={() => submit({ voice: true })}
              aria-label={t("ask.voice")}
              title={t("ask.voice")}
              className="dash-ask-btn dash-ask-btn-secondary dash-ask-btn-icon"
            >
              <AudioLines className="h-4 w-4 shrink-0" strokeWidth={1.85} />
              <span className="hidden sm:inline">{t("ask.voice")}</span>
            </button>
          ) : null}
          <button type="submit" className="dash-ask-btn dash-ask-btn-primary">
            <span>{t("ask.askCta")}</span>
            <ArrowUpRight className="h-4 w-4 shrink-0" strokeWidth={2.25} />
          </button>
        </div>
      </div>
    </form>
  );
}
