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
  time?: string;
}

const GROUP_LABEL: Record<PaletteGroup, string> = {
  workspace:    "Navigate",
  counsel:      "Recent Chats",
  consultation: "My Consultations",
  docket:       "Cases",
};

const GROUP_ORDER: PaletteGroup[] = ["workspace", "counsel", "consultation", "docket"];

// Small icon circle colours per group (for list mode)
const GROUP_DOT_BG: Record<PaletteGroup, string> = {
  workspace:    "bg-black/[0.05] dark:bg-white/[0.07]",
  counsel:      "bg-violet-100/80 dark:bg-violet-500/[0.15]",
  consultation: "bg-sky-100/80 dark:bg-sky-500/[0.15]",
  docket:       "bg-amber-100/80 dark:bg-amber-500/[0.12]",
};

const GROUP_DOT_ICON: Record<PaletteGroup, string> = {
  workspace:    "text-muted-foreground",
  counsel:      "text-violet-600 dark:text-violet-400",
  consultation: "text-sky-600 dark:text-sky-400",
  docket:       "text-amber-600 dark:text-amber-500",
};

const STATUS_DOT: Record<NonNullable<PaletteItem["badgeVariant"]>, { dot: string; text: string }> = {
  live:   { dot: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-400" },
  active: { dot: "bg-sky-400",     text: "text-sky-700 dark:text-sky-400" },
  muted:  { dot: "bg-slate-300 dark:bg-slate-500", text: "text-muted-foreground" },
};

function domId(id: string) {
  return `palette-opt-${id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

function fmtDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(new Date(iso));
  } catch { return iso; }
}

// ── Data collection ───────────────────────────────────────────────────────────

function collectSyncItems(user: AuthUser | null): PaletteItem[] {
  const workspaces: PaletteItem[] = getDashboardConfig(user).modules.map((mod) => ({
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
      subtitle: lastMessagePreview(conv),
      href: `/mera-vakil?c=${conv.id}`,
      icon: MessageSquare,
      time: relativeTime(conv.updatedAt),
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
        subtitle: a.matter_summary || "Legal consultation",
        href: `/appointments/${a.id}`,
        icon: CalendarClock,
        badge: b?.label,
        badgeVariant: b?.variant,
        time: a.date ? fmtDate(a.date) : undefined,
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
      badgeVariant: c.status === "in_progress" ? ("active" as const) : undefined,
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

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusPill({ badge, badgeVariant }: { badge: string; badgeVariant: PaletteItem["badgeVariant"] }) {
  const s = STATUS_DOT[badgeVariant ?? "muted"];
  return (
    <span className="flex shrink-0 items-center gap-1">
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", s.dot)} />
      <span className={cn("text-[10px] font-medium", s.text)}>{badge}</span>
    </span>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-2.5 px-3 py-[7px]">
      <div className="h-6 w-6 shrink-0 animate-pulse rounded-full bg-black/[0.05] dark:bg-white/[0.06]" />
      <div className="flex-1 space-y-1.5">
        <div className="h-2.5 w-2/3 animate-pulse rounded-full bg-black/[0.05] dark:bg-white/[0.06]" />
        <div className="h-2 w-1/2 animate-pulse rounded-full bg-black/[0.04] dark:bg-white/[0.04]" />
      </div>
    </div>
  );
}

function GroupHeader({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2.5 px-3 pb-0.5 pt-2.5">
      <span className="text-[9.5px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/45">
        {label}
      </span>
      <div className="h-px flex-1 bg-[hsl(35,18%,88%)] dark:bg-white/[0.07]" />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

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
  const [query, setQuery]           = useState("");
  const [active, setActive]         = useState(0);
  const [syncItems, setSyncItems]   = useState<PaletteItem[]>([]);
  const [asyncItems, setAsyncItems] = useState<PaletteItem[]>([]);
  const [asyncLoading, setAsyncLoading] = useState(false);
  const [mounted, setMounted]       = useState(false);

  const allItems = useMemo(() => [...syncItems, ...asyncItems], [syncItems, asyncItems]);
  const isSearching = query.trim().length > 0;

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

    function onEscape(e: KeyboardEvent) {
      if (e.key === "Escape") { e.preventDefault(); onOpenChange(false); }
    }
    window.addEventListener("keydown", onEscape);
    return () => {
      window.cancelAnimationFrame(id);
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onEscape);
    };
  }, [open, user, onOpenChange]);

  // Ranked, grouped results (used when isSearching OR for non-workspace groups always)
  const filtered = useMemo(() => {
    const ranked = allItems
      .map((item) => ({ item, score: scoreItem(item, query) }))
      .filter((r) => r.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((r) => r.item);
    return GROUP_ORDER.flatMap((g) => ranked.filter((item) => item.group === g));
  }, [allItems, query]);

  // Content groups (non-workspace) — shown below chip strip when not searching
  const contentGroups = useMemo(
    () =>
      (["counsel", "consultation", "docket"] as const)
        .map((g) => ({ group: g, items: filtered.filter((item) => item.group === g) }))
        .filter((g) => g.items.length > 0),
    [filtered],
  );

  // All groups for search mode
  const searchGroups = useMemo(
    () =>
      GROUP_ORDER.map((g) => ({ group: g, items: filtered.filter((item) => item.group === g) }))
        .filter((g) => g.items.length > 0),
    [filtered],
  );

  // Only navigable (list) items track the active index
  const navigableItems = useMemo(
    () => (isSearching ? filtered : filtered.filter((i) => i.group !== "workspace")),
    [isSearching, filtered],
  );

  useEffect(() => { setActive(0); }, [query]);

  useEffect(() => {
    const el = document.querySelector<HTMLElement>(`[data-palette-index="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active, navigableItems.length]);

  function close() { onOpenChange(false); }

  function select(item: PaletteItem) {
    close();
    markNavigationStart();
    router.push(item.href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape")    { e.preventDefault(); close(); return; }
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(i + 1, Math.max(navigableItems.length - 1, 0))); return; }
    if (e.key === "ArrowUp")   { e.preventDefault(); setActive((i) => Math.max(i - 1, 0)); return; }
    if (e.key === "Enter")     { e.preventDefault(); const item = navigableItems[active]; if (item) select(item); }
  }

  if (!mounted || !open) return null;

  const workspaceItems = syncItems.filter((i) => i.group === "workspace");
  const hasContent = navigableItems.length > 0;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-start justify-center px-4 pt-[10vh] sm:pt-[13vh]">
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
        aria-labelledby="palette-title"
        className="dash-palette-dialog relative z-[81] w-full max-w-[600px] overflow-hidden rounded-[1.4rem] border border-[hsl(35,18%,84%)] bg-[hsl(40,30%,98%)] shadow-[0_32px_80px_rgba(42,28,12,0.20),0_4px_12px_rgba(42,28,12,0.08),inset_0_1px_0_rgba(255,255,255,0.9)] dark:border-white/[0.09] dark:bg-[hsl(25,12%,9%)] dark:shadow-[0_32px_80px_rgba(0,0,0,0.5)]"
        onKeyDown={onKeyDown}
      >
        <h2 id="palette-title" className="sr-only">Search</h2>

        {/* ── Search bar ── */}
        <div className="flex items-center gap-2.5 border-b border-[hsl(35,18%,87%)] px-4 py-3.5 dark:border-white/[0.07]">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground/50" strokeWidth={1.9} />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search workspaces, consultations, chats…"
            className="h-9 border-0 bg-transparent px-0 text-[13.5px] font-normal shadow-none placeholder:text-muted-foreground/40 focus-visible:ring-0"
            aria-autocomplete="list"
            aria-controls="palette-list"
            aria-activedescendant={navigableItems[active] ? domId(navigableItems[active].id) : undefined}
          />
        </div>

        {/* ── Results ── */}
        <div
          id="palette-list"
          role="listbox"
          className="max-h-[min(58vh,460px)] overflow-y-auto"
        >
          {!isSearching ? (
            /* ── Browse mode: chip strip + content list ── */
            <>
              {/* Workspace chips */}
              {workspaceItems.length > 0 && (
                <div className="px-3 pb-3 pt-3">
                  <p className="mb-2 text-[9.5px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/40">
                    Navigate
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {workspaceItems.map((item) => {
                      const Icon = item.icon ?? Sparkles;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => select(item)}
                          className="flex items-center gap-1.5 rounded-full border border-black/[0.08] bg-white/80 px-2.5 py-[5px] text-[12px] font-medium text-foreground/75 shadow-[0_1px_2px_rgba(42,28,12,0.06)] transition-all hover:bg-white hover:text-foreground hover:shadow-[0_2px_8px_rgba(42,28,12,0.10)] active:scale-[0.96] dark:border-white/[0.10] dark:bg-white/[0.08] dark:text-foreground/70 dark:hover:bg-white/[0.12]"
                        >
                          <Icon className="h-3 w-3 shrink-0 text-muted-foreground/70" strokeWidth={1.85} />
                          {item.title}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Content groups */}
              {contentGroups.length > 0 && (
                <div className="border-t border-[hsl(35,18%,88%)] pb-2 dark:border-white/[0.07]">
                  {contentGroups.map(({ group, items: groupItems }) => (
                    <div key={group}>
                      <GroupHeader label={GROUP_LABEL[group]} />
                      {groupItems.map((item) => {
                        const index = navigableItems.indexOf(item);
                        return <ContentRow key={item.id} item={item} index={index} active={active} onHover={setActive} onSelect={select} />;
                      })}
                    </div>
                  ))}
                </div>
              )}

              {/* Skeleton for async groups while loading */}
              {asyncLoading && asyncItems.length === 0 && (
                <div className="border-t border-[hsl(35,18%,88%)] pb-2 dark:border-white/[0.07]">
                  <GroupHeader label="My Consultations" />
                  <SkeletonRow />
                  <SkeletonRow />
                </div>
              )}

              {/* Empty content state */}
              {!asyncLoading && contentGroups.length === 0 && (
                <div className="flex flex-col items-center gap-1.5 px-4 py-8 text-center">
                  <MessageSquare className="h-5 w-5 text-muted-foreground/20" strokeWidth={1.5} />
                  <p className="text-[12px] text-muted-foreground/50">No recent activity yet</p>
                </div>
              )}
            </>
          ) : (
            /* ── Search mode: unified ranked list ── */
            <>
              {searchGroups.length === 0 ? (
                <div className="flex flex-col items-center gap-1.5 px-4 py-12 text-center">
                  <Search className="h-6 w-6 text-muted-foreground/20" strokeWidth={1.5} />
                  <p className="text-[12.5px] text-muted-foreground/55">No results for &ldquo;{query}&rdquo;</p>
                </div>
              ) : (
                <div className="pb-2">
                  {searchGroups.map(({ group, items: groupItems }) => (
                    <div key={group}>
                      <GroupHeader label={GROUP_LABEL[group]} />
                      {groupItems.map((item) => {
                        const index = navigableItems.indexOf(item);
                        return <ContentRow key={item.id} item={item} index={index} active={active} onHover={setActive} onSelect={select} />;
                      })}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Footer ── */}
        {(hasContent || isSearching) && (
          <div className="flex items-center gap-4 border-t border-[hsl(35,18%,88%)] px-4 py-2 text-[10px] text-muted-foreground/35 dark:border-white/[0.06]">
            <span>↑↓ navigate</span>
            <span>↵ open</span>
            <span>esc close</span>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

// ── Content row (shared between browse and search mode) ───────────────────────

function ContentRow({
  item, index, active, onHover, onSelect,
}: {
  item: PaletteItem;
  index: number;
  active: number;
  onHover: (i: number) => void;
  onSelect: (item: PaletteItem) => void;
}) {
  const Icon = item.icon ?? Sparkles;
  const isActive = index === active;

  return (
    <div id={domId(item.id)} role="option" aria-selected={isActive}>
      <button
        type="button"
        data-palette-index={index}
        onMouseEnter={() => onHover(index)}
        onClick={() => onSelect(item)}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-xl px-3 py-[7px] text-left transition-colors",
          isActive
            ? "bg-black/[0.05] dark:bg-white/[0.07]"
            : "hover:bg-black/[0.03] dark:hover:bg-white/[0.04]",
        )}
      >
        {/* Small tinted icon circle */}
        <span className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
          GROUP_DOT_BG[item.group],
        )}>
          <Icon className={cn("h-3 w-3", GROUP_DOT_ICON[item.group])} strokeWidth={1.9} />
        </span>

        {/* Text */}
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[13px] font-medium leading-snug text-foreground/85">
              {item.title}
            </span>
            {item.badge && item.badgeVariant && (
              <StatusPill badge={item.badge} badgeVariant={item.badgeVariant} />
            )}
          </span>
          {item.subtitle && (
            <span className="mt-px block truncate text-[11px] leading-snug text-muted-foreground/60">
              {item.subtitle}
            </span>
          )}
        </span>

        {/* Right meta */}
        <span className="shrink-0 text-[10.5px] tabular-nums text-muted-foreground/40">
          {isActive ? "↵" : (item.time ?? "")}
        </span>
      </button>
    </div>
  );
}
