"use client";

import { memo, useEffect, useRef, useState } from "react";
import { Pencil, Sparkles, X } from "lucide-react";

import { AnswerToolbar } from "@/components/mera-vakil/answer-toolbar";
import { ImageGallery, toGalleryImages } from "@/components/mera-vakil/image-gallery";
import { Markdown } from "@/components/mera-vakil/markdown";
import { LawyerRecommendationPanel } from "@/components/mera-vakil/lawyer-recommendation-panel";
import { ResearchMetadataPanel } from "@/components/mera-vakil/research-metadata-panel";
import { Button } from "@/components/ui/button";
import type { ReadAloudStatus } from "@/hooks/use-read-aloud";
import type { ChatMessage } from "@/lib/conversations";
import type { LawyerMatchResult } from "@/lib/types";
import { cn } from "@/lib/utils";

interface MessageBubbleProps {
  message: ChatMessage;
  isTyping?: boolean;
  isEditing?: boolean;
  isPending?: boolean;
  grounding?: boolean;
  onCitationClick?: (marker: string) => void;
  onStartEdit?: (messageId: string) => void;
  onCancelEdit?: () => void;
  onResendEdit?: (messageId: string, newContent: string) => void;
  onRegenerate?: () => void;
  readAloudStatus?: ReadAloudStatus;
  readAloudActiveId?: string | null;
  onReadAloudToggle?: (messageId: string, content: string) => void;
  onReadAloudStop?: () => void;
}

export const MessageBubble = memo(function MessageBubble({
  message,
  isTyping,
  isEditing,
  isPending,
  grounding,
  onCitationClick,
  onStartEdit,
  onCancelEdit,
  onResendEdit,
  onRegenerate,
  readAloudStatus = "idle",
  readAloudActiveId = null,
  onReadAloudToggle,
  onReadAloudStop,
}: MessageBubbleProps) {
  const [editText, setEditText] = useState(message.content);
  const [groundingOpen, setGroundingOpen] = useState(false);
  const editRef = useRef<HTMLTextAreaElement>(null);
  const answerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isEditing) {
      setEditText(message.content);
      editRef.current?.focus();
      editRef.current?.select();
    }
  }, [isEditing, message.content]);

  if (message.role === "user") {
    if (isEditing) {
      return (
        <div className="flex justify-end">
          <div className="w-full max-w-[85%] space-y-2 rounded-xl border border-black/[0.08] bg-white/70 p-3 shadow-sm dark:border-white/10 dark:bg-white/5">
            <textarea
              ref={editRef}
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={3}
              className="w-full resize-none bg-transparent text-[13.5px] leading-relaxed focus:outline-none"
              aria-label="Edit message"
              onKeyDown={(e) => {
                if (e.key === "Escape") onCancelEdit?.();
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  if (editText.trim().length >= 3) onResendEdit?.(message.id, editText.trim());
                }
              }}
            />
            <div className="flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="h-7 rounded-lg px-2.5 text-xs"
                onClick={onCancelEdit}
                disabled={isPending}
              >
                <X className="mr-1 h-3 w-3" />
                Cancel
              </Button>
              <Button
                size="sm"
                className="h-7 rounded-lg bg-amber-800 px-3 text-xs text-white hover:bg-amber-900 dark:bg-amber-600 dark:text-white"
                onClick={() => onResendEdit?.(message.id, editText.trim())}
                disabled={isPending || editText.trim().length < 3}
              >
                Resend
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="group flex justify-end">
        <div className="relative max-w-[80%]">
          <div className="rounded-2xl rounded-br-md bg-slate-900 px-4 py-2.5 text-white shadow-sm dark:bg-slate-100 dark:text-slate-900">
            <p className="text-[13.5px] leading-relaxed">{message.content}</p>
          </div>
          {onStartEdit && !isPending && (
            <button
              type="button"
              onClick={() => onStartEdit(message.id)}
              className="absolute -left-8 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground opacity-0 transition-all hover:bg-black/[0.05] hover:text-foreground group-hover:opacity-100 dark:hover:bg-white/10"
              aria-label="Edit message"
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
    );
  }

  const research = message.research;
  const stillTyping = Boolean(isTyping);
  const displayContent = message.content;
  const showAvatar = !(stillTyping && !message.content);
  const lawyers = (research?.specialist_payload?.lawyers ?? []) as LawyerMatchResult[];

  return (
    <div className="group flex gap-3">
      {showAvatar && (
        <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-white dark:bg-slate-200 dark:text-slate-900">
          <Sparkles className="h-3.5 w-3.5" />
        </div>
      )}
      {!showAvatar && <div className="w-6 shrink-0" aria-hidden />}

      <div className="min-w-0 flex-1 space-y-3 pt-0.5">
        {grounding && stillTyping && (
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Grounding authorities…
          </p>
        )}
        <div
          ref={answerRef}
          className="mv-brief-surface text-[13.5px] leading-[1.7] text-foreground/90"
        >
          <Markdown
            content={displayContent}
            onCitationClick={onCitationClick}
            webSources={research?.web_sources}
            sources={research?.sources}
            citations={research?.citations}
          />
          {stillTyping && (
            <span
              className="stream-caret ml-0.5 inline-block h-[1.1em] w-[2px] translate-y-[2px] bg-slate-600 dark:bg-slate-300"
              aria-hidden
            />
          )}
        </div>

        {!stillTyping && message.content && (
          <AnswerToolbar
            answerRef={answerRef}
            content={message.content}
            title={research?.query}
            messageId={message.id}
            onRegenerate={onRegenerate}
            readAloudStatus={readAloudStatus}
            readAloudActiveId={readAloudActiveId}
            onReadAloudToggle={onReadAloudToggle}
            onReadAloudStop={onReadAloudStop}
            hasGrounding={Boolean(research && (research.sources.length > 0 || research.citations.length > 0 || (research.web_sources?.length ?? 0) > 0))}
            groundingOpen={groundingOpen}
            onGroundingToggle={() => setGroundingOpen((o) => !o)}
          />
        )}

        {research && !stillTyping && (
          <div className="space-y-3">
            {research.web_images?.length > 0 && (
              <ImageGallery images={toGalleryImages(research.web_images)} />
            )}

            {groundingOpen && (
              <ResearchMetadataPanel research={research} onCitationClick={onCitationClick} initialOpen />
            )}

            {lawyers.length > 0 && <LawyerRecommendationPanel lawyers={lawyers} />}

            {research.disclaimer && (
              <p className="mv-msg-disclaimer">{research.disclaimer}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
});
