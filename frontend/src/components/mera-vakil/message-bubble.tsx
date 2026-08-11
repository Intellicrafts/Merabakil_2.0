"use client";

import { useEffect, useRef, useState } from "react";
import { Pencil, Sparkles, X } from "lucide-react";

import { Markdown } from "@/components/mera-vakil/markdown";
import { ReadAloudControl } from "@/components/mera-vakil/read-aloud-control";
import { ResearchMetadataPanel } from "@/components/mera-vakil/research-metadata-panel";
import { Button } from "@/components/ui/button";
import type { ReadAloudStatus } from "@/hooks/use-read-aloud";
import type { ChatMessage } from "@/lib/conversations";
import { cn } from "@/lib/utils";

interface MessageBubbleProps {
  message: ChatMessage;
  isTyping?: boolean;
  isEditing?: boolean;
  isPending?: boolean;
  onCitationClick?: (marker: string) => void;
  onStartEdit?: (messageId: string) => void;
  onCancelEdit?: () => void;
  onResendEdit?: (messageId: string, newContent: string) => void;
  readAloudStatus?: ReadAloudStatus;
  readAloudActiveId?: string | null;
  onReadAloudToggle?: (messageId: string, content: string) => void;
  onReadAloudStop?: () => void;
}

export function MessageBubble({
  message,
  isTyping,
  isEditing,
  isPending,
  onCitationClick,
  onStartEdit,
  onCancelEdit,
  onResendEdit,
  readAloudStatus = "idle",
  readAloudActiveId = null,
  onReadAloudToggle,
  onReadAloudStop,
}: MessageBubbleProps) {
  const [editText, setEditText] = useState(message.content);
  const editRef = useRef<HTMLTextAreaElement>(null);

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
                className="h-7 rounded-lg bg-gradient-to-r from-slate-800 to-slate-900 px-3 text-xs text-white dark:from-slate-100 dark:to-slate-300 dark:text-slate-900"
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
          <div className="rounded-2xl rounded-br-md bg-gradient-to-br from-slate-800 to-slate-900 px-4 py-2.5 text-white shadow-[0_3px_14px_rgba(15,23,42,0.18)] dark:from-slate-100 dark:to-slate-300 dark:text-slate-900">
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

  return (
    <div className="group flex gap-3">
      {showAvatar && (
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-slate-700 to-slate-900 text-white shadow-sm dark:from-slate-200 dark:to-slate-400 dark:text-slate-900">
          <Sparkles className="icon-breathe h-3.5 w-3.5" />
        </div>
      )}
      {!showAvatar && <div className="w-7 shrink-0" aria-hidden />}

      <div className="min-w-0 flex-1 space-y-3 pt-0.5">
        <div
          className={cn(
            "text-[13.5px] leading-7 text-foreground/90",
            message.content &&
              "rounded-2xl bg-white/40 px-4 py-3 shadow-[0_2px_12px_rgba(15,23,42,0.05)] backdrop-blur-sm dark:bg-white/[0.03]",
          )}
        >
          <Markdown content={displayContent} onCitationClick={onCitationClick} />
          {stillTyping && (
            <span
              className="stream-caret ml-0.5 inline-block h-[1.1em] w-[2px] translate-y-[2px] bg-slate-600 dark:bg-slate-300"
              aria-hidden
            />
          )}
        </div>

        {!stillTyping && message.content && onReadAloudToggle && onReadAloudStop && (
          <ReadAloudControl
            messageId={message.id}
            content={message.content}
            status={readAloudStatus}
            activeMessageId={readAloudActiveId}
            onToggle={onReadAloudToggle}
            onStop={onReadAloudStop}
          />
        )}

        {research && !stillTyping && (
          <div className="space-y-3">
            {research.web_images?.length > 0 && (
              <div className="grid gap-3 sm:grid-cols-2">
                {research.web_images.map((image) => (
                  <a
                    key={image.image_url}
                    href={image.source_url || image.image_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group overflow-hidden rounded-xl border border-black/[0.06] bg-black/[0.02] transition-all hover:border-slate-400/40 dark:border-white/10 dark:bg-white/5"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={image.image_url}
                      alt={image.title}
                      className="h-36 w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                    />
                    <div className="space-y-1 p-3">
                      <p className="text-xs font-medium">{image.title}</p>
                      {image.caption && (
                        <p className="line-clamp-2 text-[11px] text-muted-foreground">
                          {image.caption}
                        </p>
                      )}
                    </div>
                  </a>
                ))}
              </div>
            )}

            <ResearchMetadataPanel research={research} onCitationClick={onCitationClick} />
          </div>
        )}
      </div>
    </div>
  );
}
