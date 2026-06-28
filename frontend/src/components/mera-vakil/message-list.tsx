"use client";

import { useEffect, useRef } from "react";

import { FollowUpSuggestions } from "@/components/mera-vakil/follow-up-suggestions";
import { MessageBubble } from "@/components/mera-vakil/message-bubble";
import { ThinkingLoader } from "@/components/mera-vakil/thinking-loader";
import type { ReadAloudStatus } from "@/hooks/use-read-aloud";
import type { ChatMessage } from "@/lib/conversations";

interface MessageListProps {
  messages: ChatMessage[];
  isPending: boolean;
  typingMessageId: string | null;
  editingMessageId: string | null;
  onCitationClick?: (marker: string) => void;
  onSuggestionSelect?: (prompt: string) => void;
  onStartEdit?: (messageId: string) => void;
  onCancelEdit?: () => void;
  onResendEdit?: (messageId: string, newContent: string) => void;
  readAloudStatus?: ReadAloudStatus;
  readAloudActiveId?: string | null;
  onReadAloudToggle?: (messageId: string, content: string) => void;
  onReadAloudStop?: () => void;
}

export function MessageList({
  messages,
  isPending,
  typingMessageId,
  editingMessageId,
  onCitationClick,
  onSuggestionSelect,
  onStartEdit,
  onCancelEdit,
  onResendEdit,
  readAloudStatus,
  readAloudActiveId,
  onReadAloudToggle,
  onReadAloudStop,
}: MessageListProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastAssistant = [...messages].reverse().find((m) => m.role === "assistant");

  useEffect(() => {
    const container = scrollRef.current;
    if (!container) return;
    container.scrollTo({ top: container.scrollHeight, behavior: "smooth" });
  }, [messages, isPending, typingMessageId]);

  const showSuggestions =
    !isPending &&
    !typingMessageId &&
    lastAssistant?.research?.suggestions &&
    lastAssistant.research.suggestions.length > 0;

  return (
    <div
      ref={scrollRef}
      className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-8 md:px-6"
    >
      <div className="mx-auto flex max-w-3xl flex-col gap-8">
        {messages.map((msg) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            isTyping={msg.id === typingMessageId}
            isEditing={msg.id === editingMessageId}
            isPending={isPending}
            onCitationClick={onCitationClick}
            onStartEdit={msg.role === "user" ? onStartEdit : undefined}
            onCancelEdit={onCancelEdit}
            onResendEdit={onResendEdit}
            readAloudStatus={readAloudStatus}
            readAloudActiveId={readAloudActiveId}
            onReadAloudToggle={onReadAloudToggle}
            onReadAloudStop={onReadAloudStop}
          />
        ))}
        {isPending && <ThinkingLoader />}
        {showSuggestions && lastAssistant?.research && (
          <FollowUpSuggestions
            suggestions={lastAssistant.research.suggestions}
            onSelect={(prompt) => onSuggestionSelect?.(prompt)}
            disabled={isPending}
          />
        )}
      </div>
    </div>
  );
}
