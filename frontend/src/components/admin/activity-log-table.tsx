"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import { formatClock } from "@/components/admin/admin-ops-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ActivityLogEntry } from "@/lib/appointment-types";
import { cn } from "@/lib/utils";

interface ActivityLogTableProps {
  items: ActivityLogEntry[];
  total: number;
  page: number;
  loading?: boolean;
  onPageChange: (page: number) => void;
}

export function ActivityLogTable({ items, total, page, loading, onPageChange }: ActivityLogTableProps) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const pages = Math.max(1, Math.ceil(total / 50));

  return (
    <div className="flex h-full min-h-[320px] flex-col rounded-2xl border border-black/[0.06] dark:border-white/10">
      <div className="border-b border-black/[0.06] px-4 py-3 dark:border-white/10">
        <p className="text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">Activity log</p>
        <p className="text-[11px] text-muted-foreground">{total} events recorded</p>
      </div>
      <div className="flex-1 overflow-y-auto">
        {loading && items.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">Loading logs…</p>
        ) : items.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">No activity recorded yet.</p>
        ) : (
          <ul className="divide-y divide-black/[0.04] dark:divide-white/[0.06]">
            {items.map((row) => (
              <li key={row.id} className="px-4 py-3">
                <button
                  type="button"
                  className="flex w-full items-start gap-2 text-left"
                  onClick={() => setExpanded((prev) => (prev === row.id ? null : row.id))}
                >
                  {expanded === row.id ? (
                    <ChevronDown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[12px] font-medium">{row.summary}</span>
                      <Badge variant="outline" className="rounded-md text-[10px] capitalize">
                        {row.actor_role}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {row.actor_name || "System"} · {formatClock(row.created_at)}
                    </p>
                    {expanded === row.id ? (
                      <pre className="mt-2 max-h-32 overflow-auto rounded-lg bg-muted/40 p-2 text-[10px]">
                        {JSON.stringify(row.payload, null, 2)}
                      </pre>
                    ) : null}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      {pages > 1 ? (
        <div className="flex items-center justify-between border-t border-black/[0.06] px-4 py-2 dark:border-white/10">
          <Button size="sm" variant="outline" className="rounded-lg" disabled={page <= 1 || loading} onClick={() => onPageChange(page - 1)}>
            Previous
          </Button>
          <span className="text-[11px] text-muted-foreground">
            Page {page} of {pages}
          </span>
          <Button
            size="sm"
            variant="outline"
            className="rounded-lg"
            disabled={page >= pages || loading}
            onClick={() => onPageChange(page + 1)}
          >
            Next
          </Button>
        </div>
      ) : null}
    </div>
  );
}
