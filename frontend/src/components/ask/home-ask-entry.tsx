"use client";

import { useState } from "react";

import { AskComposer } from "@/components/ask/ask-composer";
import { useAskSubmit } from "@/components/ask/use-ask-submit";
import { useGuestSignupWall } from "@/components/ask/use-guest-signup-wall";
import { useGuestVoice } from "@/components/ask/use-guest-voice";
import { trackMarketingCta } from "@/lib/analytics/track-cta";
import { cn } from "@/lib/utils";

/**
 * Homepage hero entry point (visitors here are always logged out).
 * Ask always hands off to the free question page. Voice stays on the home page
 * and goes through the same guest entitlement check as the question page.
 */
export function HomeAskEntry({ className }: { className?: string }) {
  const [query, setQuery] = useState("");
  const { submitQuestion } = useAskSubmit();
  const { openSignupPrompt, signupSheet } = useGuestSignupWall();
  const { openGuestVoice, voiceOverlay } = useGuestVoice(openSignupPrompt);

  return (
    <div className={cn("w-full", className)}>
      <AskComposer
        value={query}
        onChange={setQuery}
        allowEmpty
        onAsk={(q, opts) => {
          if (opts?.voice) {
            openGuestVoice(q, "home_hero");
            return;
          }
          // Keep the primary CTA deterministic even when the field is empty:
          // the question page is the place to continue a written question.
          trackMarketingCta("hero", "ask_saarthi", "/mera-vakil");
          submitQuestion(q, "typed");
        }}
      />
      {signupSheet}
      {voiceOverlay}
    </div>
  );
}
