"use client";

import { UserMinus, UserX } from "lucide-react";

import { formatClock, PresenceDot } from "@/components/admin/admin-ops-utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ModerationState } from "@/lib/appointment-types";
import { cn } from "@/lib/utils";

interface PartyModerationCardProps {
  label: string;
  present: boolean;
  moderation?: ModerationState;
  onKick?: () => void;
  onSuspend?: (minutes: 5 | 15 | 30) => void;
  onAllowRejoin?: () => void;
  disabled?: boolean;
}

export function PartyModerationCard({
  label,
  present,
  moderation,
  onKick,
  onSuspend,
  onAllowRejoin,
  disabled,
}: PartyModerationCardProps) {
  const blocked = moderation?.status === "kicked" || moderation?.status === "suspended";

  return (
    <div className="rounded-2xl border border-black/[0.06] bg-background/60 p-3 dark:border-white/10">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-semibold">{label}</p>
        <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <PresenceDot on={present} />
          {present ? "Present" : "Away"}
        </span>
      </div>
      {blocked && (
        <div className="mt-2 rounded-xl border border-amber-500/30 bg-amber-50/60 px-2 py-1.5 text-[11px] dark:bg-amber-950/20">
          <Badge variant="outline" className="mb-1 capitalize">
            {moderation?.status}
          </Badge>
          {moderation?.reason ? <p>{moderation.reason}</p> : null}
          {moderation?.suspended_until ? (
            <p className="text-muted-foreground">Until {formatClock(moderation.suspended_until)}</p>
          ) : null}
        </div>
      )}
      <div className="mt-2 flex flex-wrap gap-1.5">
        {blocked && onAllowRejoin ? (
          <Button size="sm" className="h-7 rounded-lg text-[11px]" disabled={disabled} onClick={onAllowRejoin}>
            Allow rejoin
          </Button>
        ) : (
          <>
            {onKick ? (
              <Button
                size="sm"
                variant="outline"
                className={cn("h-7 rounded-lg text-[11px]", "text-red-700 dark:text-red-300")}
                disabled={disabled}
                onClick={onKick}
              >
                <UserMinus className="mr-1 h-3 w-3" />
                Kick
              </Button>
            ) : null}
            {onSuspend
              ? ([5, 15, 30] as const).map((m) => (
                  <Button
                    key={m}
                    size="sm"
                    variant="outline"
                    className="h-7 rounded-lg text-[11px]"
                    disabled={disabled}
                    onClick={() => onSuspend(m)}
                  >
                    <UserX className="mr-1 h-3 w-3" />
                    {m}m
                  </Button>
                ))
              : null}
          </>
        )}
      </div>
    </div>
  );
}
