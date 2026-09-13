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
      className="mv-assistant mv-thinking-row"
      role="status"
      aria-live="polite"
      aria-label="Saarthi is thinking"
    >
      <SaarthiMark state="thinking" className="mv-assistant-mark h-9 w-9 shrink-0" />
      <div className="mv-thinking-card">
        <span key={label} className="mv-thinking-label demo-shimmer inline-block">
          {label}
        </span>
      </div>
    </div>
  );
}
