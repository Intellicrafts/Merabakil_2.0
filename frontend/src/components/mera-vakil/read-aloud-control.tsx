"use client";

import { Loader2, Pause, Square, Volume2 } from "lucide-react";

import type { ReadAloudStatus } from "@/hooks/use-read-aloud";
import { cn } from "@/lib/utils";

interface ReadAloudControlProps {
  messageId: string;
  content: string;
  status: ReadAloudStatus;
  activeMessageId: string | null;
  onToggle: (messageId: string, content: string) => void;
  onStop: () => void;
}

export function ReadAloudControl({
  messageId,
  content,
  status,
  activeMessageId,
  onToggle,
  onStop,
}: ReadAloudControlProps) {
  const isActive = activeMessageId === messageId;
  const isPlaying = isActive && status === "playing";
  const isPaused = isActive && status === "paused";
  const isLoading = isActive && status === "loading";

  return (
    <div className="flex items-center gap-1 pt-1">
      <button
        type="button"
        onClick={() => onToggle(messageId, content)}
        disabled={isLoading}
        className={cn(
          "inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors",
          "hover:bg-black/[0.05] hover:text-foreground dark:hover:bg-white/10",
          isActive && "text-slate-700 dark:text-slate-200",
        )}
        aria-label={isPlaying ? "Pause read aloud" : isPaused ? "Resume read aloud" : "Read aloud"}
      >
        {isLoading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : isPlaying ? (
          <Pause className="h-3.5 w-3.5" />
        ) : (
          <Volume2 className="h-3.5 w-3.5" />
        )}
      </button>
      {isActive && (isPlaying || isPaused || isLoading) && (
        <button
          type="button"
          onClick={onStop}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-black/[0.05] hover:text-foreground dark:hover:bg-white/10"
          aria-label="Stop read aloud"
        >
          <Square className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
