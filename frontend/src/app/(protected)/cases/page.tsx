"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { CaseFormDialog } from "@/components/cases/case-form-dialog";
import { CaseTable } from "@/components/cases/case-table";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { listCasesApi, listCasesSharedWithMe } from "@/lib/api";
import { getStoredUser } from "@/lib/api";
import type { CaseStatus, LegalCase } from "@/lib/types";

type TabValue = "draft" | "open" | "in_progress" | "closed" | "shared";

const LAWYER_ROLES = new Set(["advocate", "law_firm", "admin"]);

function isLawyerRole(roles: string[]): boolean {
  return roles.some((r) => LAWYER_ROLES.has(r));
}

function CaseListSkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(4)].map((_, i) => (
        <Skeleton key={i} className="h-20 w-full rounded-2xl md:h-12" />
      ))}
    </div>
  );
}

export default function CasesPage() {
  const [tab, setTab] = useState<TabValue>("open");
  const [createOpen, setCreateOpen] = useState(false);
  const qc = useQueryClient();
  const [isLawyer, setIsLawyer] = useState(false);

  useEffect(() => {
    const user = getStoredUser();
    setIsLawyer(user ? isLawyerRole(user.roles) : false);
  }, []);

  const isSharedTab = tab === "shared";

  const { data: ownCases, isLoading: ownLoading } = useQuery({
    queryKey: ["cases", tab],
    queryFn: () => listCasesApi(isSharedTab ? null : (tab as CaseStatus)),
    enabled: !isSharedTab,
    staleTime: 30_000,
  });

  const { data: sharedCases, isLoading: sharedLoading } = useQuery({
    queryKey: ["cases-shared"],
    queryFn: () => listCasesSharedWithMe(),
    enabled: isSharedTab,
    staleTime: 30_000,
  });

  const cases: LegalCase[] = isSharedTab
    ? (sharedCases?.items ?? [])
    : (ownCases?.items ?? []);

  const isLoading = isSharedTab ? sharedLoading : ownLoading;

  function handleCreated(item: LegalCase) {
    qc.invalidateQueries({ queryKey: ["cases"] });
  }

  return (
    <div className="mx-auto w-full max-w-[1120px] space-y-6">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">Case Management</h1>
          <p className="text-sm text-muted-foreground">
            Track legal matters, hearings, and status updates in one place.
          </p>
        </div>
        {!isSharedTab && (
          <Button className="min-h-11 rounded-xl" onClick={() => setCreateOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            New case
          </Button>
        )}
      </header>

      <Tabs value={tab} onValueChange={(v) => setTab(v as TabValue)}>
        <TabsList className="h-11 flex-wrap rounded-xl bg-black/[0.04] p-1 dark:bg-white/[0.06]">
          <TabsTrigger value="draft" className="min-h-9 rounded-lg px-4">
            Draft
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
          {isLawyer && (
            <TabsTrigger value="shared" className="min-h-9 rounded-lg px-4">
              Shared with me
            </TabsTrigger>
          )}
        </TabsList>
      </Tabs>

      {isLoading ? <CaseListSkeleton /> : <CaseTable cases={cases} />}

      <CaseFormDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={handleCreated}
      />
    </div>
  );
}
