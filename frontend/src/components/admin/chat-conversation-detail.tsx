"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, X } from "lucide-react";

import { ChatConversationControls } from "@/components/admin/chat-conversation-controls";
import { ChatMessageAdminRow } from "@/components/admin/chat-message-admin-row";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import {
  adminDeleteConversation,
  adminGetConversation,
  adminUpdateConversation,
} from "@/lib/api";
import { CLARITY_MASK } from "@/lib/analytics/clarity-mask";
import type { MatterType } from "@/lib/conversations";
import type { AdminConversationDetail } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ChatConversationDetailProps {
  conversationId: string | null;
  open: boolean;
  onClose: () => void;
  onDeleted?: () => void;
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

export function ChatConversationDetail({
  conversationId,
  open,
  onClose,
  onDeleted,
}: ChatConversationDetailProps) {
  const [mounted, setMounted] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [jurisdiction, setJurisdiction] = useState("");
  const [matterType, setMatterType] = useState<MatterType>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

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

  const { data: conversation, isLoading } = useQuery({
    queryKey: ["admin-chat-conversation", conversationId],
    queryFn: () => adminGetConversation(conversationId!),
    enabled: open && !!conversationId,
  });

  useEffect(() => {
    if (!conversation) return;
    setTitleDraft(conversation.title);
    setJurisdiction(conversation.jurisdiction ?? "");
    setMatterType((conversation.matterType as MatterType) ?? null);
  }, [conversation]);

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-chat-stats"] });
    queryClient.invalidateQueries({ queryKey: ["admin-chat-users"] });
    queryClient.invalidateQueries({ queryKey: ["admin-chat-conversations"] });
    if (conversation?.userId) {
      queryClient.invalidateQueries({ queryKey: ["admin-chat-user", conversation.userId] });
    }
    queryClient.invalidateQueries({ queryKey: ["admin-chat-conversation", conversationId] });
  };

  const updateMutation = useMutation({
    mutationFn: (body: Parameters<typeof adminUpdateConversation>[1]) =>
      adminUpdateConversation(conversationId!, body),
    onSuccess: () => {
      toast({ title: "Conversation updated" });
      invalidateAll();
    },
    onError: (e: Error) => {
      toast({ title: "Update failed", description: e.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => adminDeleteConversation(conversationId!),
    onSuccess: () => {
      toast({ title: "Conversation deleted" });
      invalidateAll();
      onDeleted?.();
      onClose();
    },
    onError: (e: Error) => {
      toast({ title: "Delete failed", description: e.message, variant: "destructive" });
    },
  });

  const patchMessages = (messages: AdminConversationDetail["messages"]) => {
    updateMutation.mutate({ messages });
  };

  const handleSaveMetadata = () => {
    updateMutation.mutate({
      title: titleDraft.trim() || "New Chat",
      jurisdiction: jurisdiction || null,
      matter_type: matterType,
    });
  };

  const handleTogglePin = () => {
    updateMutation.mutate({ pinned: !conversation?.pinned });
  };

  const handleExport = () => {
    if (!conversation) return;
    const blob = new Blob([JSON.stringify(conversation, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `saarthi-${conversation.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDeleteConversation = () => {
    if (!window.confirm("Delete this conversation permanently?")) return;
    deleteMutation.mutate();
  };

  if (!mounted || !open || !conversationId) return null;

  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center sm:items-stretch sm:justify-end">
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
          "relative z-[91] flex w-full flex-col bg-white",
          "max-h-[92vh] rounded-t-[1.6rem] border border-black/[0.08] shadow-[0_-12px_60px_rgba(15,23,42,0.18)]",
          "dark:border-white/10 dark:bg-[hsl(220_14%_9%)]",
          "sm:h-full sm:max-h-none sm:max-w-[640px] sm:rounded-none sm:border-l sm:shadow-[0_0_80px_rgba(15,23,42,0.18)]",
        )}
      >
        <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-black/15 sm:hidden dark:bg-white/20" />

        <div className="flex items-center justify-between border-b border-black/[0.06] px-5 py-4 dark:border-white/[0.08]">
          <p className="text-xs font-semibold text-muted-foreground">Conversation detail</p>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-black/[0.06] dark:hover:bg-white/[0.08]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          {isLoading || !conversation ? (
            <div className="space-y-3">
              <Skeleton className="h-8 w-2/3" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          ) : (
            <div className="space-y-5">
              <div {...CLARITY_MASK}>
                <h2 className="text-lg font-semibold tracking-tight">{conversation.title}</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {conversation.user.fullName} · {conversation.user.email}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {conversation.user.roles.map((role) => (
                    <Badge key={role} variant="secondary">{role}</Badge>
                  ))}
                  <span className="text-xs text-muted-foreground">
                    Updated {formatDate(conversation.updatedAt)}
                  </span>
                </div>
                <Link
                  href={`/admin/users?search=${encodeURIComponent(conversation.user.email)}`}
                  className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  View in User Management
                  <ExternalLink className="h-3 w-3" />
                </Link>
              </div>

              <ChatConversationControls
                conversation={conversation}
                titleDraft={titleDraft}
                onTitleChange={setTitleDraft}
                jurisdiction={jurisdiction}
                onJurisdictionChange={setJurisdiction}
                matterType={matterType}
                onMatterTypeChange={setMatterType}
                onSaveMetadata={handleSaveMetadata}
                onTogglePin={handleTogglePin}
                onDelete={handleDeleteConversation}
                onExport={handleExport}
                saving={updateMutation.isPending}
                deleting={deleteMutation.isPending}
              />

              <div className="space-y-3">
                <h3 className="text-sm font-semibold">Transcript ({conversation.messages.length})</h3>
                {conversation.messages.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No messages in this conversation.</p>
                ) : (
                  conversation.messages.map((msg) => (
                    <ChatMessageAdminRow
                      key={msg.id}
                      message={msg}
                      disabled={updateMutation.isPending}
                      onSave={(messageId, content) => {
                        patchMessages(
                          conversation.messages.map((m) =>
                            m.id === messageId ? { ...m, content } : m,
                          ),
                        );
                      }}
                      onDelete={(messageId) => {
                        if (!window.confirm("Delete this message?")) return;
                        patchMessages(conversation.messages.filter((m) => m.id !== messageId));
                      }}
                    />
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </aside>
    </div>,
    document.body,
  );
}
