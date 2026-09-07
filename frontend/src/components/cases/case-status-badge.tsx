import { Badge } from "@/components/ui/badge";
import type { CaseStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

const STYLES: Record<CaseStatus, string> = {
  draft: "border-transparent bg-violet-500/10 text-violet-800 dark:text-violet-300",
  open: "border-transparent bg-sky-500/10 text-sky-800 dark:text-sky-300",
  in_progress: "border-transparent bg-amber-500/10 text-amber-800 dark:text-amber-300",
  closed: "border-transparent bg-slate-500/10 text-slate-700 dark:text-slate-300",
};

const LABELS: Record<CaseStatus, string> = {
  draft: "Draft",
  open: "Open",
  in_progress: "In progress",
  closed: "Closed",
};

export function CaseStatusBadge({ status }: { status: CaseStatus }) {
  return <Badge className={cn(STYLES[status] ?? STYLES.open)}>{LABELS[status] ?? status}</Badge>;
}
