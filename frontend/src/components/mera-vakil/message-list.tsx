"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown } from "lucide-react";

import { FollowUpSuggestions } from "@/components/mera-vakil/follow-up-suggestions";
import { ImageLightboxHost } from "@/components/mera-vakil/image-gallery";
import { MessageBubble } from "@/components/mera-vakil/message-bubble";
import { ThinkingLoader } from "@/components/mera-vakil/thinking-loader";
import type { ReadAloudStatus } from "@/hooks/use-read-aloud";
import type { ChatMessage } from "@/lib/conversations";
import { useTranslation } from "@/lib/i18n";

/** Within this many px of the bottom counts as "following along". */
const STICK_THRESHOLD_PX = 96;

interface MessageListProps {
  messages: ChatMessage[];
  isPending: boolean;
  pendingMessage?: string;
  streamingMessageId: string | null;
  isGenerating?: boolean;
  editingMessageId: string | null;
  onCitationClick?: (marker: string) => void;
  onSuggestionSelect?: (prompt: string) => void;
  onStartEdit?: (messageId: string) => void;
  onCancelEdit?: () => void;
  onResendEdit?: (messageId: string, newContent: string) => void;
  groundingMessageId?: string | null;
  readAloudStatus?: ReadAloudStatus;
  readAloudActiveId?: string | null;
  onReadAloudToggle?: (messageId: string, content: string) => void;
  onReadAloudStop?: () => void;
  caseId?: string | null;
  onRetry?: (messageId: string) => void;
}

export function MessageList({
  messages,
  isPending,
  pendingMessage,
  streamingMessageId,
  isGenerating,
  editingMessageId,
  onCitationClick,
  onSuggestionSelect,
  onStartEdit,
  onCancelEdit,
  onResendEdit,
  groundingMessageId,
  readAloudStatus,
  readAloudActiveId,
  onReadAloudToggle,
  onReadAloudStop,
  caseId,
  onRetry,
}: MessageListProps) {
  const { t } = useTranslation();
  const scrollRef = useRef<HTMLDivElement>(null);
  // Follow new text only while the reader is at the bottom; scrolling up pauses it.
  const stickRef = useRef(true);
  const [showJump, setShowJump] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const prevStreamingRef = useRef<string | null>(null);
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");

  const streamingRevealChars = useMemo(() => {
    if (!streamingMessageId) return 0;
    const streaming = messages.find((m) => m.id === streamingMessageId);
    return streaming?.revealedChars ?? streaming?.content.length ?? 0;
  }, [messages, streamingMessageId]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior) => {
    const container = scrollRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior });
  }, []);

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    const onScroll = () => {
      const distance = container.scrollHeight - container.scrollTop - container.clientHeight;
      stickRef.current = distance <= STICK_THRESHOLD_PX;
      setShowJump(!stickRef.current);
    };
    container.addEventListener("scroll", onScroll, { passive: true });
    return () => container.removeEventListener("scroll", onScroll);
  }, []);

  // Sending a new question always brings the thread back to the bottom (the
  // answer placeholder is appended with it, so key on the latest *user* message).
  const lastUserId = useMemo(() => {
    for (let i = messages.length - 1; i >= 0; i--) if (messages[i].role === "user") return messages[i].id;
    return null;
  }, [messages]);
  const seenUserIdRef = useRef<string | null>(lastUserId);
  useEffect(() => {
    if (!lastUserId || lastUserId === seenUserIdRef.current) return;
    seenUserIdRef.current = lastUserId;
    stickRef.current = true;
    setShowJump(false);
    scrollToBottom("smooth");
  }, [lastUserId, scrollToBottom]);

  useEffect(() => {
    if (!stickRef.current) return;
    scrollToBottom(isGenerating || streamingMessageId ? "auto" : "smooth");
  }, [messages, isPending, streamingMessageId, isGenerating, streamingRevealChars, scrollToBottom]);

  // Keep the latest message in view when the container resizes (mobile keyboard).
  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    let raf: number | null = null;
    const observer = new ResizeObserver(() => {
      if (!stickRef.current) return;
      if (raf != null) cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        raf = null;
        container.scrollTo({ top: container.scrollHeight, behavior: "instant" });
      });
    });
    observer.observe(container);
    return () => {
      observer.disconnect();
      if (raf != null) cancelAnimationFrame(raf);
    };
  }, []);

  // Screen readers: announce once when an answer finishes (not every token).
  useEffect(() => {
    if (prevStreamingRef.current && !streamingMessageId) setAnnouncement(t("chat.answerReady"));
    prevStreamingRef.current = streamingMessageId;
  }, [streamingMessageId, t]);

  const showSuggestions =
    !isPending &&
    !streamingMessageId &&
    lastAssistant?.research?.suggestions &&
    lastAssistant.research.suggestions.length > 0;

  const visibleMessages = useMemo(
    () =>
      messages.filter(
        (m) => !(m.role === "assistant" && !m.content && !m.error && m.id !== streamingMessageId),
      ),
    [messages, streamingMessageId],
  );

  const regenerateUserByAssistantId = useMemo(() => {
    const map = new Map<string, string>();
    let lastUserId: string | null = null;
    for (const msg of visibleMessages) {
      if (msg.role === "user") lastUserId = msg.id;
      else if (msg.role === "assistant" && lastUserId) map.set(msg.id, lastUserId);
    }
    return map;
  }, [visibleMessages]);

  const questionByAssistantId = useMemo(() => {
    const map = new Map<string, string>();
    let lastUser: string | null = null;
    for (const msg of visibleMessages) {
      if (msg.role === "user") lastUser = msg.content;
      else if (msg.role === "assistant" && lastUser) map.set(msg.id, lastUser);
    }
    return map;
  }, [visibleMessages]);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col">
    <div
      ref={scrollRef}
      data-chat-thread
      role="log"
      aria-live="off"
      className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-8 md:px-6"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        {visibleMessages.map((msg) => {
          const prevUserId = regenerateUserByAssistantId.get(msg.id);
          return (
            <MessageBubble
              key={msg.id}
              message={msg}
              isTyping={msg.id === streamingMessageId}
              isEditing={msg.id === editingMessageId}
              isPending={isPending}
              grounding={msg.id === groundingMessageId}
              onCitationClick={onCitationClick}
              onStartEdit={msg.role === "user" ? onStartEdit : undefined}
              onCancelEdit={onCancelEdit}
              onResendEdit={onResendEdit}
              readAloudStatus={readAloudStatus}
              readAloudActiveId={readAloudActiveId}
              onReadAloudToggle={onReadAloudToggle}
              onReadAloudStop={onReadAloudStop}
              caseId={caseId}
              onRetry={onRetry}
              question={questionByAssistantId.get(msg.id)}
              streamingStatus={
                msg.id === streamingMessageId && !msg.content ? pendingMessage : undefined
              }
            />
          );
        })}
        {isPending && <ThinkingLoader message={pendingMessage} />}
        {showSuggestions && lastAssistant?.research && (
          <FollowUpSuggestions
            suggestions={lastAssistant.research.suggestions}
            onSelect={(prompt) => onSuggestionSelect?.(prompt)}
            disabled={isPending || Boolean(streamingMessageId)}
          />
        )}
      </div>
      <ImageLightboxHost />
    </div>
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
      {showJump && (
        <button
          type="button"
          onClick={() => {
            stickRef.current = true;
            setShowJump(false);
            scrollToBottom("smooth");
          }}
          className="absolute bottom-3 left-1/2 z-10 inline-flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-black/[0.08] bg-background/95 px-3 py-1.5 text-xs font-medium text-foreground shadow-md backdrop-blur-sm transition-colors hover:bg-muted dark:border-white/10"
        >
          <ArrowDown className="h-3.5 w-3.5" aria-hidden />
          {t("chat.jumpToLatest")}
        </button>
      )}
    </div>
  );
}
