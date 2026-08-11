"use client";

import Link from "next/link";
import { FolderOpen } from "lucide-react";

import { CaseStatusBadge } from "@/components/cases/case-status-badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { LegalCase } from "@/lib/types";
import { cn } from "@/lib/utils";

function formatUpdated(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

interface CaseTableProps {
  cases: LegalCase[];
}

export function CaseTable({ cases }: CaseTableProps) {
  if (cases.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-black/[0.08] py-16 text-center dark:border-white/10">
        <FolderOpen className="mx-auto mb-3 h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm font-medium">No cases found</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Create a new case or change the status filter.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Mobile cards */}
      <ul className="space-y-3 md:hidden">
        {cases.map((item) => (
          <li key={item.id}>
            <Link
              href={`/cases/${item.id}`}
              className={cn(
                "block rounded-2xl border border-black/[0.06] bg-white/55 p-4 backdrop-blur-xl",
                "dark:border-white/[0.08] dark:bg-white/[0.035]",
              )}
            >
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold tracking-tight">{item.title}</p>
                <CaseStatusBadge status={item.status} />
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{item.case_number}</p>
              <p className="mt-2 text-sm text-muted-foreground">
                {item.court} · {item.practice_area}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Updated {formatUpdated(item.updated_at)}
              </p>
            </Link>
          </li>
        ))}
      </ul>

      {/* Desktop table */}
      <div className="hidden overflow-hidden rounded-2xl border border-black/[0.06] bg-white/55 backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.035] md:block">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Title</TableHead>
              <TableHead>Case #</TableHead>
              <TableHead>Court</TableHead>
              <TableHead>Practice area</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Updated</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cases.map((item) => (
              <TableRow key={item.id} className="cursor-pointer hover:bg-black/[0.02] dark:hover:bg-white/[0.03]">
                <TableCell>
                  <Link href={`/cases/${item.id}`} className="font-medium hover:underline">
                    {item.title}
                  </Link>
                </TableCell>
                <TableCell className="text-muted-foreground">{item.case_number}</TableCell>
                <TableCell className="text-muted-foreground">{item.court}</TableCell>
                <TableCell className="text-muted-foreground">{item.practice_area}</TableCell>
                <TableCell>
                  <CaseStatusBadge status={item.status} />
                </TableCell>
                <TableCell className="text-muted-foreground">
                  {formatUpdated(item.updated_at)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </>
  );
}
