"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { CalendarClock, FolderOpen, MessageSquare, Search, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { Input } from "@/components/ui/input";
import { listAppointments, listCasesApi } from "@/lib/api";
import {
  lastMessagePreview,
  loadConversations,
  relativeTime,
} from "@/lib/conversations";
import { getDashboardConfig } from "@/lib/dashboard-config";
import { markNavigationStart } from "@/lib/navigation-feedback";
import type { AuthUser } from "@/lib/types";
import { cn } from "@/lib/utils";

type PaletteGroup = "workspace" | "counsel" | "consultation" | "docket";

interface PaletteItem {
  id: string;
  group: PaletteGroup;
  title: string;
  subtitle: string;
  href: string;
  icon: LucideIcon;
  badge?: string;
  badgeVariant?: "live" | "active" | "muted";
  conversationId?: string;
}

const GROUP_LABEL: Record<PaletteGroup, string> = {
  workspace:    "Workspaces",
  counsel:      "Recent Chats",
  consultation: "My Consultations",
  docket:       "Cases",
};

const GROUP_ORDER: PaletteGroup[] = ["workspace", "counsel", "consultation", "docket"];

// Per-group icon container colours
const GROUP_ICON_BG: Record<PaletteGroup, string> = {
  workspace:    "bg-white/80 border-black/[0.06] dark:bg-white/[0.06] dark:border-white/[0.08]",
  counsel:      "bg-violet-50 border-violet-100 dark:bg-violet-500/[0.12] dark:border-violet-500/[0.15]",
  consultation: "bg-sky-50 border-sky-100 dark:bg-sky-500/[0.12] dark:border-sky-500/[0.15]",
  docket:       "bg-amber-50 border-amber-100 dark:bg-amber-500/[0.10] dark:border-amber-500/[0.14]",
};

const GROUP_ICON_COLOR: Record<PaletteGroup, string> = {
  workspace:    "text-muted-foreground",
  counsel:      "text-violet-600 dark:text-violet-400",
  consultation: "text-sky-600 dark:text-sky-400",
  docket:       "text-amber-600 dark:text-amber-500",
};

const BADGE_STYLES: Record<NonNullable<PaletteItem["badgeVariant"]>, string> = {
  live:   "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/[0.12] dark:text-emerald-400 dark:border-emerald-500/20",
  active: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/[0.12] dark:text-sky-400 dark:border-sky-500/20",
  muted:  "bg-black/[0.04] text-muted-foreground border-black/[0.06] dark:bg-white/[0.06] dark:border-white/[0.08]",
};

function domId(id: string): string {
  return `palette-opt-${id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

function fmtDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function collectSyncItems(user: AuthUser | null): PaletteItem[] {
  const config = getDashboardConfig(user);
  const workspaces: PaletteItem[] = config.modules.map((mod) => ({
    id: `mod:${mod.href}`,
    group: "workspace",
    title: mod.title,
    subtitle: mod.description,
    href: mod.href,
    icon: mod.icon,
  }));

  const counsel: PaletteItem[] = [...loadConversations()]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 8)
    .map((conv) => ({
      id: `chat:${conv.id}`,
      group: "counsel" as const,
      title: conv.title,
      subtitle: `${lastMessagePreview(conv)} · ${relativeTime(conv.updatedAt)}`,
      href: `/mera-vakil?c=${conv.id}`,
      icon: MessageSquare,
      conversationId: conv.id,
    }));

  return [...workspaces, ...counsel];
}

async function collectAsyncItems(): Promise<PaletteItem[]> {
  const [apts, page] = await Promise.all([
    listAppointments(),
    listCasesApi(undefined, 1, 10),
  ]);

  const APT_BADGE: Partial<Record<string, { label: string; variant: PaletteItem["badgeVariant"] }>> = {
    live:      { label: "Live now", variant: "live" },
    confirmed: { label: "Upcoming", variant: "active" },
    requested: { label: "Pending",  variant: "muted" },
  };

  const consultations: PaletteItem[] = apts
    .filter((a) => !["cancelled", "expired", "no_show"].includes(a.status))
    .slice(0, 5)
    .map((a) => {
      const b = APT_BADGE[a.status];
      return {
        id: `apt:${a.id}`,
        group: "consultation" as const,
        title: a.counterpart_name || a.lawyer_name || a.citizen_name || "Consultation",
        subtitle: `${a.matter_summary || "Legal consultation"} · ${a.date ? fmtDate(a.date) : ""}`.replace(/ · $/, ""),
        href: `/appointments/${a.id}`,
        icon: CalendarClock,
        badge: b?.label,
        badgeVariant: b?.variant,
      };
    });

  const docket: PaletteItem[] = page.items
    .filter((c) => c.status === "open" || c.status === "in_progress")
    .slice(0, 6)
    .map((c) => ({
      id: `case:${c.id}`,
      group: "docket" as const,
      title: c.title,
      subtitle: [c.case_number, c.court].filter(Boolean).join(" · "),
      href: `/cases/${c.id}`,
      icon: FolderOpen,
      badge: c.status === "in_progress" ? "In progress" : undefined,
      badgeVariant: c.status === "in_progress" ? "active" : undefined,
    }));

  return [...consultations, ...docket];
}

function scoreItem(item: PaletteItem, query: string): number {
  const q = query.trim().toLowerCase();
  if (!q) return 1;
  const title = item.title.toLowerCase();
  const sub = item.subtitle.toLowerCase();
  const terms = q.split(/\s+/).filter(Boolean);
  if (!terms.every((t) => title.includes(t) || sub.includes(t))) return 0;
  if (title.startsWith(q)) return 3;
  if (title.includes(q)) return 2;
  return 1;
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-3 rounded-2xl px-2.5 py-2">
      <div className="h-8 w-8 shrink-0 animate-pulse rounded-xl bg-black/[0.05] dark:bg-white/[0.06]" />
      <div className="flex-1 space-y-1.5">
        <div className="h-3 w-2/3 animate-pulse rounded-full bg-black/[0.05] dark:bg-white/[0.06]" />
        <div className="h-2.5 w-1/2 animate-pulse rounded-full bg-black/[0.04] dark:bg-white/[0.04]" />
      </div>
    </div>
  );
}

export function DashboardCommandPalette({
  open,
  onOpenChange,
  user,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user: AuthUser | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [syncItems, setSyncItems]   = useState<PaletteItem[]>([]);
  const [asyncItems, setAsyncItems] = useState<PaletteItem[]>([]);
  const [asyncLoading, setAsyncLoading] = useState(false);
  const [mounted, setMounted] = useState(false);

  const items = useMemo(() => [...syncItems, ...asyncItems], [syncItems, asyncItems]);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActive(0);
    setSyncItems(collectSyncItems(user));
    setAsyncItems([]);
    setAsyncLoading(true);
    void collectAsyncItems()
      .then(setAsyncItems)
      .catch(() => {})
      .finally(() => setAsyncLoading(false));

    const id = window.requestAnimationFrame(() => inputRef.current?.focus());
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onOpenChange(false);
      }
    }
    window.addEventListener("keydown", onEscape);

    return () => {
      window.cancelAnimationFrame(id);
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onEscape);
    };
  }, [open, user, onOpenChange]);

  const filtered = useMemo(() => {
    const ranked = items
      .map((item) => ({ item, score: scoreItem(item, query) }))
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((row) => row.item);

    return GROUP_ORDER.flatMap((group) => ranked.filter((item) => item.group === group));
  }, [items, query]);

  const groups = useMemo(
    () =>
      GROUP_ORDER.map((group) => ({
        group,
        items: filtered.filter((item) => item.group === group),
      })).filter((g) => g.items.length > 0),
    [filtered],
  );

  useEffect(() => { setActive(0); }, [query]);

  useEffect(() => {
    const el = document.querySelector<HTMLElement>(`[data-palette-index="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active, filtered.length]);

  function close() { onOpenChange(false); }

  function select(item: PaletteItem) {
    close();
    markNavigationStart();
    router.push(item.href);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape")    { event.preventDefault(); close(); return; }
    if (event.key === "ArrowDown") { event.preventDefault(); setActive((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0))); return; }
    if (event.key === "ArrowUp")   { event.preventDefault(); setActive((i) => Math.max(i - 1, 0)); return; }
    if (event.key === "Enter")     { event.preventDefault(); const item = filtered[active]; if (item) select(item); }
  }

  if (!mounted || !open) return null;

  const hasResults = filtered.length > 0;
  const showSkeletons = asyncLoading && !query;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-start justify-center px-4 pt-[10vh] sm:pt-[14vh]">
      {/* Veil */}
      <button
        type="button"
        className="dash-palette-veil absolute inset-0"
        aria-label="Close search"
        onClick={close}
      />

      {/* Dialog */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="command-palette-title"
        className="relative z-[81] w-full max-w-[560px] overflow-hidden rounded-[1.5rem] border border-black/[0.07] bg-white/97 shadow-[0_32px_96px_rgba(15,23,42,0.22),0_2px_8px_rgba(15,23,42,0.06)] backdrop-blur-2xl dark:border-white/[0.09] dark:bg-[hsl(220_16%_8%/0.98)]"
        onKeyDown={onKeyDown}
      >
        {/* Search bar */}
        <div className="flex items-center gap-2.5 border-b border-black/[0.06] px-4 py-3.5 dark:border-white/[0.07]">
          <h2 id="command-palette-title" className="sr-only">Search</h2>
          <Search className="h-[15px] w-[15px] shrink-0 text-muted-foreground/70" strokeWidth={2} />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search workspaces, consultations, chats…"
            className="h-9 border-0 bg-transparent px-0 text-[14px] shadow-none placeholder:text-muted-foreground/50 focus-visible:ring-0"
            aria-autocomplete="list"
            aria-controls="command-palette-list"
            aria-activedescendant={filtered[active] ? domId(filtered[active].id) : undefined}
          />
          <kbd className="dash-kbd shrink-0">Esc</kbd>
        </div>

        {/* Results */}
        <ul
          id="command-palette-list"
          role="listbox"
          className="max-h-[min(56vh,440px)] overflow-y-auto px-2 py-2"
        >
          {/* No query and no results yet */}
          {!hasResults && !showSkeletons ? (
            <li className="flex flex-col items-center gap-2 px-3 py-12 text-center">
              <Search className="h-7 w-7 text-muted-foreground/25" strokeWidth={1.5} />
              <span className="text-[13px] text-muted-foreground/60">
                {query ? "No matches found" : "Start typing to search"}
              </span>
            </li>
          ) : (
            <>
              {groups.map(({ group, items: groupItems }) => (
                <li key={group} className="mb-2">
                  {/* Group header with extending rule */}
                  <div className="flex items-center gap-2.5 px-2.5 pb-1 pt-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.13em] text-muted-foreground/55">
                      {GROUP_LABEL[group]}
                    </span>
                    <div className="h-px flex-1 bg-black/[0.055] dark:bg-white/[0.06]" />
                  </div>

                  <ul>
                    {groupItems.map((item) => {
                      const index = filtered.indexOf(item);
                      const Icon = item.icon ?? Sparkles;
                      const isActive = index === active;
                      return (
                        <li key={item.id} id={domId(item.id)} role="option" aria-selected={isActive}>
                          <button
                            type="button"
                            data-palette-index={index}
                            onMouseEnter={() => setActive(index)}
                            onClick={() => select(item)}
                            className={cn(
                              "flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition-colors",
                              isActive
                                ? "bg-black/[0.055] dark:bg-white/[0.08]"
                                : "hover:bg-black/[0.03] dark:hover:bg-white/[0.04]",
                            )}
                          >
                            {/* Group-tinted icon */}
                            <span className={cn(
                              "flex h-8 w-8 shrink-0 items-center justify-center rounded-[10px] border",
                              GROUP_ICON_BG[item.group],
                            )}>
                              <Icon
                                className={cn("h-[14px] w-[14px]", GROUP_ICON_COLOR[item.group])}
                                strokeWidth={1.85}
                              />
                            </span>

                            {/* Text */}
                            <span className="min-w-0 flex-1">
                              <span className="flex items-center gap-2">
                                <span className="block truncate text-[13px] font-medium leading-snug tracking-tight">
                                  {item.title}
                                </span>
                                {item.badge && (
                                  <span className={cn(
                                    "shrink-0 rounded-full border px-1.5 py-[1px] text-[10px] font-medium leading-none",
                                    BADGE_STYLES[item.badgeVariant ?? "muted"],
                                  )}>
                                    {item.badge}
                                  </span>
                                )}
                              </span>
                              <span className="mt-0.5 block truncate text-[11.5px] text-muted-foreground/70">
                                {item.subtitle}
                              </span>
                            </span>

                            {/* Arrow hint on active */}
                            {isActive && (
                              <span className="ml-1 shrink-0 text-[10px] text-muted-foreground/40">↵</span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </li>
              ))}

              {/* Skeleton rows while async data loads */}
              {showSkeletons && asyncItems.length === 0 && (
                <li className="mb-2">
                  <div className="flex items-center gap-2.5 px-2.5 pb-1 pt-1.5">
                    <span className="text-[10px] font-semibold uppercase tracking-[0.13em] text-muted-foreground/40">
                      My Consultations
                    </span>
                    <div className="h-px flex-1 bg-black/[0.04] dark:bg-white/[0.04]" />
                  </div>
                  <SkeletonRow />
                  <SkeletonRow />
                </li>
              )}
            </>
          )}
        </ul>

        {/* Footer — keyboard hints */}
        <div className="flex items-center gap-4 border-t border-black/[0.05] px-4 py-2.5 dark:border-white/[0.06]">
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground/45">
            <kbd className="dash-kbd">↑↓</kbd> navigate
          </span>
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground/45">
            <kbd className="dash-kbd">↵</kbd> open
          </span>
          <span className="flex items-center gap-1 text-[10px] text-muted-foreground/45">
            <kbd className="dash-kbd">esc</kbd> close
          </span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
