"use client";

import { FileSpreadsheet, FileText, FileType } from "lucide-react";

import { cn } from "@/lib/utils";

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function fileKind(name: string, contentType = ""): "pdf" | "word" | "sheet" | "text" {
  const lower = name.toLowerCase();
  if (lower.endsWith(".pdf") || contentType.includes("pdf")) return "pdf";
  if (lower.endsWith(".doc") || lower.endsWith(".docx") || contentType.includes("word")) return "word";
  if (lower.endsWith(".csv") || contentType.includes("csv")) return "sheet";
  return "text";
}

function KindIcon({ kind }: { kind: ReturnType<typeof fileKind> }) {
  const cls = "h-4 w-4";
  if (kind === "pdf") return <FileText className={cn(cls, "text-red-700 dark:text-red-400")} />;
  if (kind === "word") return <FileType className={cn(cls, "text-sky-700 dark:text-sky-400")} />;
  if (kind === "sheet") return <FileSpreadsheet className={cn(cls, "text-emerald-700 dark:text-emerald-400")} />;
  return <FileText className={cn(cls, "text-amber-800 dark:text-amber-300")} />;
}

export function ChatFileCard({
  name,
  size,
  contentType,
  onOpen,
  tone = "light",
}: {
  name: string;
  size?: number;
  contentType?: string;
  onOpen?: () => void;
  tone?: "light" | "onDark";
}) {
  const kind = fileKind(name, contentType);
  const label = kind === "pdf" ? "PDF" : kind === "word" ? "Word" : kind === "sheet" ? "CSV" : "Text";
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "flex max-w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left transition-colors",
        tone === "onDark"
          ? "border-white/15 bg-white/10 text-white hover:bg-white/15"
          : "border-black/[0.07] bg-white shadow-sm hover:border-amber-800/25 dark:border-white/10 dark:bg-zinc-900 dark:hover:border-amber-500/30",
      )}
    >
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
          tone === "onDark" ? "bg-white/10" : "bg-amber-50 dark:bg-amber-950/40",
        )}
      >
        <KindIcon kind={kind} />
      </span>
      <span className="min-w-0">
        <span className="block truncate text-[12.5px] font-medium">{name}</span>
        <span className={cn("block text-[11px]", tone === "onDark" ? "text-white/70" : "text-muted-foreground")}>
          {label}
          {typeof size === "number" ? ` · ${formatFileSize(size)}` : ""}
        </span>
      </span>
    </button>
  );
}
