"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ResearchAnswerPanel } from "@/components/research/research-answer-panel";
import { ResearchEmptyState } from "@/components/research/research-empty-state";
import { ResearchHero } from "@/components/research/research-hero";
import { ResearchLivePipeline } from "@/components/research/research-live-pipeline";
import { ResearchQueryDock } from "@/components/research/research-query-dock";
import { ResearchSourcesPanel } from "@/components/research/research-sources-panel";
import { Skeleton } from "@/components/ui/skeleton";
import { streamResearch } from "@/lib/api";
import { loadResearchHistory, saveResearchHistory } from "@/lib/research-history";
import type { ResearchResponse } from "@/lib/types";

export default function ResearchPage() {
  const [query, setQuery] = useState(
    "What are the essentials of a valid contract under Indian law?",
  );
  const [jurisdiction, setJurisdiction] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [result, setResult] = useState<ResearchResponse | null>(null);
  const [streamedAnswer, setStreamedAnswer] = useState("");
  const [activeStage, setActiveStage] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setHistory(loadResearchHistory());
  }, []);

  const stopResearch = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsStreaming(false);
    setStatusMessage(null);
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
    setActiveStage("intent");
    setStatusMessage("Understanding your question…");
    setIsStreaming(true);

    try {
      const data = await streamResearch(
        q,
        jurisdiction.trim() || undefined,
        [],
        {
          onStatus: (stage, message) => {
            setActiveStage(stage);
            setStatusMessage(message);
          },
          onToken: (token) => {
            setStatusMessage("Drafting your answer…");
            setActiveStage("answer");
            setStreamedAnswer((prev) => prev + token);
          },
        },
        { signal: controller.signal },
      );

      setResult(data);
      setStreamedAnswer(data.answer);
      setHistory(saveResearchHistory(data.query));
      setActiveStage(null);
      setStatusMessage(null);
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(err instanceof Error ? err.message : "Research failed");
      setActiveStage(null);
      setStatusMessage(null);
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
      }
      setIsStreaming(false);
    }
  }, [query, jurisdiction]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const showEmpty = !result && !isStreaming && !streamedAnswer;
  const showSkeleton = isStreaming && !streamedAnswer && !result;

  return (
    <div className="mx-auto w-full max-w-[1120px] space-y-5 pb-8 md:space-y-6">
      <ResearchHero />

      <div className="grid gap-5 lg:grid-cols-[340px_1fr] lg:items-start">
        <ResearchQueryDock
          query={query}
          jurisdiction={jurisdiction}
          history={history}
          isStreaming={isStreaming}
          error={error}
          onQueryChange={setQuery}
          onJurisdictionChange={setJurisdiction}
          onRun={run}
          onStop={stopResearch}
          onPickHistory={(item) => setQuery(item)}
        />

        <div className="space-y-4 min-w-0">
          {(isStreaming || activeStage) && (
            <ResearchLivePipeline
              activeStage={activeStage}
              statusMessage={statusMessage}
              streaming={isStreaming}
            />
          )}

          {showEmpty && (
            <ResearchEmptyState
              disabled={isStreaming}
              onPickPrompt={(prompt) => setQuery(prompt)}
            />
          )}

          {showSkeleton && (
            <div className="space-y-3 rounded-2xl border border-black/[0.06] bg-white/50 p-5 dark:border-white/[0.08] dark:bg-white/[0.03]">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <div className="grid gap-3 pt-2 sm:grid-cols-2">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </div>
            </div>
          )}

          {(result || streamedAnswer) && (
            <ResearchAnswerPanel
              result={result}
              streamedAnswer={streamedAnswer}
              isStreaming={isStreaming}
              onPickSuggestion={(text) => setQuery(text)}
            />
          )}

          {result && !isStreaming && <ResearchSourcesPanel result={result} />}
        </div>
      </div>
    </div>
  );
}
