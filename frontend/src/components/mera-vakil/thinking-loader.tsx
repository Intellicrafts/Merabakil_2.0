"use client";

import { useEffect, useState } from "react";

import { SaarthiMark } from "@/components/mera-vakil/saarthi-mark";

const STATUS_MESSAGES = [
  "Thinking…",
  "Searching the legal corpus…",
  "Analyzing statutes and precedents…",
  "Grounding citations…",
  "Preparing your answer…",
];

interface ThinkingLoaderProps {
  message?: string;
}

export function ThinkingLoader({ message }: ThinkingLoaderProps) {
  const [msgIndex, setMsgIndex] = useState(0);

  useEffect(() => {
    if (message) return undefined;
    const interval = setInterval(() => {
      setMsgIndex((i) => (i + 1) % STATUS_MESSAGES.length);
    }, 2200);
    return () => clearInterval(interval);
  }, [message]);

  const label = message ?? STATUS_MESSAGES[msgIndex];

  return (
    <div
      className="flex items-center gap-3"
      role="status"
      aria-live="polite"
      aria-label="Saarthi is thinking"
    >
      <SaarthiMark state="thinking" className="h-9 w-9 shrink-0" />
      <span key={label} className="mv-thinking-label">
        {label}
      </span>
    </div>
  );
}
