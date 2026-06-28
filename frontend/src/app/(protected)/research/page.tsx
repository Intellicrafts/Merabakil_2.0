"use client";

import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { BookOpen, Clock, Search, Sparkles } from "lucide-react";

import { ConfidenceMeter } from "@/components/confidence-meter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { runResearch } from "@/lib/api";
import type { ResearchResponse } from "@/lib/types";

const HISTORY_KEY = "legalos.research.history";
const MAX_HISTORY = 8;

function loadHistory(): string[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) ?? "[]");
  } catch {
    return [];
  }
}

function saveHistory(query: string) {
  const prev = loadHistory().filter((q) => q !== query);
  localStorage.setItem(HISTORY_KEY, JSON.stringify([query, ...prev].slice(0, MAX_HISTORY)));
}

export default function ResearchPage() {
  const [query, setQuery] = useState(
    "What are the essentials of a valid contract under Indian law?",
  );
  const [jurisdiction, setJurisdiction] = useState("");
  const [history, setHistory] = useState<string[]>([]);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  const mutation = useMutation<ResearchResponse, Error>({
    mutationFn: () => runResearch(query, jurisdiction || undefined),
    onSuccess: (data) => {
      saveHistory(data.query);
      setHistory(loadHistory());
    },
  });

  const result = mutation.data;

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Research Console</h1>
        <p className="text-sm text-muted-foreground">
          Grounded legal answers with citations, confidence scoring, and specialist analysis.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[380px_1fr]">
        <div className="space-y-4">
          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Search className="h-4 w-4" /> Ask a legal question
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Describe your legal question or matter..."
                rows={5}
              />
              <Input
                value={jurisdiction}
                onChange={(e) => setJurisdiction(e.target.value)}
                placeholder="Jurisdiction (optional), e.g. Maharashtra"
              />
              <Button
                className="w-full"
                disabled={mutation.isPending || query.trim().length < 3}
                onClick={() => mutation.mutate()}
              >
                <Sparkles className="h-4 w-4" />
                {mutation.isPending ? "Researching..." : "Run research"}
              </Button>
              {mutation.isError && (
                <p className="text-sm text-destructive">{mutation.error.message}</p>
              )}
            </CardContent>
          </Card>

          {history.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <Clock className="h-4 w-4" /> Recent queries
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {history.map((item) => (
                  <button
                    key={item}
                    type="button"
                    className="w-full rounded-md px-2 py-1.5 text-left text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
                    onClick={() => setQuery(item)}
                  >
                    {item.length > 80 ? `${item.slice(0, 80)}…` : item}
                  </button>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-6">
          {mutation.isPending && (
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <Skeleton className="h-5 w-32" />
                </CardHeader>
                <CardContent className="space-y-3">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                  <div className="grid gap-3 pt-2 sm:grid-cols-2">
                    <Skeleton className="h-8 w-full" />
                    <Skeleton className="h-8 w-full" />
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader>
                  <Skeleton className="h-5 w-40" />
                </CardHeader>
                <CardContent className="space-y-3">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
                </CardContent>
              </Card>
            </div>
          )}

          {!result && !mutation.isPending && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center gap-2 py-20 text-center text-muted-foreground">
                <BookOpen className="h-10 w-10 opacity-60" />
                <p className="max-w-md text-sm">
                  Ask a question to get a grounded answer with citations, confidence metrics, and
                  specialist insights.
                </p>
              </CardContent>
            </Card>
          )}

          {result && !mutation.isPending && (
            <>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between gap-2">
                  <CardTitle className="text-base">Assessment</CardTitle>
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary">{result.intent.replace(/_/g, " ")}</Badge>
                    <Badge variant="outline">
                      {result.jurisdiction.level}
                      {result.jurisdiction.region ? ` · ${result.jurisdiction.region}` : ""}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{result.answer}</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <ConfidenceMeter label="Overall confidence" value={result.confidence.overall} />
                    <ConfidenceMeter
                      label="Retrieval strength"
                      value={result.confidence.retrieval_strength}
                    />
                    <ConfidenceMeter
                      label="Source agreement"
                      value={result.confidence.source_agreement}
                    />
                    <ConfidenceMeter label="Coverage" value={result.confidence.coverage} />
                  </div>
                  <p className="rounded-md bg-muted p-3 text-xs text-muted-foreground">
                    {result.disclaimer}
                  </p>
                </CardContent>
              </Card>

              {result.citations.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">
                      Inline citations ({result.citations.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {result.citations.map((cite) => (
                      <div
                        key={`${cite.marker}-${cite.document_id}`}
                        className="flex items-start gap-3 rounded-md border p-3 text-sm"
                      >
                        <Badge variant="outline" className="shrink-0">
                          {cite.marker}
                        </Badge>
                        <div className="min-w-0">
                          <p className="font-medium">{cite.title ?? cite.document_id}</p>
                          <p className="text-xs text-muted-foreground">
                            {[cite.citation, cite.section && `Section ${cite.section}`]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Sources &amp; citations ({result.sources.length})
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {result.sources.length === 0 && (
                    <p className="text-sm text-muted-foreground">No supporting sources retrieved.</p>
                  )}
                  {result.sources.map((source, idx) => (
                    <div key={source.chunk_id} className="rounded-md border p-3">
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">
                          [{idx + 1}] {source.title ?? source.document_id}
                        </span>
                        <Badge variant="outline">{source.retrieval}</Badge>
                      </div>
                      <div className="mb-2 flex flex-wrap gap-2 text-xs text-muted-foreground">
                        {source.citation && <span>{source.citation}</span>}
                        {source.section && <span>Section {source.section}</span>}
                        {source.doc_type && <span>{source.doc_type}</span>}
                        <span>score {source.score.toFixed(3)}</span>
                      </div>
                      <p className="line-clamp-3 text-xs text-muted-foreground">{source.content}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {Object.keys(result.specialist_payload).length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Specialist analysis</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <pre className="max-h-64 overflow-auto rounded-md bg-muted p-3 text-xs">
                      {JSON.stringify(result.specialist_payload, null, 2)}
                    </pre>
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Agent trace</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-wrap gap-2">
                  {result.trace.map((step, idx) => (
                    <Badge key={`${step}-${idx}`} variant="secondary">
                      {step}
                    </Badge>
                  ))}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
