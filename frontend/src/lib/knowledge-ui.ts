export function jobProgress(status: string): number {
  switch (status) {
    case "pending":
      return 15;
    case "processing":
      return 55;
    case "indexed":
      return 100;
    case "failed":
      return 100;
    default:
      return 0;
  }
}

export function jobStatusTone(status: string): string {
  const s = status.toLowerCase();
  if (s === "indexed") {
    return "border-emerald-500/25 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300";
  }
  if (s === "failed") {
    return "border-red-500/25 bg-red-500/10 text-red-800 dark:text-red-300";
  }
  if (s === "processing" || s === "pending") {
    return "border-amber-500/25 bg-amber-500/10 text-amber-900 dark:text-amber-300";
  }
  return "border-slate-300/70 bg-slate-100 text-slate-700 dark:border-white/15 dark:bg-white/10 dark:text-zinc-200";
}

export function formatKnowledgeStatus(status: string): string {
  return status.replace(/_/g, " ");
}

export function isJobActive(status: string): boolean {
  const s = status.toLowerCase();
  return s === "pending" || s === "processing";
}
