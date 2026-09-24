"use client";

import { useState } from "react";

import { AskComposer } from "@/components/ask/ask-composer";
import { useAskSubmit } from "@/components/ask/use-ask-submit";
import { cn } from "@/lib/utils";

/**
 * Homepage hero entry point — reuses the shared composer + submit hook. Asking a
 * question sends the visitor into the Saarthi guest chat (no signup wall).
 */
export function HomeAskEntry({ className }: { className?: string }) {
  const [query, setQuery] = useState("");
  const { submitQuestion } = useAskSubmit();

  return (
    <div className={cn("w-full", className)}>
      <AskComposer
        value={query}
        onChange={setQuery}
        onAsk={(q, opts) => submitQuestion(q, "typed", opts)}
      />
    </div>
  );
}
