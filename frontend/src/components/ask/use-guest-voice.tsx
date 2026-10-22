"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

import type { OpenSignupPrompt } from "@/components/ask/use-guest-signup-wall";
import { AnalyticsEvents, track } from "@/lib/analytics";
import { FEATURES } from "@/lib/features";
import { canGuestVoice, getGuestSessionId, recordGuestVoiceUsed } from "@/lib/guest-store";
import { useTranslation } from "@/lib/i18n";

// Loaded in the background once the page is ready, so it's there when the
// visitor taps Voice (iOS only starts audio from the tap itself).
const VoiceModeOverlay = dynamic(
  () => import("@/components/mera-vakil/voice-mode-overlay").then((m) => m.VoiceModeOverlay),
  { ssr: false },
);

export type VoiceEntryPoint = "home_hero" | "ask_page";

/**
 * Voice for logged-out visitors, with the one check every entry point uses:
 * guest voice switched on and today's free session unused → voice opens;
 * otherwise the sign-up sheet (worded for voice). The overlay itself enforces
 * the ~90s cap and the server's daily limit.
 */
export function useGuestVoice(openSignupPrompt: OpenSignupPrompt) {
  const { lang } = useTranslation();
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  function openGuestVoice(pendingText: string, entryPoint: VoiceEntryPoint) {
    if (FEATURES.GUEST_VOICE && canGuestVoice()) {
      track(AnalyticsEvents.SAARTHI_VOICE_MODE_ACTIVATED, { is_guest: true, entry_point: entryPoint });
      setOpen(true);
    } else if (FEATURES.GUEST_VOICE) {
      openSignupPrompt("voice_limit", pendingText, { reason: "voice", limitType: "daily_voice_session" });
    } else {
      openSignupPrompt("voice_limit", pendingText); // guest voice switched off — not a limit
    }
  }

  const voiceOverlay =
    FEATURES.GUEST_VOICE && mounted ? (
      <VoiceModeOverlay
        open={open}
        onClose={() => setOpen(false)}
        speechLocale={lang === "hi" ? "hi-IN" : "en-IN"}
        sessionId={getGuestSessionId()}
        guest
        onGuestLimit={() => {
          setOpen(false);
          openSignupPrompt("voice_limit", "", { reason: "voice", limitType: "daily_voice_session" });
        }}
        onGuestEnded={() => {
          recordGuestVoiceUsed();
          setOpen(false);
          openSignupPrompt("voice_limit", "", { reason: "voice", limitType: "voice_time_cap", voiceSeconds: 90 });
        }}
      />
    ) : null;

  return { openGuestVoice, voiceOverlay };
}
