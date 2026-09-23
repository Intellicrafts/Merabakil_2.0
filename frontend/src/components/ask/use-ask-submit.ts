"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { AnalyticsEvents, track } from "@/lib/analytics";
import { getStoredUser, getToken } from "@/lib/api";
import { useTranslation } from "@/lib/i18n";
import { markNavigationStart } from "@/lib/navigation-feedback";
import { setMeraVakilAutoSend, setMeraVakilPrefill, setMeraVakilVoiceOpen } from "@/lib/prefill-store";

const SAARTHI = "/mera-vakil";

export type AskSource = "typed" | "chip" | "example";

function lengthBucket(len: number): string {
  if (len < 50) return "short";
  if (len < 200) return "medium";
  if (len < 600) return "long";
  return "very_long";
}

/**
 * Shared submit flow for /ask and the homepage hero: stash the question (+ ad
 * params already in sessionStorage), fire question_submitted (no question text),
 * then either go straight to Saarthi (logged in) or open the inline auth sheet.
 */
export function useAskSubmit() {
  const router = useRouter();
  const { lang } = useTranslation();
  const [authOpen, setAuthOpen] = useState(false);

  function submitQuestion(text: string, source: AskSource, opts?: { voice?: boolean }) {
    const trimmed = text.trim();
    if (!trimmed && !opts?.voice) return;

    track(AnalyticsEvents.QUESTION_SUBMITTED, {
      source,
      lang,
      length_bucket: lengthBucket(trimmed.length),
      ...(opts?.voice ? { voice: true } : {}),
    });

    if (opts?.voice) {
      setMeraVakilVoiceOpen();
      if (trimmed) setMeraVakilPrefill(trimmed);
    } else {
      setMeraVakilPrefill(trimmed);
      setMeraVakilAutoSend();
    }

    if (getToken() && getStoredUser()) {
      markNavigationStart();
      router.push(SAARTHI);
    } else {
      setAuthOpen(true);
    }
  }

  return { submitQuestion, authOpen, setAuthOpen };
}
