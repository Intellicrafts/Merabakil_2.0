"use client";

import { useState } from "react";

import { AskAuthSheet } from "@/components/ask/ask-auth-sheet";
import { AskComposer } from "@/components/ask/ask-composer";
import { useAskSubmit } from "@/components/ask/use-ask-submit";
import { cn } from "@/lib/utils";

/**
 * Homepage hero entry point — same question-first flow as /ask, reusing the
 * shared composer + submit hook so both surfaces behave identically.
 */
export function HomeAskEntry({ className }: { className?: string }) {
  const [query, setQuery] = useState("");
  const { submitQuestion, authOpen, setAuthOpen } = useAskSubmit();

  return (
    <div className={cn("w-full", className)}>
      <AskComposer
        value={query}
        onChange={setQuery}
        onAsk={(q, opts) => submitQuestion(q, "typed", opts)}
      />
      <AskAuthSheet open={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  );
}
