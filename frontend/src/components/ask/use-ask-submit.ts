"use client";

import { useRouter } from "next/navigation";

import { markNavigationStart } from "@/lib/navigation-feedback";
import { setMeraVakilAutoSend, setMeraVakilPrefill } from "@/lib/prefill-store";

const SAARTHI = "/mera-vakil";

export type AskSource = "typed" | "chip" | "example";

/**
 * Saarthi CTAs outside the ask page (homepage hero, etc.): go to /mera-vakil.
 * A typed question is stashed and auto-sent there (logged-out visitors get the
 * guest chat, 5 free; members the full chat). An empty box just opens the ask
 * page, ready to type. The question never goes in the URL, and
 * question_submitted fires at the real send.
 */
export function useAskSubmit() {
  const router = useRouter();

  function submitQuestion(text: string, _source: AskSource) {
    const trimmed = text.trim();
    if (trimmed) {
      setMeraVakilPrefill(trimmed);
      setMeraVakilAutoSend();
    }
    markNavigationStart();
    router.push(SAARTHI);
  }

  return { submitQuestion };
}
