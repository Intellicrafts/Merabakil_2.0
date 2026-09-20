"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronRight,
  MessageSquareText,
  MessageSquarePlus,
  Pencil,
  Pin,
  PinOff,
  Search,
  Trash2,
  X,
} from "lucide-react";

import { ProfileAvatar } from "@/components/auth/profile-avatar";
import { ConfirmDialog } from "@/components/mera-vakil/confirm-dialog";
import { getStoredUser } from "@/lib/api";
import { useTranslation } from "@/lib/i18n";
import { relativeTime, type ChatConversation } from "@/lib/conversations";
import { cn } from "@/lib/utils";

interface ContextPanelProps {
  conversations: ChatConversation[];
  activeId: string | null;
  onNewChat: () => void;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onRenameConversation?: (id: string, title: string) => void;
  onPinConversation?: (id: string) => void;
  onClose?: () => void;
  presentation?: "rail" | "drawer";
}

function IconButton({
  onClick,
  label,
  active,
  children,
}: {
  onClick: () => void;
  label: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors",
        "hover:bg-black/[0.04] hover:text-foreground dark:hover:bg-white/[0.08]",
        "md:h-8 md:w-8",
        active && "bg-black/[0.05] text-foreground dark:bg-white/10",
      )}
    >
      {children}
    </button>
  );
}

export function ContextPanel({
  conversations,
  activeId,
  onNewChat,
  onSelectConversation,
  onDeleteConversation,
  onRenameConversation,
  onPinConversation,
  onClose,
  presentation = "rail",
}: ContextPanelProps) {
  const user = getStoredUser();
  const { t } = useTranslation();
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(40);
  const searchRef = useRef<HTMLInputElement>(null);
  const drawer = presentation === "drawer";

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(query.trim().toLowerCase()), 150);
    return () => window.clearTimeout(t);
  }, [query]);

  useEffect(() => {
    if (!searchOpen) return;
    searchRef.current?.focus();
  }, [searchOpen]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "/" && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        setSearchOpen(true);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const filtered = useMemo(() => {
    if (!debounced) return conversations;
    return conversations.filter((c) => c.title.toLowerCase().includes(debounced));
  }, [conversations, debounced]);

  const shown = filtered.slice(0, visibleCount);

  return (
    <>
      <ConfirmDialog
        open={deleteTarget !== null}
        title={t("chat.deleteConversation")}
        description={
          deleteTarget
            ? `This will permanently remove "${deleteTarget.title.length > 60 ? `${deleteTarget.title.slice(0, 60)}…` : deleteTarget.title}". ${t("chat.deleteAreYouSure")}`
            : ""
        }
        confirmLabel={t("common.delete")}
        cancelLabel={t("common.cancel")}
        onConfirm={() => {
          if (deleteTarget) onDeleteConversation(deleteTarget.id);
          setDeleteTarget(null);
        }}
        onCancel={() => setDeleteTarget(null)}
      />

      <div
        className={cn(
          "counsel-rail relative flex h-full min-h-0 flex-col overflow-hidden",
          drawer && "counsel-rail-drawer",
        )}
      >
        {!drawer && <div className="counsel-rail-rule" />}

        <header
          className={cn(
            "mv-history-header relative shrink-0",
            drawer ? "px-4 pt-[max(1rem,env(safe-area-inset-top))]" : "px-3 pt-4",
          )}
        >
          <div className="mv-history-profile-row">
            <div className="mv-history-avatar-wrap">
              <ProfileAvatar
                src={user?.avatar_url}
                name={user?.full_name ?? "Guest"}
                className="h-10 w-10"
              />
              <span className="mv-history-avatar-status" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px] font-semibold tracking-tight text-foreground">
                {user?.full_name ?? "Guest"}
              </p>
              <p className="mt-0.5 truncate text-[10px] font-semibold uppercase tracking-[0.13em] text-muted-foreground">
                Conversation history
              </p>
            </div>
            <div className="mv-history-actions">
              <IconButton onClick={onNewChat} label={t("chat.newChat")}>
                <MessageSquarePlus className="h-[18px] w-[18px] md:h-4 md:w-4" strokeWidth={1.75} />
              </IconButton>
              <IconButton
                onClick={() => setSearchOpen((open) => !open)}
                label={t("chat.searchConversations")}
                active={searchOpen}
              >
                <Search className="h-[18px] w-[18px] md:h-4 md:w-4" strokeWidth={1.75} />
              </IconButton>
              {onClose && (
                <IconButton onClick={onClose} label={drawer ? "Close conversation history" : "Close panel"}>
                  {drawer ? <X className="h-[18px] w-[18px]" strokeWidth={1.75} /> : <ChevronRight className="h-4 w-4" />}
                </IconButton>
              )}
            </div>
          </div>

          {searchOpen && (
            <label className="mv-history-search relative mt-3 block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("common.search")}
                className="h-11 w-full rounded-md border border-black/[0.08] bg-white pl-9 pr-3 text-[13px] outline-none placeholder:text-muted-foreground/70 focus:border-slate-500 md:h-9 dark:border-white/10 dark:bg-white/[0.04]"
                aria-label={t("chat.searchConversations")}
              />
            </label>
          )}
          {!searchOpen && (
            <div className="mv-history-index" aria-label={`${filtered.length} conversations`}>
              <span className="flex items-center gap-2">
                <MessageSquareText className="h-3.5 w-3.5" strokeWidth={1.8} aria-hidden />
                All conversations
              </span>
              <span className="mv-history-count">{filtered.length}</span>
            </div>
          )}
        </header>

        <nav className="mv-history-list no-scrollbar relative min-h-0 flex-1 overflow-y-auto" aria-label="Conversation history">
          {shown.length === 0 ? (
            <div className="mv-history-empty">
              <span className="mv-history-empty-icon" aria-hidden>
                <MessageSquareText className="h-5 w-5" strokeWidth={1.6} />
              </span>
              <p>{debounced ? "No matching conversations" : "No conversations yet"}</p>
              {!debounced && <span>Start a new chat to keep your legal guidance organised here.</span>}
            </div>
          ) : (
            <ul className="mv-history-items">
              {shown.map((conv) => {
                const active = conv.id === activeId;
                const renaming = renameId === conv.id;
                return (
                  <li key={conv.id} className="mv-hist-row">
                    <div
                      className={cn(
                        "mv-conversation-row group relative flex min-h-12 items-center gap-2 border-l-2 py-1.5 pl-3 pr-1 transition-colors md:min-h-11",
                        active
                          ? "border-foreground/20 bg-black/[0.04] dark:border-white/15 dark:bg-white/[0.06]"
                          : "border-transparent hover:bg-black/[0.03] dark:hover:bg-white/[0.04]",
                      )}
                    >
                      {renaming ? (
                        <input
                          autoFocus
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onBlur={() => {
                            if (renameValue.trim()) onRenameConversation?.(conv.id, renameValue);
                            setRenameId(null);
                          }}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              if (renameValue.trim()) onRenameConversation?.(conv.id, renameValue);
                              setRenameId(null);
                            }
                            if (e.key === "Escape") setRenameId(null);
                          }}
                          className="h-8 w-full border border-black/10 bg-white px-2 text-[13px] dark:border-white/15 dark:bg-zinc-900"
                        />
                      ) : (
                        <button
                          type="button"
                          className="min-w-0 flex-1 text-left"
                          aria-current={active ? "page" : undefined}
                          onClick={() => onSelectConversation(conv.id)}
                        >
                          <span className="flex items-center gap-2">
                            <MessageSquareText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                            {conv.pinned && <Pin className="h-3 w-3 shrink-0 text-muted-foreground" />}
                            <span className="truncate text-[13px] font-medium">{conv.title}</span>
                          </span>
                          <span className="mt-0.5 block text-[11px] tabular-nums text-muted-foreground">
                            {relativeTime(conv.updatedAt)}
                          </span>
                        </button>
                      )}
                      <div className="flex shrink-0 opacity-100 md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
                        <button
                          type="button"
                          className="flex h-9 w-8 items-center justify-center text-muted-foreground hover:bg-white hover:text-foreground dark:hover:bg-white/10 md:h-7 md:w-6"
                          aria-label={conv.pinned ? "Unpin" : "Pin"}
                          onClick={(e) => {
                            e.stopPropagation();
                            onPinConversation?.(conv.id);
                          }}
                        >
                          {conv.pinned ? <PinOff className="h-3.5 w-3.5" /> : <Pin className="h-3.5 w-3.5" />}
                        </button>
                        <button
                          type="button"
                          className="flex h-9 w-8 items-center justify-center text-muted-foreground hover:bg-white hover:text-foreground dark:hover:bg-white/10 md:h-7 md:w-6"
                          aria-label={t("common.rename")}
                          onClick={(e) => {
                            e.stopPropagation();
                            setRenameId(conv.id);
                            setRenameValue(conv.title);
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          className="flex h-9 w-8 items-center justify-center text-muted-foreground hover:bg-white hover:text-destructive dark:hover:bg-white/10 md:h-7 md:w-6"
                          aria-label={`Delete ${conv.title}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget({ id: conv.id, title: conv.title });
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {filtered.length > shown.length && (
            <button
              type="button"
              className="mt-1 w-full py-2.5 text-center text-[12px] text-muted-foreground hover:text-foreground"
              onClick={() => setVisibleCount((n) => n + 40)}
            >
              {t("common.viewAll")}
            </button>
          )}
        </nav>

      </div>
    </>
  );
}
