"use client";

import { useState } from "react";

import { AskAuthSheet } from "@/components/ask/ask-auth-sheet";
import { AnalyticsEvents, track } from "@/lib/analytics";
import type { SignupTrigger } from "@/lib/analytics/signup-source";
import { GUEST_DAILY_CHAT_LIMIT, guestChatsUsedToday } from "@/lib/guest-store";
import { useTranslation } from "@/lib/i18n";
import { setMeraVakilAutoSend, setMeraVakilPrefill } from "@/lib/prefill-store";

export type GuestLimitHit =
  | { reason: "text"; limitType: "daily_messages" }
  | { reason: "voice"; limitType: "daily_voice_session" | "voice_time_cap"; voiceSeconds?: number };

export type OpenSignupPrompt = (trigger: SignupTrigger, pendingQuestion?: string, limit?: GuestLimitHit) => void;

/**
 * The guest sign-up sheet: shown at a free-usage limit, for voice when guest
 * voice is off, and from the "sign up to save this chat" nudge. A pending
 * question is saved so it continues right after sign-up. Limit hits also emit
 * guest_limit_reached (counts only — never the question).
 */
export function useGuestSignupWall() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [wall, setWall] = useState<{ title?: string; subtitle?: string; trigger?: SignupTrigger }>({});

  const openSignupPrompt: OpenSignupPrompt = (trigger, pendingQuestion = "", limit) => {
    if (pendingQuestion.trim()) {
      setMeraVakilPrefill(pendingQuestion.trim());
      setMeraVakilAutoSend();
    }
    if (limit?.reason === "text") {
      track(AnalyticsEvents.GUEST_LIMIT_REACHED, {
        reason: "text",
        limit_type: limit.limitType,
        chats_used: Math.max(guestChatsUsedToday(), GUEST_DAILY_CHAT_LIMIT),
      });
    } else if (limit?.reason === "voice") {
      track(AnalyticsEvents.GUEST_LIMIT_REACHED, {
        reason: "voice",
        limit_type: limit.limitType,
        ...(limit.voiceSeconds !== undefined ? { voice_seconds_used: limit.voiceSeconds } : {}),
      });
    }
    // Every time the sign-up sheet is shown — limits and the nudge alike.
    track(AnalyticsEvents.GUEST_SIGNUP_PROMPT_SHOWN, { trigger, is_guest: true });
    setWall(
      trigger === "nudge"
        ? { trigger }
        : trigger === "voice_limit"
          ? limit
            ? { title: t("ask.voiceLimitTitle"), subtitle: t("ask.voiceLimitSubtitle"), trigger }
            : { title: t("ask.voiceSignInTitle"), subtitle: t("ask.voiceSignInSubtitle"), trigger }
          : { title: t("ask.limitTitle"), subtitle: t("ask.limitSubtitle"), trigger },
    );
    setOpen(true);
  };

  const signupSheet = (
    <AskAuthSheet
      open={open}
      onClose={() => setOpen(false)}
      title={wall.title}
      subtitle={wall.subtitle}
      source={wall.trigger}
    />
  );

  return { openSignupPrompt, signupSheet };
}
