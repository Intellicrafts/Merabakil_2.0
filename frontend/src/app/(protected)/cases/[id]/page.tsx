"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Link2 } from "lucide-react";

import { CaseStatusBadge } from "@/components/cases/case-status-badge";
import { CaseTimeline } from "@/components/cases/case-timeline";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import { getCase, updateCaseStatus } from "@/lib/cases-store";
import type { CaseStatus, LegalCase } from "@/lib/types";

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default function CaseDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const [item, setItem] = useState<LegalCase | null | undefined>(undefined);

  useEffect(() => {
    setItem(getCase(params.id) ?? null);
  }, [params.id]);

  if (item === undefined) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (item === null) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 py-12 text-center">
        <p className="text-sm text-muted-foreground">Case not found.</p>
        <Button variant="outline" className="rounded-xl" onClick={() => router.push("/cases")}>
          Back to cases
        </Button>
      </div>
    );
  }

  function handleStatusChange(status: CaseStatus) {
    try {
      const updated = updateCaseStatus(item!.id, status);
      setItem(updated);
      toast({ title: "Status updated", variant: "success" });
    } catch (err) {
      toast({
        title: "Update failed",
        description: (err as Error).message,
        variant: "destructive",
      });
    }
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8">
      <div>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <CaseStatusBadge status={item.status} />
              <span className="text-xs text-muted-foreground">{item.case_number}</span>
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">{item.title}</h1>
            <p className="text-sm text-muted-foreground">
              {item.court} · {item.jurisdiction || "—"}
            </p>
          </div>

          <div className="w-full space-y-1.5 sm:w-48">
            <Label htmlFor="case-status" className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Update status
            </Label>
            <Select
              id="case-status"
              value={item.status}
              onChange={(e) => handleStatusChange(e.target.value as CaseStatus)}
              className="h-11 rounded-xl"
            >
              <option value="open">Open</option>
              <option value="in_progress">In progress</option>
              <option value="closed">Closed</option>
            </Select>
          </div>
        </div>
      </div>

      {item.description && (
        <p className="text-sm leading-relaxed text-muted-foreground">{item.description}</p>
      )}

      <section className="grid gap-3 rounded-2xl border border-black/[0.06] bg-white/55 p-5 backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.035] sm:grid-cols-2">
        <Meta label="Practice area" value={item.practice_area} />
        <Meta label="Created" value={formatDate(item.created_at)} />
        <Meta label="Last updated" value={formatDate(item.updated_at)} />
        <Meta label="Case number" value={item.case_number} />
      </section>

      {item.linked_appointment_id && (
        <div className="flex items-center gap-2 rounded-xl border border-dashed border-black/[0.08] px-4 py-3 text-sm text-muted-foreground dark:border-white/10">
          <Link2 className="h-4 w-4" />
          Linked consultation · {item.linked_appointment_id}
        </div>
      )}

      <section>
        <h2 className="mb-4 text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Timeline
        </h2>
        <div className="rounded-2xl border border-black/[0.06] bg-white/55 p-5 backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.035]">
          <CaseTimeline events={item.timeline} />
        </div>
      </section>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-sm font-medium">{value}</p>
    </div>
  );
}
