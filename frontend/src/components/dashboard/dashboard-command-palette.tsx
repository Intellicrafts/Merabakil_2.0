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
  conversationId?: string;
}

const GROUP_LABEL: Record<PaletteGroup, string> = {
  workspace:    "Workspaces",
  counsel:      "Recent Chats",
  consultation: "My Consultations",
  docket:       "Cases",
};

const GROUP_ORDER: PaletteGroup[] = ["workspace", "counsel", "consultation", "docket"];

function domId(id: string): string {
  return `palette-opt-${id.replace(/[^a-zA-Z0-9_-]/g, "-")}`;
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

  const consultations: PaletteItem[] = apts
    .filter((a) => !["cancelled", "expired", "no_show"].includes(a.status))
    .slice(0, 5)
    .map((a) => ({
      id: `apt:${a.id}`,
      group: "consultation" as const,
      title: a.counterpart_name || a.lawyer_name || a.citizen_name || "Consultation",
      subtitle: `${a.matter_summary || "Legal consultation"} · ${a.date}`,
      href: `/appointments/${a.id}`,
      icon: CalendarClock,
    }));

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
  const [syncItems, setSyncItems] = useState<PaletteItem[]>([]);
  const [asyncItems, setAsyncItems] = useState<PaletteItem[]>([]);
  const [mounted, setMounted] = useState(false);

  const items = useMemo(() => [...syncItems, ...asyncItems], [syncItems, asyncItems]);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActive(0);
    setSyncItems(collectSyncItems(user));
    setAsyncItems([]);
    void collectAsyncItems().then(setAsyncItems).catch(() => {});

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

  useEffect(() => {
    setActive(0);
  }, [query]);

  useEffect(() => {
    const el = document.querySelector<HTMLElement>(`[data-palette-index="${active}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [active, filtered.length]);

  function close() {
    onOpenChange(false);
  }

  function select(item: PaletteItem) {
    close();
    markNavigationStart();
    router.push(item.href);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActive((i) => Math.min(i + 1, Math.max(filtered.length - 1, 0)));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const item = filtered[active];
      if (item) select(item);
    }
  }

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-start justify-center px-4 pt-[12vh] sm:pt-[16vh]">
      <button
        type="button"
        className="dash-palette-veil absolute inset-0"
        aria-label="Close command palette"
        onClick={close}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="command-palette-title"
        className="relative z-[81] w-full max-w-lg overflow-hidden rounded-3xl border border-black/[0.08] bg-white/95 shadow-[0_24px_80px_rgba(15,23,42,0.28)] backdrop-blur-2xl dark:border-white/10 dark:bg-[hsl(220_14%_9%/0.96)]"
        onKeyDown={onKeyDown}
      >
        <div className="border-b border-black/[0.06] px-3 py-3 dark:border-white/[0.08]">
          <h2 id="command-palette-title" className="sr-only">
            Jump to
          </h2>
          <div className="flex items-center gap-2">
            <Search className="ml-2 h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
            <Input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Jump to workspace, consultation, or chat…"
              className="h-10 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0"
              aria-autocomplete="list"
              aria-controls="command-palette-list"
              aria-activedescendant={filtered[active] ? domId(filtered[active].id) : undefined}
            />
            <kbd className="dash-kbd mr-1">Esc</kbd>
          </div>
        </div>

        <ul
          id="command-palette-list"
          role="listbox"
          className="max-h-[min(52vh,420px)] overflow-y-auto p-2"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-10 text-center text-[13px] text-muted-foreground">
              No matches
            </li>
          ) : (
            groups.map(({ group, items: groupItems }) => (
              <li key={group} className="mb-1.5">
                <p className="px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                  {GROUP_LABEL[group]}
                </p>
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
                            "flex w-full items-center gap-3 rounded-2xl px-2.5 py-2 text-left",
                            isActive
                              ? "bg-black/[0.05] dark:bg-white/[0.08]"
                              : "hover:bg-black/[0.03] dark:hover:bg-white/[0.04]",
                          )}
                        >
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-black/[0.06] bg-white/80 dark:border-white/[0.08] dark:bg-white/[0.06]">
                            <Icon className="h-3.5 w-3.5 text-muted-foreground" strokeWidth={1.75} />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-medium tracking-tight">
                              {item.title}
                            </span>
                            <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                              {item.subtitle}
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))
          )}
        </ul>
      </div>
    </div>,
    document.body,
  );
}
