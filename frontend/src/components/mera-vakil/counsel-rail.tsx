"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Building2,
  ChevronRight,
  FileText,
  Landmark,
  LogOut,
  MessageSquarePlus,
  MoreHorizontal,
  Pencil,
  Pin,
  PinOff,
  Scale,
  Search,
  ShieldAlert,
  Trash2,
  Users,
  X,
} from "lucide-react";

import { ConfirmDialog } from "@/components/mera-vakil/confirm-dialog";
import { LanguagePicker } from "@/components/mera-vakil/language-picker";
import { clearSession, getStoredUser } from "@/lib/api";
import {
  JURISDICTION_OPTIONS,
  MATTER_TYPES,
  relativeTime,
  type ChatConversation,
  type MatterType,
} from "@/lib/conversations";
import type { ResearchResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

const MATTER_ICONS = {
  fir: ShieldAlert,
  bail: Scale,
  contract: FileText,
  property: Building2,
  family: Users,
  constitutional: Landmark,
} as const;

interface ContextPanelProps {
  conversations: ChatConversation[];
  activeId: string | null;
  activeConversation?: ChatConversation | null;
  onNewChat: () => void;
  onSelectConversation: (id: string) => void;
  onDeleteConversation: (id: string) => void;
  onRenameConversation?: (id: string, title: string) => void;
  onPinConversation?: (id: string) => void;
  onMatterTypeChange?: (type: MatterType) => void;
  onJurisdictionChange?: (value: string) => void;
  onQuickAction?: (prompt: string) => void;
  speechLocale: string;
  onSpeechLocaleChange: (code: string) => void;
  latestResearch: ResearchResponse | null;
  isSpeaking?: boolean;
  onClose?: () => void;
  presentation?: "rail" | "sheet";
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
        "flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors",
        "hover:bg-black/[0.05] hover:text-foreground dark:hover:bg-white/10",
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
  activeConversation,
  onNewChat,
  onSelectConversation,
  onDeleteConversation,
  onRenameConversation,
  onPinConversation,
  onMatterTypeChange,
  onJurisdictionChange,
  speechLocale,
  onSpeechLocaleChange,
  onClose,
  presentation = "rail",
}: ContextPanelProps) {
  const router = useRouter();
  const user = getStoredUser();
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(40);
  const searchRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const sheet = presentation === "sheet";

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

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    if (menuOpen) {
      document.addEventListener("mousedown", onDoc);
      document.addEventListener("keydown", onKey);
    }
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const filtered = useMemo(() => {
    if (!debounced) return conversations;
    return conversations.filter((c) => c.title.toLowerCase().includes(debounced));
  }, [conversations, debounced]);

  const shown = filtered.slice(0, visibleCount);

  function signOut() {
    clearSession();
    router.replace("/login");
  }

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

      <div
        className={cn(
          "counsel-rail relative flex h-full min-h-0 flex-col overflow-hidden",
          sheet && "counsel-rail-sheet",
        )}
      >
        {!sheet && <div className="counsel-rail-rule" />}

        {sheet && (
          <div className="flex shrink-0 justify-center pb-1 pt-2.5" aria-hidden>
            <span className="h-1 w-10 rounded-full bg-black/15 dark:bg-white/20" />
          </div>
        )}

        <div
          className={cn(
            "relative shrink-0 px-3 pb-3",
            sheet ? "pt-1" : "pt-4",
            "border-b border-black/[0.05] dark:border-white/[0.07]",
          )}
        >
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-slate-700 to-slate-900 text-[13px] font-semibold text-white dark:from-slate-100 dark:to-slate-300 dark:text-slate-900">
              {user?.full_name?.charAt(0) ?? "?"}
            </div>
            <p className="min-w-0 flex-1 truncate text-[13.5px] font-semibold tracking-tight">
              {user?.full_name ?? "Guest"}
            </p>
            <div className="flex items-center">
              <IconButton onClick={onNewChat} label="New chat">
                <MessageSquarePlus className="h-[18px] w-[18px] md:h-4 md:w-4" strokeWidth={1.75} />
              </IconButton>
              <IconButton
                onClick={() => setSearchOpen((open) => !open)}
                label="Search conversations"
                active={searchOpen}
              >
                <Search className="h-[18px] w-[18px] md:h-4 md:w-4" strokeWidth={1.75} />
              </IconButton>
              <div className="relative" ref={menuRef}>
                <IconButton
                  onClick={() => setMenuOpen((open) => !open)}
                  label="More"
                  active={menuOpen}
                >
                  <MoreHorizontal className="h-[18px] w-[18px] md:h-4 md:w-4" strokeWidth={1.75} />
                </IconButton>
                {menuOpen && (
                  <div className="absolute right-0 top-[calc(100%+6px)] z-50 min-w-[10.5rem] overflow-hidden rounded-xl border border-black/[0.08] bg-white py-1 shadow-[0_12px_32px_rgba(15,23,42,0.12)] dark:border-white/10 dark:bg-zinc-900">
                    <button
                      type="button"
                      className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] text-foreground hover:bg-black/[0.04] dark:hover:bg-white/[0.06]"
                      onClick={() => {
                        setMenuOpen(false);
                        signOut();
                      }}
                    >
                      <LogOut className="h-3.5 w-3.5 text-muted-foreground" />
                      Sign out
                    </button>
                  </div>
                )}
              </div>
              {onClose && (
                <IconButton onClick={onClose} label="Close panel">
                  {sheet ? (
                    <X className="h-[18px] w-[18px]" strokeWidth={1.75} />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </IconButton>
              )}
            </div>
          </div>

          {searchOpen && (
            <label className="relative mt-3 block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search"
                className="h-11 w-full rounded-full border border-black/[0.06] bg-black/[0.03] pl-9 pr-3 text-[13px] outline-none placeholder:text-muted-foreground/70 focus:border-slate-400 md:h-9 dark:border-white/10 dark:bg-white/[0.04]"
                aria-label="Search conversations"
              />
            </label>
          )}
        </div>

        {activeConversation && (
          <div className="shrink-0 space-y-2 border-b border-black/[0.05] px-3 py-2.5 dark:border-white/[0.07]">
            <div className="flex flex-wrap gap-1" aria-label="Matter type">
              {MATTER_TYPES.map((item) => {
                const selected = activeConversation.matterType === item.id;
                const Icon = MATTER_ICONS[item.id];
                return (
                  <button
                    key={item.id}
                    type="button"
                    title={item.label}
                    aria-label={item.label}
                    aria-pressed={selected}
                    onClick={() => onMatterTypeChange?.(selected ? null : item.id)}
                    className={cn(
                      "flex h-9 w-9 items-center justify-center rounded-full transition-colors md:h-8 md:w-8",
                      selected
                        ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                        : "text-muted-foreground hover:bg-black/[0.05] hover:text-foreground dark:hover:bg-white/10",
                    )}
                  >
                    <Icon className="h-4 w-4" strokeWidth={1.75} />
                  </button>
                );
              })}
            </div>
            <select
              value={activeConversation.jurisdiction ?? ""}
              onChange={(e) => onJurisdictionChange?.(e.target.value)}
              className="h-10 w-full rounded-full border border-black/[0.06] bg-transparent px-3 text-[12px] outline-none md:h-8 dark:border-white/10"
              aria-label="Jurisdiction"
            >
              <option value="">Jurisdiction</option>
              {JURISDICTION_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>
        )}

        <nav className="no-scrollbar relative min-h-0 flex-1 overflow-y-auto px-2 py-2" aria-label="Conversation history">
          {shown.length === 0 ? (
            <p className="px-3 py-10 text-center text-[13px] text-muted-foreground">
              {debounced ? "No matching matters" : "No conversations yet"}
            </p>
          ) : (
            <ul className="space-y-0.5">
              {shown.map((conv) => {
                const active = conv.id === activeId;
                const renaming = renameId === conv.id;
                return (
                  <li key={conv.id} className="mv-hist-row">
                    <div
                      className={cn(
                        "group relative flex min-h-11 items-center gap-1 rounded-xl py-1.5 pl-3 pr-1 transition-colors md:min-h-10",
                        active
                          ? "bg-black/[0.05] dark:bg-white/[0.07]"
                          : "hover:bg-black/[0.03] dark:hover:bg-white/[0.04]",
                      )}
                    >
                      <span
                        className={cn(
                          "absolute bottom-2 left-0 top-2 w-0.5 rounded-full bg-slate-900 dark:bg-slate-100",
                          active ? "opacity-100" : "opacity-0",
                        )}
                      />
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
                          className="h-8 w-full rounded-lg border border-black/10 bg-white px-2 text-[13px] dark:border-white/15 dark:bg-zinc-900"
                        />
                      ) : (
                        <button
                          type="button"
                          className="min-w-0 flex-1 text-left"
                          aria-current={active ? "page" : undefined}
                          onClick={() => onSelectConversation(conv.id)}
                        >
                          <span className="flex items-center gap-1.5">
                            {conv.pinned && <Pin className="h-3 w-3 shrink-0 text-slate-500" />}
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
                          className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:text-foreground md:h-7 md:w-7"
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
                          className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:text-foreground md:h-7 md:w-7"
                          aria-label="Rename"
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
                          className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:text-destructive md:h-7 md:w-7"
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
              Show more
            </button>
          )}
        </nav>

        <div className="flex shrink-0 items-center justify-end border-t border-black/[0.05] px-2 py-1.5 pb-[max(0.4rem,env(safe-area-inset-bottom))] dark:border-white/[0.07]">
          <LanguagePicker compact value={speechLocale} onChange={onSpeechLocaleChange} />
        </div>
      </div>
    </>
  );
}
