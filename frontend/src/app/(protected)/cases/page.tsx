"use client";

import { useMemo, useState } from "react";
import { Plus } from "lucide-react";

import { CaseFormDialog } from "@/components/cases/case-form-dialog";
import { CaseTable } from "@/components/cases/case-table";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { listCases } from "@/lib/cases-store";
import type { CaseStatus } from "@/lib/types";

type StatusFilter = "all" | CaseStatus;

export default function CasesPage() {
  const [status, setStatus] = useState<StatusFilter>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [version, setVersion] = useState(0);

  const cases = useMemo(
    () => listCases(status),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [status, version],
  );

  return (
    <div className="mx-auto w-full max-w-[1120px] space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Case Management</h1>
          <p className="text-sm text-muted-foreground">
            Track legal matters, hearings, and status updates in one place.
          </p>
        </div>
        <Button className="min-h-11 rounded-xl" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          New case
        </Button>
      </header>

      <Tabs value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
        <TabsList className="h-11 flex-wrap rounded-xl bg-black/[0.04] p-1 dark:bg-white/[0.06]">
          <TabsTrigger value="all" className="min-h-9 rounded-lg px-4">
            All
          </TabsTrigger>
          <TabsTrigger value="open" className="min-h-9 rounded-lg px-4">
            Open
          </TabsTrigger>
          <TabsTrigger value="in_progress" className="min-h-9 rounded-lg px-4">
            In progress
          </TabsTrigger>
          <TabsTrigger value="closed" className="min-h-9 rounded-lg px-4">
            Closed
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <CaseTable cases={cases} />

      <CaseFormDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => setVersion((v) => v + 1)}
      />
    </div>
  );
}
