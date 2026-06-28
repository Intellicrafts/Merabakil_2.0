"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, FileText, Sparkles } from "lucide-react";

import { ConfidenceMeter } from "@/components/confidence-meter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { getUserDocument, runDocumentResearch } from "@/lib/api";

export default function DocumentDetailPage() {
  const params = useParams<{ id: string }>();
  const documentId = params.id;
  const [query, setQuery] = useState("Summarize the key obligations in this document.");

  const docQuery = useQuery({
    queryKey: ["user-document", documentId],
    queryFn: () => getUserDocument(documentId),
  });

  const researchMutation = useMutation({
    mutationFn: () => runDocumentResearch(documentId, query),
  });

  const result = researchMutation.data;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/documents">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Document Q&amp;A</h1>
          <p className="text-sm text-muted-foreground">
            Research scoped to a single uploaded document.
          </p>
        </div>
      </div>

      {docQuery.isLoading && <Skeleton className="h-24 w-full" />}
      {docQuery.data && (
        <Card>
          <CardHeader className="flex flex-row items-center gap-3 pb-3">
            <FileText className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-base">{docQuery.data.title}</CardTitle>
              <p className="text-xs text-muted-foreground">
                ID {docQuery.data.document_id} · {docQuery.data.status}
              </p>
            </div>
          </CardHeader>
        </Card>
      )}
      {docQuery.isError && (
        <p className="text-sm text-destructive">{(docQuery.error as Error).message}</p>
      )}

      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="text-base">Ask about this document</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              rows={5}
              placeholder="What would you like to know?"
            />
            <Button
              className="w-full"
              disabled={researchMutation.isPending || query.trim().length < 3}
              onClick={() => researchMutation.mutate()}
            >
              <Sparkles className="h-4 w-4" />
              {researchMutation.isPending ? "Analyzing..." : "Run scoped research"}
            </Button>
            {researchMutation.isError && (
              <p className="text-sm text-destructive">{researchMutation.error.message}</p>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {researchMutation.isPending && (
            <Card>
              <CardContent className="space-y-3 py-6">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </CardContent>
            </Card>
          )}

          {result && (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Answer</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{result.answer}</p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <ConfidenceMeter label="Overall confidence" value={result.confidence.overall} />
                    <ConfidenceMeter label="Coverage" value={result.confidence.coverage} />
                  </div>
                </CardContent>
              </Card>

              {result.sources.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Passages ({result.sources.length})</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {result.sources.map((source, idx) => (
                      <div key={source.chunk_id} className="rounded-md border p-3 text-sm">
                        <div className="mb-1 flex items-center justify-between">
                          <span className="font-medium">[{idx + 1}] {source.section ?? "excerpt"}</span>
                          <Badge variant="outline">{source.score.toFixed(3)}</Badge>
                        </div>
                        <p className="text-xs text-muted-foreground">{source.content}</p>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
