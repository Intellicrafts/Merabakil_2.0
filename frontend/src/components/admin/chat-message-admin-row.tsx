"use client";

import { useState } from "react";
import { Pencil, Trash2, X } from "lucide-react";

import { MessageBubble } from "@/components/mera-vakil/message-bubble";
import { Button } from "@/components/ui/button";
import type { ChatMessage } from "@/lib/conversations";
import { cn } from "@/lib/utils";

interface ChatMessageAdminRowProps {
  message: ChatMessage;
  onSave: (messageId: string, content: string) => void;
  onDelete: (messageId: string) => void;
  disabled?: boolean;
}

export function ChatMessageAdminRow({
  message,
  onSave,
  onDelete,
  disabled,
}: ChatMessageAdminRowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(message.content);

  const handleSave = () => {
    onSave(message.id, draft.trim());
    setEditing(false);
  };

  const handleCancel = () => {
    setDraft(message.content);
    setEditing(false);
  };

  return (
    <div className="group relative rounded-2xl border border-black/[0.06] bg-black/[0.01] p-3 dark:border-white/10 dark:bg-white/[0.02]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
            message.role === "user"
              ? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200"
              : "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
          )}
        >
          {message.role}
        </span>
        <div className="flex items-center gap-1 opacity-100 transition md:opacity-0 md:group-hover:opacity-100">
          {!editing ? (
            <>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0"
                disabled={disabled}
                onClick={() => setEditing(true)}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-rose-600 hover:text-rose-700"
                disabled={disabled}
                onClick={() => onDelete(message.id)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </>
          ) : (
            <>
              <Button type="button" size="sm" disabled={disabled || !draft.trim()} onClick={handleSave}>
                Save
              </Button>
              <Button type="button" variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={handleCancel}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </>
          )}
        </div>
      </div>

      {editing ? (
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={4}
          className="w-full rounded-xl border border-black/[0.08] bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-zinc-950"
        />
      ) : (
        <MessageBubble message={message} />
      )}
    </div>
  );
}
