"use client";

import { useEffect, useRef, useState } from "react";
import { BookText, ChevronDown, Pencil, Sparkles, X } from "lucide-react";

import { Markdown } from "@/components/mera-vakil/markdown";
import { ReadAloudControl } from "@/components/mera-vakil/read-aloud-control";
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

function confidenceTone(value: number): string {
  if (value >= 0.66) return "text-emerald-600 dark:text-emerald-400";
  if (value >= 0.33) return "text-amber-600 dark:text-amber-400";
  return "text-rose-600 dark:text-rose-400";
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
  const [sourcesOpen, setSourcesOpen] = useState(false);
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
  const revealed = message.revealedChars ?? message.content.length;
  const displayContent = isTyping ? message.content.slice(0, revealed) : message.content;
  const stillTyping = isTyping && revealed < message.content.length;

  return (
    <div className="group flex gap-3">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-slate-700 to-slate-900 text-white shadow-sm dark:from-slate-200 dark:to-slate-400 dark:text-slate-900">
        <Sparkles className="icon-breathe h-3.5 w-3.5" />
      </div>

      <div className="min-w-0 flex-1 space-y-3 pt-0.5">
        <div className="text-[13.5px] leading-7 text-foreground/90">
          <Markdown content={displayContent} onCitationClick={onCitationClick} />
          {stillTyping && (
            <span className="ml-0.5 inline-block h-4 w-[2px] translate-y-0.5 animate-pulse rounded-full bg-slate-500" aria-hidden />
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
                        <p className="line-clamp-2 text-[11px] text-muted-foreground">{image.caption}</p>
                      )}
                    </div>
                  </a>
                ))}
              </div>
            )}

            {(research.sources.length > 0 || research.confidence.overall > 0) && (
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5">
                  <span className={cn("font-semibold", confidenceTone(research.confidence.overall))}>
                    {Math.round(research.confidence.overall * 100)}%
                  </span>
                  confidence
                </span>
                <span className="capitalize">{research.intent.replace(/_/g, " ")}</span>
                <span className="capitalize">
                  {research.jurisdiction.level}
                  {research.jurisdiction.region ? ` · ${research.jurisdiction.region}` : ""}
                </span>
                {research.web_sources?.length > 0 && (
                  <span className="text-slate-600 dark:text-slate-300">Web supplemented</span>
                )}
              </div>
            )}

            {research.citations.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {research.citations.map((cite) => (
                  <button
                    key={`${cite.marker}-${cite.document_id}`}
                    type="button"
                    className="inline-flex items-center gap-1 rounded-full border border-black/[0.08] bg-black/[0.03] px-2.5 py-1 text-xs text-slate-700 transition-colors hover:bg-black/[0.06] dark:border-white/10 dark:bg-white/5 dark:text-slate-300"
                    onClick={() => onCitationClick?.(cite.marker)}
                    aria-label={`Citation ${cite.marker}: ${cite.title ?? cite.document_id}`}
                  >
                    <span className="font-medium">{cite.marker}</span>
                    <span className="max-w-[180px] truncate">{cite.title ?? cite.document_id}</span>
                  </button>
                ))}
              </div>
            )}

            {research.sources.length > 0 && (
              <div>
                <button
                  type="button"
                  className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
                  onClick={() => setSourcesOpen((o) => !o)}
                  aria-expanded={sourcesOpen}
                >
                  <BookText className="h-3.5 w-3.5" />
                  {research.sources.length} sources
                  <ChevronDown
                    className={cn("h-3.5 w-3.5 transition-transform", sourcesOpen && "rotate-180")}
                  />
                </button>
                {sourcesOpen && (
                  <div className="mt-2 space-y-2 border-l-2 border-slate-300/60 pl-4 dark:border-slate-600/40">
                    {research.sources.map((source, idx) => (
                      <div key={source.chunk_id} id={`source-${idx + 1}`} className="text-xs">
                        <p className="font-medium text-foreground/80">
                          [{idx + 1}] {source.title ?? source.document_id}
                          <span className="ml-2 font-normal text-muted-foreground">
                            {source.score.toFixed(2)} · {source.retrieval}
                          </span>
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-muted-foreground">{source.content}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <p className="text-xs italic leading-relaxed text-muted-foreground/70">
              {research.disclaimer}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
