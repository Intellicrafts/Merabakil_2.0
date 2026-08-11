"use client";

import { useCallback, useRef, useState } from "react";
import { FileUp, Loader2, Upload, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface DocumentsUploadZoneProps {
  title: string;
  onTitleChange: (value: string) => void;
  selectedFile: File | null;
  onFileChange: (file: File | null) => void;
  isUploading: boolean;
  onUpload: () => void;
}

export function DocumentsUploadZone({
  title,
  onTitleChange,
  selectedFile,
  onFileChange,
  isUploading,
  onUpload,
}: DocumentsUploadZoneProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const acceptFile = useCallback(
    (file: File | null) => {
      if (!file) {
        onFileChange(null);
        return;
      }
      onFileChange(file);
      if (!title.trim()) {
        onTitleChange(file.name.replace(/\.[^.]+$/, ""));
      }
    },
    [onFileChange, onTitleChange, title],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0] ?? null;
      if (file) acceptFile(file);
    },
    [acceptFile],
  );

  return (
    <section
      className={cn(
        "space-y-3 rounded-2xl border border-black/[0.06] bg-white/60 p-4 shadow-[0_8px_28px_rgba(15,23,42,0.04)] backdrop-blur-xl",
        "dark:border-white/[0.08] dark:bg-white/[0.035]",
        "dc-card-in",
      )}
      style={{ animationDelay: "40ms" }}
    >
      <div className="flex items-center gap-2">
        <Upload className="h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
        <h2 className="text-[12px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          Upload
        </h2>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
        className={cn(
          "cursor-pointer rounded-xl border border-dashed border-black/[0.12] bg-slate-50/70 px-4 py-7 text-center transition-all",
          "hover:border-slate-400/50 hover:bg-slate-50",
          "dark:border-white/15 dark:bg-white/[0.03] dark:hover:bg-white/[0.05]",
          dragOver && "dc-drop-active",
        )}
      >
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,.txt,.doc,.docx"
          className="hidden"
          onChange={(e) => acceptFile(e.target.files?.[0] ?? null)}
        />
        <FileUp className="mx-auto mb-2 h-7 w-7 text-slate-500" strokeWidth={1.5} />
        <p className="text-[13px] font-medium">Drop a file here or click to browse</p>
        <p className="mt-1 text-[11px] text-muted-foreground">PDF, TXT, DOC, DOCX · max size per service limits</p>
      </div>

      {selectedFile && (
        <div className="flex items-center justify-between gap-2 rounded-xl border border-black/[0.06] bg-white/70 px-3 py-2 dark:border-white/10 dark:bg-white/[0.04]">
          <div className="min-w-0">
            <p className="truncate text-[13px] font-medium">{selectedFile.name}</p>
            <p className="text-[11px] text-muted-foreground">
              {(selectedFile.size / 1024).toFixed(1)} KB
            </p>
          </div>
          <button
            type="button"
            aria-label="Clear file"
            onClick={() => {
              acceptFile(null);
              if (fileRef.current) fileRef.current.value = "";
            }}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-slate-100 dark:hover:bg-white/10"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      <Input
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        placeholder="Document title · e.g. Service Agreement 2026"
        className="h-10 rounded-xl border-black/[0.08] bg-white/80 text-[13px] dark:border-white/10 dark:bg-white/[0.04]"
        disabled={isUploading}
      />

      <button
        type="button"
        disabled={!selectedFile || isUploading}
        onClick={onUpload}
        className="dc-btn-accent h-10 w-full rounded-xl text-[13px] font-semibold"
      >
        {isUploading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Upload className="h-4 w-4" />
        )}
        {isUploading ? "Uploading…" : "Upload document"}
      </button>
    </section>
  );
}
