"use client";

import { SaarthiMark } from "@/components/mera-vakil/saarthi-mark";

interface AssistantSkeletonProps {
  statusMessage?: string;
}

export function AssistantSkeleton({ statusMessage }: AssistantSkeletonProps) {
  return (
    <div className="group mv-assistant" aria-hidden>
      <SaarthiMark state="thinking" className="mv-assistant-mark h-8 w-8" />
      <div className="mv-assistant-body min-w-0 flex-1">
        {statusMessage ? (
          <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            {statusMessage}
          </p>
        ) : null}
        <div className="mv-thinking-skeleton space-y-2.5" aria-hidden>
          <div className="mv-thinking-skeleton-line mv-thinking-skeleton-line--lg" />
          <div className="mv-thinking-skeleton-line mv-thinking-skeleton-line--md" />
          <div className="mv-thinking-skeleton-line mv-thinking-skeleton-line--sm" />
        </div>
      </div>
    </div>
  );
}
