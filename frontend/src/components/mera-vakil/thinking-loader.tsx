"use client";

import { Sparkles } from "lucide-react";
import { useEffect, useState } from "react";

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
      className="flex items-center gap-3.5"
      role="status"
      aria-live="polite"
      aria-label="Saarthi is thinking"
    >
      <div className="relative flex h-9 w-9 shrink-0 items-center justify-center">
        <div className="spinner-glow absolute inset-0 rounded-full bg-gradient-to-br from-slate-500/40 to-slate-700/40 blur-md" />
        <div className="spinner-ring absolute inset-0" />
        <div className="relative flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-slate-700 to-slate-900 text-white shadow-sm dark:from-slate-200 dark:to-slate-400 dark:text-slate-900">
          <Sparkles className="spark-twinkle h-3.5 w-3.5" strokeWidth={2.25} />
        </div>
      </div>

      <span className="gradient-text text-sm font-medium tracking-tight">{label}</span>
    </div>
  );
}
