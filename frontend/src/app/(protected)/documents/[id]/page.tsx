"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";

import { DocumentAnswerPanel } from "@/components/documents/document-answer-panel";
import { DocumentDetailHero } from "@/components/documents/document-detail-hero";
import { DocumentPassagesPanel } from "@/components/documents/document-passages-panel";
import { DocumentQueryDock } from "@/components/documents/document-query-dock";
import { Skeleton } from "@/components/ui/skeleton";
import { getUserDocument, streamResearch } from "@/lib/api";
import type { ResearchResponse } from "@/lib/types";

export default function DocumentDetailPage() {
  const params = useParams<{ id: string }>();
  const documentId = params.id;
  const [query, setQuery] = useState("Summarize the key obligations in this document.");
  const [result, setResult] = useState<ResearchResponse | null>(null);
  const [streamedAnswer, setStreamedAnswer] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const docQuery = useQuery({
    queryKey: ["user-document", documentId],
    queryFn: () => getUserDocument(documentId),
  });

  const stopResearch = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
  }, []);

  const run = useCallback(async () => {
    const q = query.trim();
    if (q.length < 3) return;

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setError(null);
    setResult(null);
    setStreamedAnswer("");
    setIsStreaming(true);

    try {
      const data = await streamResearch(
        q,
        undefined,
        [],
        {
          onToken: (token) => {
            setStreamedAnswer((prev) => prev + token);
          },
        },
        { documentId, signal: controller.signal },
      );

      setResult(data);
      setStreamedAnswer(data.answer);
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err instanceof Error ? err.message : "Research failed");
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
      setIsStreaming(false);
    }
  }, [query, documentId]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const showEmpty = !result && !isStreaming && !streamedAnswer;

  return (
    <div className="mx-auto w-full max-w-[1120px] space-y-5 pb-8 md:space-y-6">
      {docQuery.isLoading && (
        <div className="rounded-2xl border border-black/[0.06] bg-white/50 p-5 dark:border-white/[0.08]">
          <Skeleton className="mb-3 h-10 w-10 rounded-xl" />
          <Skeleton className="mb-2 h-6 w-1/2" />
          <Skeleton className="h-4 w-1/3" />
        </div>
      )}

      {docQuery.isError && (
        <p className="rounded-xl border border-red-500/20 bg-red-500/5 px-3 py-2.5 text-[13px] text-red-700 dark:text-red-300">
          {(docQuery.error as Error).message}
        </p>
      )}

      {docQuery.data && <DocumentDetailHero document={docQuery.data} />}

      <div className="grid gap-5 lg:grid-cols-[340px_1fr] lg:items-start">
        <DocumentQueryDock
          query={query}
          onQueryChange={setQuery}
          isStreaming={isStreaming}
          error={error}
          onRun={run}
          onStop={stopResearch}
        />

        <div className="space-y-4 min-w-0">
          {showEmpty && (
            <div
              className="rounded-2xl border border-dashed border-black/[0.1] bg-white/40 px-4 py-12 text-center dark:border-white/12 dark:bg-white/[0.02] dc-card-in"
            >
              <p className="text-[13px] font-medium">Ask a question about this file</p>
              <p className="mt-1 text-[12px] text-muted-foreground">
                Answers are grounded in passages retrieved from your document.
              </p>
            </div>
          )}

          {isStreaming && !streamedAnswer && (
            <div className="space-y-3 rounded-2xl border border-black/[0.06] bg-white/50 p-5 dark:border-white/[0.08] dark:bg-white/[0.03]">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          )}

          {(result || streamedAnswer) && (
            <DocumentAnswerPanel
              result={result}
              streamedAnswer={streamedAnswer}
              isStreaming={isStreaming}
            />
          )}

          {result && !isStreaming && <DocumentPassagesPanel result={result} />}
        </div>
      </div>
    </div>
  );
}
