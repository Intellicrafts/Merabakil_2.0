"use client";

import { useQuery } from "@tanstack/react-query";
import { FileText, ImageIcon, Search } from "lucide-react";

import { VoiceVisualizer } from "@/components/mera-vakil/voice-visualizer";
import { Badge } from "@/components/ui/badge";
import { listUserDocuments } from "@/lib/api";
import type { ResearchResponse } from "@/lib/types";
import { cn } from "@/lib/utils";

interface ContextPanelProps {
  documentId: string | null;
  jurisdiction: string;
  onDocumentChange: (id: string | null) => void;
  onJurisdictionChange: (value: string) => void;
  latestResearch: ResearchResponse | null;
  isSpeaking?: boolean;
}

export function ContextPanel({
  documentId,
  jurisdiction,
  onDocumentChange,
  onJurisdictionChange,
  latestResearch,
  isSpeaking = false,
}: ContextPanelProps) {
  const { data: docsPage } = useQuery({
    queryKey: ["user-documents", "mera-vakil"],
    queryFn: () => listUserDocuments(1, 50),
  });

  const docs = docsPage?.items ?? [];

  return (
    <div className="glass-panel flex h-full min-h-0 flex-col overflow-hidden px-4 pb-4 pt-4">
      <div className="px-1 pb-4">
        <h2 className="text-sm font-semibold">Context &amp; Tools</h2>
        <p className="text-xs text-muted-foreground">Scope your research and explore sources</p>
      </div>

      <div className="no-scrollbar -mx-1 flex-1 space-y-5 overflow-y-auto px-1">
        {/* Voice visualizer */}
        <section aria-label="Voice visualizer preview">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Voice
          </p>
          <VoiceVisualizer isActive={isSpeaking} />
        </section>

        {/* Document scope */}
        <section aria-label="Document scope">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Research scope
          </p>
          <div className="space-y-2">
            <select
              className="w-full rounded-2xl border-0 bg-white/50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400/50 dark:bg-white/5"
              value={documentId ?? ""}
              onChange={(e) => onDocumentChange(e.target.value || null)}
              aria-label="Select document scope"
            >
              <option value="">Full corpus (all knowledge)</option>
              {docs.map((doc) => (
                <option key={doc.document_id} value={doc.document_id}>
                  {doc.title}
                </option>
              ))}
            </select>
            <input
              type="text"
              className="w-full rounded-2xl border-0 bg-white/50 px-3 py-2.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-slate-400/50 dark:bg-white/5"
              placeholder="Jurisdiction (optional)"
              value={jurisdiction}
              onChange={(e) => onJurisdictionChange(e.target.value)}
              aria-label="Jurisdiction filter"
            />
          </div>
        </section>

        {/* Media sandbox */}
        <section aria-label="Media sandbox">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Media sandbox
          </p>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              className="flex flex-col items-center gap-2 rounded-2xl bg-white/40 p-4 text-xs text-muted-foreground transition-colors hover:bg-white/60 dark:bg-white/5 dark:hover:bg-white/10"
              aria-label="Image upload coming soon"
              disabled
            >
              <ImageIcon className="h-5 w-5" />
              <span>Images</span>
              <Badge variant="outline" className="text-[10px]">
                Soon
              </Badge>
            </button>
            <button
              type="button"
              className="flex flex-col items-center gap-2 rounded-2xl bg-white/40 p-4 text-xs text-muted-foreground transition-colors hover:bg-white/60 dark:bg-white/5 dark:hover:bg-white/10"
              aria-label="Document search"
            >
              <Search className="h-5 w-5" />
              <span>Search</span>
            </button>
          </div>
        </section>

        {/* Latest sources */}
        {latestResearch && latestResearch.web_sources?.length > 0 && (
          <section aria-label="Web sources">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Web sources ({latestResearch.web_sources.length})
            </p>
            <ul className="space-y-2">
              {latestResearch.web_sources.slice(0, 4).map((source) => (
                <li key={source.url} className="rounded-2xl bg-white/40 p-3 text-xs dark:bg-white/5">
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-slate-700 hover:underline dark:text-slate-300"
                  >
                    {source.title}
                  </a>
                  <p className="mt-1 line-clamp-3 text-muted-foreground">{source.snippet}</p>
                </li>
              ))}
            </ul>
          </section>
        )}

        {latestResearch && latestResearch.sources.length > 0 && (
          <section aria-label="Latest sources">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Latest sources ({latestResearch.sources.length})
            </p>
            <ul className="space-y-2">
              {latestResearch.sources.slice(0, 5).map((source, idx) => (
                <li
                  key={source.chunk_id}
                  className={cn("rounded-2xl bg-white/40 p-3 text-xs dark:bg-white/5")}
                >
                  <div className="flex items-start gap-2">
                    <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-500" />
                    <div className="min-w-0">
                      <p className="font-medium truncate">
                        [{idx + 1}] {source.title ?? source.document_id}
                      </p>
                      <p className="mt-1 line-clamp-2 text-muted-foreground">{source.content}</p>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {latestResearch && latestResearch.trace.length > 0 && (
          <section aria-label="Agent trace">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Agent trace
            </p>
            <div className="flex flex-wrap gap-1.5">
              {latestResearch.trace.map((step, idx) => (
                <Badge key={`${step}-${idx}`} variant="secondary" className="rounded-full text-[10px]">
                  {step}
                </Badge>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}
