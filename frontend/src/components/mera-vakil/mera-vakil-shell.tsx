"use client";

import { PanelRightOpen } from "lucide-react";

import { cn } from "@/lib/utils";

interface MeraVakilShellProps {
  center: React.ReactNode;
  right: React.ReactNode;
  rightCollapsed?: boolean;
  onOpenRightPanel?: () => void;
}

export function MeraVakilShell({
  center,
  right,
  rightCollapsed = false,
  onOpenRightPanel,
}: MeraVakilShellProps) {
  return (
    <div className="relative flex h-full min-h-0 overflow-hidden">
      <main className="flex min-h-0 min-w-0 flex-1 flex-col" aria-label="Chat conversation">
        {center}
      </main>

      <aside
        className={cn(
          "hidden h-full min-h-0 shrink-0 flex-col overflow-hidden transition-all duration-300 ease-in-out lg:flex",
          rightCollapsed ? "w-0 overflow-hidden opacity-0" : "w-[300px] opacity-100 xl:w-80",
        )}
        aria-label="Session tools and history"
      >
        {right}
      </aside>

      {rightCollapsed && onOpenRightPanel && (
        <button
          type="button"
          onClick={onOpenRightPanel}
          className="fixed right-0 top-1/2 z-40 hidden -translate-y-1/2 rounded-l-xl border border-r-0 border-black/[0.08] bg-white/80 px-2 py-3 shadow-[-4px_0_16px_rgba(15,23,42,0.08)] backdrop-blur-md transition-colors hover:bg-white dark:border-white/10 dark:bg-zinc-900/90 dark:hover:bg-zinc-900 lg:flex"
          aria-label="Open session panel"
        >
          <PanelRightOpen className="h-4 w-4 text-muted-foreground" />
        </button>
      )}
    </div>
  );
}
