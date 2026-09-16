"use client";

import { ChevronRight } from "lucide-react";

import { PresenceDot } from "@/components/admin/admin-ops-utils";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AppointmentRecord } from "@/lib/appointment-types";
import { cn } from "@/lib/utils";

const STATUSES = ["", "requested", "confirmed", "live", "completed", "expired", "cancelled", "no_show"];

interface AppointmentQueueProps {
  items: AppointmentRecord[];
  total: number;
  loading?: boolean;
  error?: Error | null;
  status: string;
  emergencyFilter: string;
  search: string;
  onStatusChange: (v: string) => void;
  onEmergencyFilterChange: (v: string) => void;
  onSearchChange: (v: string) => void;
  onSelect: (id: string) => void;
}

function rowClass(row: AppointmentRecord) {
  if (row.emergency_status === "open") return "border-l-2 border-l-amber-500";
  if (row.emergency_status === "ack") return "border-l-2 border-l-orange-400";
  return "";
}

export function AppointmentQueue({
  items,
  total,
  loading,
  error,
  status,
  emergencyFilter,
  search,
  onStatusChange,
  onEmergencyFilterChange,
  onSearchChange,
  onSelect,
}: AppointmentQueueProps) {
  const filters = (
    <div className="flex w-full flex-wrap gap-2 sm:w-auto">
      <select
        value={status}
        onChange={(e) => onStatusChange(e.target.value)}
        className="h-9 rounded-xl border border-black/[0.08] bg-background px-3 text-[13px] dark:border-white/10"
      >
        {STATUSES.map((s) => (
          <option key={s || "all"} value={s}>
            {s ? s.replace("_", " ") : "All statuses"}
          </option>
        ))}
      </select>
      <select
        value={emergencyFilter}
        onChange={(e) => onEmergencyFilterChange(e.target.value)}
        className="h-9 rounded-xl border border-black/[0.08] bg-background px-3 text-[13px] dark:border-white/10"
      >
        <option value="">All emergencies</option>
        <option value="open">Open only</option>
        <option value="ack">Acknowledged</option>
        <option value="resolved">Resolved</option>
      </select>
      <Input
        value={search}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder="Search name or matter"
        className="h-9 w-full rounded-xl sm:w-48"
      />
    </div>
  );

  function initials(name: string): string {
    return name
      .split(/\s+/)
      .slice(0, 2)
      .map((p) => p[0]?.toUpperCase() ?? "")
      .join("");
  }

  return (
    <Card className="min-h-[320px] max-h-[calc(100dvh-280px)] flex flex-col">
      <CardHeader className="gap-3 sm:flex-row sm:items-center sm:justify-between">
        <CardTitle className="text-base">Queue ({total})</CardTitle>
        <div className="hidden sm:block">{filters}</div>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col">
        <div className="mb-3 sm:hidden">{filters}</div>
        {error ? (
          <div className="mb-3 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error.message || "Could not load appointments."}
          </div>
        ) : null}
        {loading ? (
          <div className="space-y-2">
            <Skeleton className="h-10 w-full rounded-xl" />
            <Skeleton className="h-10 w-full rounded-xl" />
          </div>
        ) : items.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No appointments match this filter.</p>
        ) : (
          <>
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto md:hidden">
            {items.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => onSelect(row.id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-2xl border border-black/[0.06] bg-background/80 p-3 text-left transition hover:border-primary/30 hover:shadow-sm dark:border-white/10",
                  rowClass(row),
                )}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-[12px] font-semibold">
                  {initials(row.citizen_name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{row.citizen_name}</p>
                  <p className="text-[12px] text-muted-foreground">{row.lawyer_name}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">
                    {row.date} · {row.time_slot}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <Badge variant="secondary" className="capitalize text-[10px]">
                    {row.status.replace("_", " ")}
                  </Badge>
                  {row.emergency_status !== "none" && row.emergency_status !== "resolved" ? (
                    <Badge className="bg-amber-600 text-[10px] capitalize">{row.emergency_status}</Badge>
                  ) : null}
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </button>
            ))}
          </div>
          <div className="hidden min-h-0 flex-1 overflow-x-auto overflow-y-auto md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Parties</TableHead>
                  <TableHead>Slot</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Presence</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((row) => (
                  <TableRow
                    key={row.id}
                    className={cn("cursor-pointer hover:bg-muted/40", rowClass(row))}
                    onClick={() => onSelect(row.id)}
                  >
                    <TableCell className="min-w-[160px]">
                      <p className="font-medium">{row.citizen_name}</p>
                      <p className="text-xs text-muted-foreground">{row.lawyer_name}</p>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">
                      {row.date} · {row.time_slot}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="capitalize">
                        {row.status.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="capitalize text-xs">
                      {row.emergency_status !== "none" && row.emergency_status !== "resolved" ? (
                        <span className="font-semibold text-amber-700 dark:text-amber-300">{row.emergency_status}</span>
                      ) : (
                        row.priority ?? "normal"
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <PresenceDot on={Boolean(row.citizen_present)} /> C
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <PresenceDot on={Boolean(row.lawyer_present)} /> L
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
