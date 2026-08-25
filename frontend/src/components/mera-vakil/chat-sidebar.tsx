"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  LogOut,
  MessageSquarePlus,
  Settings,
  Sparkles,
  Trash2,
} from "lucide-react";

import { ConfirmDialog } from "@/components/mera-vakil/confirm-dialog";
import { Button } from "@/components/ui/button";
import { clearSession, getStoredUser } from "@/lib/api";
import type { ChatConversation } from "@/lib/conversations";
import { cn } from "@/lib/utils";
import type { AuthUser } from "@/lib/types";

interface ChatSidebarProps {
  conversations: ChatConversation[];
  activeId: string | null;
  collapsed: boolean;
  onToggleCollapse: () => void;
  onNewChat: () => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
}

export function ChatSidebar({
  conversations,
  activeId,
  collapsed,
  onToggleCollapse,
  onNewChat,
  onSelect,
  onDelete,
}: ChatSidebarProps) {
  const router = useRouter();
  const user: AuthUser | null = getStoredUser();
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
          if (deleteTarget) onDelete(deleteTarget.id);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />

      <div className="glass-panel flex h-full min-h-0 flex-col overflow-hidden px-3 pb-3 pt-4">
        <div className="flex items-center gap-2.5 px-1 pb-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-slate-700 to-slate-900 text-white shadow-md shadow-slate-900/20 dark:from-slate-200 dark:to-slate-400 dark:text-slate-900">
            <Sparkles className="icon-breathe h-4 w-4" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold tracking-tight">Mera Vakil</p>
              <p className="truncate text-[11px] text-muted-foreground">AI Legal Counsel</p>
            </div>
          )}
        </div>

        <div className="pb-3">
          <Button
            size="sm"
            className={cn(
              "h-8 w-full gap-2 rounded-lg bg-gradient-to-r from-slate-800 to-slate-900 text-xs font-medium text-white shadow-sm transition-all hover:from-slate-700 hover:to-slate-800 hover:shadow-md dark:from-slate-100 dark:to-slate-300 dark:text-slate-900 dark:hover:from-white dark:hover:to-slate-200",
              collapsed && "px-0",
            )}
            onClick={onNewChat}
            aria-label="Start new chat"
          >
            <MessageSquarePlus className="h-3.5 w-3.5 shrink-0" />
            {!collapsed && <span>New Chat</span>}
          </Button>
        </div>

        <nav
          className="no-scrollbar -mx-1 flex-1 overflow-y-auto px-1"
          aria-label="Conversation history"
        >
          {!collapsed && (
            <p className="px-2 py-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              History
            </p>
          )}
          <ul className="space-y-0.5">
            {conversations.map((conv) => {
              const active = conv.id === activeId;
              return (
                <li key={conv.id}>
                  <div
                    className={cn(
                      "group flex items-center gap-2 rounded-lg px-2 py-1.5 transition-all duration-300 ease-in-out",
                      active
                        ? "bg-black/[0.05] shadow-sm dark:bg-white/10"
                        : "hover:bg-black/[0.03] dark:hover:bg-white/5",
                    )}
                  >
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                      onClick={() => onSelect(conv.id)}
                      aria-current={active ? "page" : undefined}
                    >
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-200/70 dark:bg-slate-700/40">
                        <Sparkles className="h-3.5 w-3.5 text-slate-600 dark:text-slate-300" />
                      </div>
                      {!collapsed && (
                        <span className="min-w-0 flex-1 truncate text-[13px]">{conv.title}</span>
                      )}
                      {!collapsed && (
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                      )}
                    </button>
                    {!collapsed && (
                      <button
                        type="button"
                        className="shrink-0 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-black/[0.05] hover:text-destructive group-hover:opacity-100 dark:hover:bg-white/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeleteTarget({ id: conv.id, title: conv.title });
                        }}
                        aria-label={`Delete conversation ${conv.title}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="space-y-1 pt-3">
          <Link
            href="/dashboard"
            className={cn(
              "flex items-center gap-2 rounded-xl px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-white/30 hover:text-foreground",
              collapsed && "justify-center px-0",
            )}
          >
            <ArrowLeft className="h-4 w-4 shrink-0" />
            {!collapsed && <span>Back to home</span>}
          </Link>

          {!collapsed && user && (
            <div className="flex items-center gap-2.5 rounded-xl bg-black/[0.03] px-2.5 py-2 dark:bg-white/5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-700 text-xs font-semibold text-white dark:bg-slate-200 dark:text-slate-900">
                {user.full_name?.charAt(0) ?? "?"}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{user.full_name}</p>
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              </div>
              <button
                type="button"
                className="rounded-lg p-1.5 text-muted-foreground hover:bg-white/40 hover:text-foreground"
                aria-label="Settings"
              >
                <Settings className="h-4 w-4" />
              </button>
            </div>
          )}

          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="sm"
              className={cn("flex-1 justify-start gap-2", collapsed && "justify-center px-0")}
              onClick={() => {
                clearSession();
                router.replace("/login");
              }}
            >
              <LogOut className="h-4 w-4" />
              {!collapsed && <span>Sign out</span>}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="px-2"
              onClick={onToggleCollapse}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
