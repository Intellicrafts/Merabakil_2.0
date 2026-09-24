"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, MessageSquare, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { adminListUserConversations } from "@/lib/api";
import { CLARITY_MASK } from "@/lib/analytics/clarity-mask";
import type { AdminChatUserSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ChatUserPanelProps {
  user: AdminChatUserSummary | null;
  open: boolean;
  onClose: () => void;
  onSelectConversation: (conversationId: string) => void;
}

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function UserInitials({ name }: { name: string }) {
  const parts = name.trim().split(" ");
  const initials = parts.length >= 2
    ? `${parts[0][0]}${parts[parts.length - 1][0]}`
    : name.slice(0, 2);
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-violet-700 text-[13px] font-semibold text-white dark:bg-violet-400 dark:text-violet-950">
      {initials.toUpperCase()}
    </div>
  );
}

export function ChatUserPanel({ user, open, onClose, onSelectConversation }: ChatUserPanelProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const { data: conversations, isLoading } = useQuery({
    queryKey: ["admin-chat-user", user?.userId],
    queryFn: () => adminListUserConversations(user!.userId),
    enabled: open && !!user,
  });

  if (!mounted || !open || !user) return null;

  return createPortal(
    <div className="fixed inset-0 z-[85] flex items-end justify-center sm:items-stretch sm:justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        aria-label="Close"
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative z-[86] flex w-full flex-col bg-white",
          "max-h-[92vh] rounded-t-[1.6rem] border border-black/[0.08] shadow-[0_-12px_60px_rgba(15,23,42,0.18)]",
          "dark:border-white/10 dark:bg-[hsl(220_14%_9%)]",
          "sm:h-full sm:max-h-none sm:max-w-[480px] sm:rounded-none sm:border-l sm:shadow-[0_0_80px_rgba(15,23,42,0.18)]",
        )}
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-black/15 sm:hidden dark:bg-white/20" />

        <div className="flex items-center justify-between border-b border-black/[0.06] px-5 py-4 dark:border-white/[0.08]">
          <p className="text-xs font-semibold text-muted-foreground">User conversations</p>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-black/[0.06] dark:hover:bg-white/[0.08]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-black/[0.06] px-5 py-4 dark:border-white/[0.08]">
          <div className="flex items-start gap-3">
            <UserInitials name={user.fullName} />
            <div {...CLARITY_MASK} className="min-w-0 flex-1">
              <h2 className="text-lg font-semibold tracking-tight">{user.fullName}</h2>
              <p className="text-sm text-muted-foreground">{user.email}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {user.roles.map((role) => (
                  <Badge key={role} variant="secondary">{role}</Badge>
                ))}
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                {user.conversationCount} conversations · {user.totalMessages} messages · Last active {formatDate(user.lastActivity)}
              </p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-3">
          {isLoading ? (
            <div className="space-y-2 px-2">
              <Skeleton className="h-14 w-full" />
              <Skeleton className="h-14 w-full" />
            </div>
          ) : !conversations?.length ? (
            <p className="px-2 py-6 text-center text-sm text-muted-foreground">No conversations found.</p>
          ) : (
            <ul className="space-y-1">
              {conversations.map((conv) => (
                <li key={conv.id}>
                  <button
                    type="button"
                    onClick={() => onSelectConversation(conv.id)}
                    className="flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                  >
                    <MessageSquare className="h-4 w-4 shrink-0 text-violet-600 dark:text-violet-400" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{conv.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {conv.messageCount} messages · {formatDate(conv.updatedAt)}
                        {conv.pinned ? " · Pinned" : ""}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
    </div>,
    document.body,
  );
}
