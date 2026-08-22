"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronRight,
  FileText,
  Gavel,
  LogOut,
  MessageSquarePlus,
  Pin,
  PinOff,
  Pencil,
  Scale,
  Search,
  Sparkles,
  Trash2,
} from "lucide-react";

import { ConfirmDialog } from "@/components/mera-vakil/confirm-dialog";
import { LanguagePicker } from "@/components/mera-vakil/language-picker";
import { VoiceVisualizer } from "@/components/mera-vakil/voice-visualizer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { clearSession, getStoredUser } from "@/lib/api";
import {
  JURISDICTION_OPTIONS,
  MATTER_TYPES,
  lastMessagePreview,
  relativeTime,
  type ChatConversation,
  type MatterType,
} from "@/lib/conversations";
import { getPrimaryRole, type PrimaryRole } from "@/lib/dashboard-config";
import type { ResearchResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

type QuickAction = { id: string; label: string; prompt: string };

const TOOLS_BY_ROLE: Record<PrimaryRole, QuickAction[]> = {
  citizen: [
    { id: "rights", label: "My rights", prompt: "What are my fundamental rights under the Indian Constitution and how are they protected?" },
    { id: "complaint", label: "File complaint", prompt: "Guide me step-by-step on how to file a complaint — FIR, consumer court, or civil dispute." },
    { id: "notice", label: "Got a notice?", prompt: "I received a legal notice. Explain what it means, what I must do immediately, and what my options are." },
    { id: "findlawyer", label: "Find a lawyer", prompt: "How do I find and evaluate a good lawyer in India for my specific legal problem? What should I ask before hiring?" },
    { id: "courtprocess", label: "Court process", prompt: "Explain the typical court process in India for civil or criminal cases in simple, plain language." },
  ],
  advocate: [
    { id: "fir", label: "FIR outline", prompt: "Draft a professional FIR outline under Indian criminal procedure: essential facts to record, sections likely attracted, documents to annex, and common defects that cause delay." },
    { id: "bail", label: "Bail checklist", prompt: "Give a counsel-grade bail checklist for India: bailable vs non-bailable, statutory provisions, factors courts weigh, and a structured list of documents and arguments." },
    { id: "limitation", label: "Limitation", prompt: "Explain the limitation period that typically applies to this matter under the Limitation Act, 1963, including when time starts, exclusions, and practical next steps." },
    { id: "section", label: "Section explainer", prompt: "Explain the relevant statutory section in plain professional English: ingredients, burden of proof, leading Supreme Court interpretation, and how it applies on these facts." },
    { id: "precedent", label: "Precedent hunt", prompt: "Identify the leading Indian authorities (Supreme Court and High Court) on this issue, with citation, holding, and why each is on-point or distinguishable." },
  ],
  law_firm: [
    { id: "fir", label: "FIR outline", prompt: "Draft a professional FIR outline under Indian criminal procedure: essential facts to record, sections likely attracted, documents to annex, and common defects that cause delay." },
    { id: "bail", label: "Bail checklist", prompt: "Give a counsel-grade bail checklist for India: bailable vs non-bailable, statutory provisions, factors courts weigh, and a structured list of documents and arguments." },
    { id: "limitation", label: "Limitation", prompt: "Explain the limitation period that typically applies to this matter under the Limitation Act, 1963, including when time starts, exclusions, and practical next steps." },
    { id: "section", label: "Section explainer", prompt: "Explain the relevant statutory section in plain professional English: ingredients, burden of proof, leading Supreme Court interpretation, and how it applies on these facts." },
    { id: "precedent", label: "Precedent hunt", prompt: "Identify the leading Indian authorities (Supreme Court and High Court) on this issue, with citation, holding, and why each is on-point or distinguishable." },
  ],
  enterprise: [
    { id: "dpdp", label: "DPDP Act", prompt: "What are our key obligations under the Digital Personal Data Protection Act, 2023 and the implementation timeline?" },
    { id: "contract", label: "Contract risks", prompt: "Identify the most common risk clauses in commercial contracts under Indian law and how to mitigate them." },
    { id: "employment", label: "Employment law", prompt: "Summarise our key obligations under Indian employment and labour laws for a technology company." },
    { id: "sebi", label: "SEBI / RBI", prompt: "What are the recent SEBI or RBI regulatory changes that listed companies or NBFCs must comply with?" },
    { id: "compliance", label: "Compliance map", prompt: "Build a compliance checklist for a technology startup operating in India across major regulators." },
  ],
  admin: [
    { id: "fir", label: "FIR outline", prompt: "Draft a professional FIR outline under Indian criminal procedure: essential facts to record, sections likely attracted, documents to annex, and common defects that cause delay." },
    { id: "bail", label: "Bail checklist", prompt: "Give a counsel-grade bail checklist for India: bailable vs non-bailable, statutory provisions, factors courts weigh, and a structured list of documents and arguments." },
    { id: "limitation", label: "Limitation", prompt: "Explain the limitation period that typically applies to this matter under the Limitation Act, 1963, including when time starts, exclusions, and practical next steps." },
    { id: "section", label: "Section explainer", prompt: "Explain the relevant statutory section in plain professional English: ingredients, burden of proof, leading Supreme Court interpretation, and how it applies on these facts." },
    { id: "precedent", label: "Precedent hunt", prompt: "Identify the leading Indian authorities (Supreme Court and High Court) on this issue, with citation, holding, and why each is on-point or distinguishable." },
  ],
};

const PANEL_LABELS: Record<PrimaryRole, string> = {
  citizen: "Your Legal Guide",
  advocate: "Counsel Workbench",
  law_firm: "Firm Intelligence",
  enterprise: "Compliance Hub",
  admin: "Admin Console",
};

const TOOLS_SECTION_LABELS: Record<PrimaryRole, string> = {
  citizen: "Common questions",
  advocate: "Counsel tools",
  law_firm: "Counsel tools",
  enterprise: "Compliance tools",
  admin: "Counsel tools",
};

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
}

function SectionHeader({
  label,
  open,
  onToggle,
  extra,
}: {
  label: string;
  open: boolean;
  onToggle: () => void;
  extra?: ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <button
        type="button"
        onClick={onToggle}
        className="flex min-w-0 items-center gap-2 text-left"
        aria-expanded={open}
      >
        <span className="mv-ink-dot" />
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          {label}
        </p>
        <ChevronDown
          className={cn("h-3 w-3 text-muted-foreground/70 transition-transform", open && "rotate-180")}
        />
      </button>
      {extra}
    </div>
  );
}

function ConfidenceBars({ research }: { research: ResearchResponse }) {
  const items = [
    { label: "Retrieval", value: research.confidence.retrieval_strength },
    { label: "Agreement", value: research.confidence.source_agreement },
    { label: "Coverage", value: research.confidence.coverage },
  ];
  const overall = Math.round(research.confidence.overall * 100);
  return (
    <div className="space-y-2 rounded-xl border border-black/[0.06] bg-white/40 p-2.5 dark:border-white/[0.07] dark:bg-white/[0.03]">
      <div className="flex items-baseline justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          Grounding
        </p>
        <p className="text-[12px] font-semibold tabular-nums">{overall}%</p>
      </div>
      {items.map((item) => (
        <div key={item.label} className="space-y-1">
          <div className="flex justify-between text-[10px] text-muted-foreground">
            <span>{item.label}</span>
            <span className="tabular-nums">{Math.round(item.value * 100)}%</span>
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-black/[0.06] dark:bg-white/10">
            <div
              className="h-full rounded-full bg-slate-800 dark:bg-slate-200"
              style={{ width: `${Math.min(100, Math.round(item.value * 100))}%` }}
            />
          </div>
        </div>
      ))}
    </div>
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
  onQuickAction,
  speechLocale,
  onSpeechLocaleChange,
  latestResearch,
  isSpeaking = false,
  onClose,
}: ContextPanelProps) {
  const router = useRouter();
  const user = getStoredUser();
  const role = getPrimaryRole(user);
  const roleTools = TOOLS_BY_ROLE[role];
  const panelLabel = PANEL_LABELS[role];
  const toolsSectionLabel = TOOLS_SECTION_LABELS[role];
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; title: string } | null>(null);
  const [query, setQuery] = useState("");
  const [debounced, setDebounced] = useState("");
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [clock, setClock] = useState(() =>
    new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }),
  );
  const [open, setOpen] = useState({
    history: true,
    matter: true,
    tools: true,
    authorities: true,
    voice: false,
  });
  const [visibleCount, setVisibleCount] = useState(40);
  const searchRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setDebounced(query.trim().toLowerCase()), 150);
    return () => window.clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setClock(new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }));
    }, 30_000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "/" && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        searchRef.current?.focus();
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
  const roleLabel = panelLabel;
  const confidence = latestResearch?.confidence;

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

      <div className="counsel-rail relative flex h-full min-h-0 flex-col overflow-hidden">
        <div className="counsel-rail-rule" />

        <div className="relative border-b border-black/[0.06] px-4 pb-3.5 pt-4 dark:border-white/[0.07]">
          <div className="mb-3 flex items-start justify-between gap-2">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Mera Vakil · {panelLabel}
              </p>
              <div className="mt-1.5 flex items-center gap-2">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="absolute inset-0 rounded-full bg-emerald-400/70" />
                  <span className="relative h-1.5 w-1.5 rounded-full bg-emerald-500" />
                </span>
                <span className="text-[11px] capitalize text-muted-foreground">{roleLabel}</span>
                <span className="text-[11px] tabular-nums text-muted-foreground/70">{clock}</span>
              </div>
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
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-slate-700 to-slate-900 text-sm font-semibold text-white dark:from-slate-100 dark:to-slate-300 dark:text-slate-900">
              {user?.full_name?.charAt(0) ?? "?"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold tracking-tight">
                {user?.full_name ?? "Guest"}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">{user?.email ?? "Signed in"}</p>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            className="mt-3 min-h-9 w-full rounded-lg border-black/[0.08] bg-white/40 text-[12px] dark:border-white/10 dark:bg-white/[0.04]"
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
          <section aria-label="Conversation history" className="space-y-2.5">
            <SectionHeader
              label="Matters"
              open={open.history}
              onToggle={() => setOpen((s) => ({ ...s, history: !s.history }))}
              extra={
                <Button
                  size="sm"
                  onClick={onNewChat}
                  className="h-7 gap-1 rounded-full bg-slate-900 px-2.5 text-[11px] font-medium text-white dark:bg-slate-100 dark:text-slate-900"
                >
                  <MessageSquarePlus className="h-3.5 w-3.5" />
                  New
                </Button>
              }
            />
            {open.history && (
              <>
                <label className="relative block">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <input
                    ref={searchRef}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search history"
                    className="h-8 w-full rounded-lg border border-black/[0.06] bg-white/50 pl-8 pr-2 text-[12px] outline-none placeholder:text-muted-foreground/70 focus:border-slate-400 dark:border-white/10 dark:bg-white/[0.04]"
                    aria-label="Search conversations"
                  />
                </label>
                <nav>
                  {shown.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-black/[0.08] px-3 py-6 text-center dark:border-white/10">
                      <Sparkles className="mx-auto mb-2 h-5 w-5 text-muted-foreground/40" />
                      <p className="text-[12px] text-muted-foreground">
                        {debounced ? "No matching matters" : "No conversations yet"}
                      </p>
                    </div>
                  ) : (
                    <ul
                      ref={listRef}
                      className="space-y-0.5"
                      onClick={(e) => {
                        const target = (e.target as HTMLElement).closest<HTMLElement>("[data-conv-id]");
                        if (!target) return;
                        const id = target.dataset.convId;
                        const action = target.dataset.action;
                        if (!id) return;
                        if (action === "select") onSelectConversation(id);
                      }}
                    >
                      {shown.map((conv) => {
                        const active = conv.id === activeId;
                        const renaming = renameId === conv.id;
                        return (
                          <li key={conv.id} className="mv-hist-row">
                            <div
                              className={cn(
                                "group relative flex items-start gap-1 rounded-lg py-1.5 pl-2 pr-1 transition-colors",
                                active
                                  ? "bg-black/[0.04] dark:bg-white/[0.06]"
                                  : "hover:bg-black/[0.03] dark:hover:bg-white/[0.04]",
                              )}
                            >
                              <span
                                className={cn(
                                  "absolute bottom-1.5 left-0 top-1.5 w-0.5 rounded-full bg-slate-900 dark:bg-slate-100",
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
                                  className="h-7 w-full rounded border border-black/10 bg-white px-1.5 text-[12px] dark:border-white/15 dark:bg-zinc-900"
                                />
                              ) : (
                                <button
                                  type="button"
                                  data-conv-id={conv.id}
                                  data-action="select"
                                  className="min-w-0 flex-1 text-left"
                                  aria-current={active ? "page" : undefined}
                                >
                                  <span className="flex items-center gap-1.5">
                                    {conv.pinned && (
                                      <Pin className="h-3 w-3 shrink-0 text-slate-500" />
                                    )}
                                    <span className="truncate text-[12px] font-medium">{conv.title}</span>
                                  </span>
                                  <span className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                                    <span className="tabular-nums">{relativeTime(conv.updatedAt)}</span>
                                    <span className="truncate">{lastMessagePreview(conv)}</span>
                                  </span>
                                </button>
                              )}
                              <div className="flex shrink-0 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                                <button
                                  type="button"
                                  className="rounded p-1 text-muted-foreground hover:text-foreground"
                                  aria-label={conv.pinned ? "Unpin" : "Pin"}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onPinConversation?.(conv.id);
                                  }}
                                >
                                  {conv.pinned ? <PinOff className="h-3 w-3" /> : <Pin className="h-3 w-3" />}
                                </button>
                                <button
                                  type="button"
                                  className="rounded p-1 text-muted-foreground hover:text-foreground"
                                  aria-label="Rename"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setRenameId(conv.id);
                                    setRenameValue(conv.title);
                                  }}
                                >
                                  <Pencil className="h-3 w-3" />
                                </button>
                                <button
                                  type="button"
                                  className="rounded p-1 text-muted-foreground hover:text-destructive"
                                  aria-label={`Delete ${conv.title}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setDeleteTarget({ id: conv.id, title: conv.title });
                                  }}
                                >
                                  <Trash2 className="h-3 w-3" />
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
                      className="mt-1 w-full py-1 text-center text-[11px] text-muted-foreground hover:text-foreground"
                      onClick={() => setVisibleCount((n) => n + 40)}
                    >
                      Show more
                    </button>
                  )}
                </nav>
              </>
            )}
          </section>

          {activeConversation && (
            <section aria-label="Matter settings" className="space-y-2.5">
              <SectionHeader
                label="Matter"
                open={open.matter}
                onToggle={() => setOpen((s) => ({ ...s, matter: !s.matter }))}
              />
              {open.matter && (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-1">
                    {MATTER_TYPES.map((item) => {
                      const selected = activeConversation.matterType === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() =>
                            onMatterTypeChange?.(selected ? null : item.id)
                          }
                          className={cn(
                            "rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors",
                            selected
                              ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
                              : "border-black/[0.08] text-muted-foreground hover:border-slate-400 dark:border-white/10",
                          )}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                  <select
                    value={activeConversation.jurisdiction ?? ""}
                    onChange={(e) => onJurisdictionChange?.(e.target.value)}
                    className="h-8 w-full rounded-lg border border-black/[0.06] bg-white/50 px-2 text-[12px] outline-none dark:border-white/10 dark:bg-white/[0.04]"
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
            </section>
          )}

          <section aria-label="Legal tools" className="space-y-2.5">
            <SectionHeader
              label={toolsSectionLabel}
              open={open.tools}
              onToggle={() => setOpen((s) => ({ ...s, tools: !s.tools }))}
            />
            {open.tools && (
              <div className="flex flex-wrap gap-1.5">
                {roleTools.map((action) => (
                  <button
                    key={action.id}
                    type="button"
                    onClick={() => onQuickAction?.(action.prompt)}
                    className="rounded-lg border border-black/[0.06] bg-white/40 px-2 py-1 text-[11px] font-medium text-foreground/80 transition-colors hover:border-slate-400 dark:border-white/10 dark:bg-white/[0.04]"
                  >
                    {action.label}
                  </button>
                ))}
              </div>
            )}
          </section>

          <section aria-label="Voice and read-aloud language" className="space-y-2.5">
            <SectionHeader
              label="Read aloud"
              open={open.voice}
              onToggle={() => setOpen((s) => ({ ...s, voice: !s.voice }))}
            />
            {open.voice && (
              <>
                <LanguagePicker value={speechLocale} onChange={onSpeechLocaleChange} />
                <VoiceVisualizer isActive={isSpeaking} />
              </>
            )}
          </section>

          {latestResearch && (latestResearch.sources.length > 0 || (confidence && confidence.overall > 0)) && (
            <section aria-label="Live authorities" className="space-y-2.5">
              <SectionHeader
                label="Authorities"
                open={open.authorities}
                onToggle={() => setOpen((s) => ({ ...s, authorities: !s.authorities }))}
                extra={
                  latestResearch.sources.length > 0 ? (
                    <Badge variant="secondary" className="rounded-full text-[10px]">
                      {latestResearch.sources.length}
                    </Badge>
                  ) : null
                }
              />
              {open.authorities && (
                <div className="space-y-2">
                  {confidence && confidence.overall > 0 && <ConfidenceBars research={latestResearch} />}
                  <ul className="space-y-1.5">
                    {latestResearch.sources.slice(0, 4).map((source, idx) => {
                      const isJudgment = /judgment|court|air|scc/i.test(
                        `${source.doc_type ?? ""} ${source.citation ?? ""}`,
                      );
                      const Icon = isJudgment ? Gavel : source.section ? Scale : FileText;
                      return (
                        <li
                          key={`${source.chunk_id}-${idx}`}
                          className="rounded-xl border border-black/[0.05] bg-white/50 p-2.5 dark:border-white/[0.06] dark:bg-white/[0.04]"
                        >
                          <div className="flex items-start gap-2">
                            <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
                            <div className="min-w-0">
                              <p className="truncate text-[11px] font-medium">
                                [{idx + 1}] {source.title ?? source.document_id}
                              </p>
                              <p className="mt-0.5 text-[10px] text-muted-foreground">
                                {source.section ? `§ ${source.section}` : source.citation || "Authority"}
                              </p>
                              <p className="mt-0.5 line-clamp-2 text-[10px] text-muted-foreground">
                                {source.content}
                              </p>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </section>
          )}

          {latestResearch && latestResearch.trace.length > 0 && (
            <section aria-label="Agent activity" className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Activity
              </p>
              <div className="flex flex-wrap gap-1.5">
                {latestResearch.trace.map((step, idx) => (
                  <Badge key={`${step}-${idx}`} variant="secondary" className="rounded-full text-[10px]">
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
