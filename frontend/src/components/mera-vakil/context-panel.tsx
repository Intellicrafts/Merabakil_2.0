"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ChevronRight,
  FileText,
  LogOut,
  MessageSquarePlus,
  Sparkles,
  Trash2,
} from "lucide-react";

import { ConfirmDialog } from "@/components/mera-vakil/confirm-dialog";
import { LanguagePicker } from "@/components/mera-vakil/language-picker";
import { VoiceVisualizer } from "@/components/mera-vakil/voice-visualizer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { clearSession, getStoredUser } from "@/lib/api";
import type { ChatConversation } from "@/lib/conversations";
import type { ResearchResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ContextPanelProps {
  conversations: ChatConversation[];
  activeId: string | null;
  onNewChat: () => void;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  speechLocale: string;
  onSpeechLocaleChange: (code: string) => void;
  latestResearch: ResearchResponse | null;
  isSpeaking?: boolean;
  onClose?: () => void;
}

export function ContextPanel({
  conversations,
  activeId,
  onNewChat,
  onSelectConversation,
  onDeleteConversation,
  speechLocale,
  onSpeechLocaleChange,
  latestResearch,
  isSpeaking = false,
  onClose,
}: ContextPanelProps) {
  const router = useRouter();
  const user = getStoredUser();
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);

  return (
    <>
      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete conversation?"
        description={
          deleteTarget
            ? `This will permanently remove "${deleteTarget.title.length > 60 ? `${deleteTarget.title.slice(0, 60)}…` : deleteTarget.title}". This action cannot be undone.`
            : ""
        }
        confirmLabel="Delete"
        cancelLabel="Cancel"
        onConfirm={() => {
          if (deleteTarget) onDeleteConversation(deleteTarget.id);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />

      <div className="glass-panel relative flex h-full min-h-0 flex-col overflow-hidden">
        <div className="pointer-events-none absolute -right-10 top-0 h-32 w-32 rounded-full bg-slate-400/10 blur-3xl mv-panel-glow" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-px mp-shimmer-line" />

        {/* User profile header */}
        <div className="relative border-b border-black/[0.05] px-4 pb-4 pt-4 dark:border-white/[0.06]">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="mv-live-ping absolute inset-0 rounded-full bg-emerald-400 opacity-75" />
                <span className="relative h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Live session
              </p>
            </div>
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-black/[0.05] hover:text-foreground dark:hover:bg-white/10"
                aria-label="Close panel"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="mv-avatar-ring absolute -inset-1 rounded-full opacity-60" />
              <div className="relative flex h-11 w-11 items-center justify-center rounded-full bg-gradient-to-br from-slate-700 to-slate-900 text-sm font-semibold text-white shadow-md dark:from-slate-100 dark:to-slate-300 dark:text-slate-900">
                {user?.full_name?.charAt(0) ?? "?"}
              </div>
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold tracking-tight">
                {user?.full_name ?? "Guest"}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                {user?.email ?? "Signed in"}
              </p>
              {user?.roles?.[0] && (
                <p className="mt-0.5 text-[10px] font-medium capitalize text-muted-foreground/80">
                  {user.roles[0].replace("_", " ")}
                </p>
              )}
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="mt-3 min-h-10 w-full rounded-xl border-black/[0.08] bg-white/50 dark:border-white/10 dark:bg-white/[0.04]"
            onClick={() => {
              clearSession();
              router.replace("/login");
            }}
          >
            <LogOut className="mr-2 h-3.5 w-3.5" />
            Sign out
          </Button>
        </div>

        <div className="no-scrollbar relative flex-1 space-y-5 overflow-y-auto px-4 py-4">
          {/* Read aloud */}
          <section aria-label="Voice and read-aloud language" className="space-y-2.5">
            <div className="flex items-center gap-2">
              <span className="mv-section-dot" />
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                Read aloud
              </p>
            </div>
            <LanguagePicker value={speechLocale} onChange={onSpeechLocaleChange} />
            <VoiceVisualizer isActive={isSpeaking} />
          </section>

          {/* Chat history */}
          <section aria-label="Conversation history" className="space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="mv-section-dot" />
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Chat history
                </p>
              </div>
              <Button
                size="sm"
                onClick={onNewChat}
                className="h-8 gap-1.5 rounded-full bg-gradient-to-r from-slate-800 to-slate-900 px-3 text-[11px] font-medium text-white dark:from-slate-100 dark:to-slate-300 dark:text-slate-900"
              >
                <MessageSquarePlus className="h-3.5 w-3.5" />
                New
              </Button>
            </div>

            <nav className="space-y-1">
              {conversations.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-black/[0.08] px-3 py-6 text-center dark:border-white/10">
                  <Sparkles className="mx-auto mb-2 h-5 w-5 text-muted-foreground/40" />
                  <p className="text-[12px] text-muted-foreground">No conversations yet</p>
                </div>
              ) : (
                <ul className="space-y-1">
                  {conversations.map((conv, idx) => {
                    const active = conv.id === activeId;
                    return (
                      <li
                        key={conv.id}
                        style={{ animationDelay: `${Math.min(idx, 8) * 40}ms` }}
                        className="mv-hist-item"
                      >
                        <div
                          className={cn(
                            "group flex items-center gap-2 rounded-xl px-2 py-2 transition-all duration-200",
                            active
                              ? "bg-slate-900/90 text-white shadow-md dark:bg-white/90 dark:text-slate-900"
                              : "bg-white/40 hover:bg-white/70 dark:bg-white/[0.04] dark:hover:bg-white/[0.08]",
                          )}
                        >
                          <button
                            type="button"
                            className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                            onClick={() => onSelectConversation(conv.id)}
                            aria-current={active ? "page" : undefined}
                          >
                            <span
                              className={cn(
                                "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
                                active
                                  ? "bg-white/15 dark:bg-black/10"
                                  : "bg-black/[0.04] dark:bg-white/[0.06]",
                              )}
                            >
                              <Sparkles className="h-3.5 w-3.5" />
                            </span>
                            <span className="min-w-0 flex-1 truncate text-[12px] font-medium">
                              {conv.title}
                            </span>
                          </button>
                          <button
                            type="button"
                            className={cn(
                              "shrink-0 rounded-md p-1 opacity-0 transition-opacity group-hover:opacity-100",
                              active
                                ? "text-white/70 hover:bg-white/10 hover:text-white dark:text-slate-700 dark:hover:bg-black/10"
                                : "text-muted-foreground hover:bg-black/[0.05] hover:text-destructive dark:hover:bg-white/10",
                            )}
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget({ id: conv.id, title: conv.title });
                            }}
                            aria-label={`Delete ${conv.title}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </nav>
          </section>

          {/* Live intelligence — sources */}
          {latestResearch && latestResearch.sources.length > 0 && (
            <section aria-label="Live sources" className="space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="mv-section-dot" />
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Live sources
                </p>
                <Badge variant="secondary" className="rounded-full text-[10px]">
                  {latestResearch.sources.length}
                </Badge>
              </div>
              <ul className="space-y-1.5">
                {latestResearch.sources.slice(0, 4).map((source, idx) => (
                  <li
                    key={source.chunk_id}
                    className="mv-insight-card rounded-xl border border-black/[0.05] bg-white/50 p-2.5 dark:border-white/[0.06] dark:bg-white/[0.04]"
                  >
                    <div className="flex items-start gap-2">
                      <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
                      <div className="min-w-0">
                        <p className="truncate text-[11px] font-medium">
                          [{idx + 1}] {source.title ?? source.document_id}
                        </p>
                        <p className="mt-0.5 line-clamp-2 text-[10px] text-muted-foreground">
                          {source.content}
                        </p>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {latestResearch && latestResearch.trace.length > 0 && (
            <section aria-label="Agent activity" className="space-y-2.5">
              <div className="flex items-center gap-2">
                <span className="mv-section-dot" />
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  Agent activity
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {latestResearch.trace.map((step, idx) => (
                  <Badge
                    key={`${step}-${idx}`}
                    variant="secondary"
                    className="mv-trace-chip rounded-full text-[10px]"
                    style={{ animationDelay: `${idx * 60}ms` }}
                  >
                    {step}
                  </Badge>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
