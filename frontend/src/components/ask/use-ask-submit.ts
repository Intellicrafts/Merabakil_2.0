"use client";

import { useRouter } from "next/navigation";

import { markNavigationStart } from "@/lib/navigation-feedback";
import { setMeraVakilAutoSend, setMeraVakilPrefill, setMeraVakilVoiceOpen } from "@/lib/prefill-store";

const SAARTHI = "/mera-vakil";

export type AskSource = "typed" | "chip" | "example";

/**
 * Shared submit flow for Saarthi CTAs (homepage hero, etc.): stash the question
 * (+ ad params already in sessionStorage) and go to /mera-vakil. Logged-out
 * visitors land in the guest chat (5 free) which auto-sends it; logged-in users
 * land in the full chat which auto-sends. No signup wall up front. The
 * question_submitted event fires at the real send (in the landing/chat).
 */
export function useAskSubmit() {
  const router = useRouter();

  function submitQuestion(text: string, _source: AskSource, opts?: { voice?: boolean }) {
    const trimmed = text.trim();
    if (!trimmed && !opts?.voice) return;

    if (opts?.voice) {
      setMeraVakilVoiceOpen();
      if (trimmed) setMeraVakilPrefill(trimmed);
    } else {
      setMeraVakilPrefill(trimmed);
      setMeraVakilAutoSend();
    }

    markNavigationStart();
    router.push(SAARTHI);
  }

  return { submitQuestion };
}
