"use client";

import { cn } from "@/lib/utils";

interface MeraVakilShellProps {
  left: React.ReactNode;
  center: React.ReactNode;
  right: React.ReactNode;
  leftCollapsed?: boolean;
  rightCollapsed?: boolean;
}

export function MeraVakilShell({
  left,
  center,
  right,
  leftCollapsed = false,
  rightCollapsed = false,
}: MeraVakilShellProps) {
  return (
    <div className="flex h-full min-h-0 overflow-hidden">
      <aside
        className={cn(
          "hidden h-full min-h-0 shrink-0 flex-col overflow-hidden transition-all duration-300 ease-in-out lg:flex",
          leftCollapsed ? "w-16" : "w-72",
        )}
        aria-label="Chat history and navigation"
      >
        {left}
      </aside>

      <main className="flex min-h-0 min-w-0 flex-1 flex-col" aria-label="Chat conversation">
        {center}
      </main>

      <aside
        className={cn(
          "hidden h-full min-h-0 shrink-0 flex-col overflow-hidden transition-all duration-300 ease-in-out xl:flex",
          rightCollapsed ? "w-0 overflow-hidden" : "w-80",
        )}
        aria-label="Context and tools"
      >
        {right}
      </aside>
    </div>
  );
}
