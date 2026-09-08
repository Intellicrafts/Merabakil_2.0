"use client";

import { useEffect, useState } from "react";
import { Download, Loader2, X } from "lucide-react";

import { ChatFileCard, fileKind } from "@/components/mera-vakil/chat-file-card";
import { fetchDocumentFile, getDocumentText } from "@/lib/api";

export interface PreviewTarget {
  id: string;
  name: string;
  size?: number;
  contentType?: string;
}

export function DocumentPreviewDialog({
  target,
  onClose,
}: {
  target: PreviewTarget | null;
  onClose: () => void;
}) {
  const [text, setText] = useState<string | null>(null);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    if (!target) return;
    let revoked: string | null = null;
    let cancelled = false;
    setLoading(true);
    setError(null);
    setText(null);
    setFileUrl(null);

    const kind = fileKind(target.name, target.contentType);
    void (async () => {
      try {
        if (kind === "pdf") {
          const blob = await fetchDocumentFile(target.id);
          if (cancelled) return;
          const url = URL.createObjectURL(blob);
          revoked = url;
          setFileUrl(url);
        } else {
          const body = await getDocumentText(target.id);
          if (cancelled) return;
          setText(body.text || "No extracted text is available yet.");
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not open this file.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      if (revoked) URL.revokeObjectURL(revoked);
    };
  }, [target]);

  if (!target) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-slate-950/45 backdrop-blur-[2px]" aria-label="Close preview" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Preview ${target.name}`}
        className="relative z-[81] flex max-h-[86vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-black/[0.08] bg-white shadow-2xl dark:border-white/10 dark:bg-zinc-950"
      >
        <div className="flex items-center justify-between gap-3 border-b border-black/[0.06] px-4 py-3 dark:border-white/10">
          <ChatFileCard name={target.name} size={target.size} contentType={target.contentType} />
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={downloading}
              onClick={async () => {
                setDownloading(true);
                try {
                  const blob = await fetchDocumentFile(target.id);
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement("a");
                  link.href = url;
                  link.download = target.name;
                  link.click();
                  URL.revokeObjectURL(url);
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Could not download this file.");
                } finally {
                  setDownloading(false);
                }
              }}
              className="flex h-9 items-center gap-1.5 rounded-full px-3 text-[12px] text-muted-foreground hover:bg-black/[0.05] hover:text-foreground disabled:opacity-40 dark:hover:bg-white/10"
              aria-label={`Download ${target.name}`}
            >
              {downloading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
              Download
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground hover:bg-black/[0.05] hover:text-foreground dark:hover:bg-white/10"
              aria-label="Close preview"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
        <div className="min-h-[240px] flex-1 overflow-auto bg-slate-50 p-4 dark:bg-black/30">
          {loading && (
            <div className="flex h-48 items-center justify-center text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Opening document…
            </div>
          )}
          {error && <p className="text-sm text-red-700 dark:text-red-400">{error}</p>}
          {fileUrl && <iframe title={target.name} src={fileUrl} className="h-[70vh] w-full rounded-lg bg-white" />}
          {text && (
            <div className="space-y-2">
              {fileKind(target.name, target.contentType) === "word" && (
                <p className="text-[12px] text-muted-foreground">Preview from extracted text</p>
              )}
              <pre className="whitespace-pre-wrap rounded-xl border border-black/[0.06] bg-white p-4 text-[13px] leading-relaxed text-slate-800 dark:border-white/10 dark:bg-zinc-900 dark:text-slate-100">
                {text}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
