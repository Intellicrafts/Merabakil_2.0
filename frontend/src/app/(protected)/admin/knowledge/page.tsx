"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { KnowledgeCategoryRail } from "@/components/knowledge/knowledge-category-rail";
import { KnowledgeCorpusGrid } from "@/components/knowledge/knowledge-corpus-grid";
import { KnowledgeGraphPanel } from "@/components/knowledge/knowledge-graph-panel";
import { KnowledgeHero } from "@/components/knowledge/knowledge-hero";
import { KnowledgeJobsPanel } from "@/components/knowledge/knowledge-jobs-panel";
import { KnowledgeTabs, type KnowledgeTab } from "@/components/knowledge/knowledge-tabs";
import { KnowledgeUploadDock } from "@/components/knowledge/knowledge-upload-dock";
import { useToast } from "@/components/ui/toast";
import {
  getJob,
  getKnowledgeGraph,
  listCategories,
  listIngestionJobs,
  listKnowledgeDocuments,
  reindexKnowledgeDocument,
  uploadDocument,
} from "@/lib/api";
import { isJobActive } from "@/lib/knowledge-ui";
import type { Category, IngestionJob } from "@/lib/types";

export default function KnowledgeHubPage() {
  const [tab, setTab] = useState<KnowledgeTab>("ingest");
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileKey, setFileKey] = useState(0);
  const [activeJobs, setActiveJobs] = useState<string[]>([]);
  const [corpusFilter, setCorpusFilter] = useState<string | null>(null);
  const [reindexingId, setReindexingId] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: listCategories,
  });

  const allDocsQuery = useQuery({
    queryKey: ["knowledge-documents", "all"],
    queryFn: () => listKnowledgeDocuments(1, 50),
  });

  const documentsQuery = useQuery({
    queryKey: ["knowledge-documents", corpusFilter ?? "all"],
    queryFn: () => listKnowledgeDocuments(1, 50, corpusFilter ?? undefined),
  });

  const jobsQuery = useQuery({
    queryKey: ["ingestion-jobs"],
    queryFn: () => listIngestionJobs(1, 20),
    retry: false,
  });

  const graphQuery = useQuery({
    queryKey: ["knowledge-graph"],
    queryFn: () => getKnowledgeGraph(200),
    enabled: tab === "graph",
    retry: false,
  });

  useEffect(() => {
    if (categoriesQuery.data?.length && !selectedCategory) {
      setSelectedCategory(categoriesQuery.data[0]);
    }
  }, [categoriesQuery.data, selectedCategory]);

  const pollJob = useCallback(
    async (jobId: string) => {
      try {
        const job = await getJob(jobId);
        if (job.status === "indexed" || job.status === "failed") {
          setActiveJobs((prev) => prev.filter((id) => id !== jobId));
          queryClient.invalidateQueries({ queryKey: ["knowledge-documents"] });
          queryClient.invalidateQueries({ queryKey: ["ingestion-jobs"] });
          queryClient.invalidateQueries({ queryKey: ["knowledge-graph"] });
          toast({
            title: job.status === "indexed" ? "Ingestion complete" : "Ingestion failed",
            description: job.title,
            variant: job.status === "failed" ? "destructive" : "success",
          });
        }
      } catch {
        /* polling errors are non-fatal */
      }
    },
    [queryClient, toast],
  );

  useEffect(() => {
    if (activeJobs.length === 0) return;
    const timer = window.setInterval(() => {
      activeJobs.forEach((id) => pollJob(id));
    }, 3000);
    return () => window.clearInterval(timer);
  }, [activeJobs, pollJob]);

  const uploadMutation = useMutation({
    mutationFn: () => {
      if (!file || !selectedCategory) throw new Error("Select a category and file");
      return uploadDocument(file, {
        title: title || file.name,
        doc_type: selectedCategory.doc_type,
        jurisdiction: selectedCategory.jurisdiction,
        async_mode: file.size > 500_000,
      });
    },
    onSuccess: (res) => {
      if (res.kind === "job") {
        setActiveJobs((prev) => [...prev, res.data.job_id]);
        toast({ title: "Upload queued", description: res.data.job_id, variant: "success" });
        setTab("jobs");
      } else {
        toast({ title: "Document indexed", description: res.data.title, variant: "success" });
        queryClient.invalidateQueries({ queryKey: ["knowledge-documents"] });
        queryClient.invalidateQueries({ queryKey: ["knowledge-graph"] });
      }
      setTitle("");
      setFile(null);
      setFileKey((k) => k + 1);
    },
    onError: (err: Error) => {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    },
  });

  const handleReindex = useCallback(
    async (documentId: string) => {
      setReindexingId(documentId);
      try {
        const result = await reindexKnowledgeDocument(documentId, true);
        toast({
          title: result.status === "unchanged" ? "Already up to date" : "Re-indexed",
          description: `${result.title} · ${result.chunk_count} chunks`,
          variant: "success",
        });
        queryClient.invalidateQueries({ queryKey: ["knowledge-documents"] });
        queryClient.invalidateQueries({ queryKey: ["knowledge-graph"] });
      } catch (err) {
        toast({
          title: "Re-index failed",
          description: err instanceof Error ? err.message : "Unknown error",
          variant: "destructive",
        });
      } finally {
        setReindexingId(null);
      }
    },
    [queryClient, toast],
  );

  const allJobs: IngestionJob[] = useMemo(() => {
    const remote = jobsQuery.data?.items ?? [];
    const placeholders = activeJobs
      .filter((id) => !remote.some((j) => j.job_id === id))
      .map(
        (id): IngestionJob => ({
          job_id: id,
          status: "processing",
          title: "Processing…",
          doc_type: "",
          document_id: null,
          chunk_count: 0,
          error: null,
        }),
      );
    return [...placeholders, ...remote];
  }, [jobsQuery.data?.items, activeJobs]);

  const activeJobCount = useMemo(
    () =>
      allJobs.filter((j) => isJobActive(j.status)).length || activeJobs.length,
    [allJobs, activeJobs.length],
  );

  const filterTypes = useMemo(() => {
    const types = new Set<string>();
    for (const doc of allDocsQuery.data?.items ?? []) {
      if (doc.doc_type) types.add(doc.doc_type);
    }
    for (const cat of categoriesQuery.data ?? []) {
      if (cat.doc_type) types.add(cat.doc_type);
    }
    return Array.from(types).sort();
  }, [allDocsQuery.data?.items, categoriesQuery.data]);

  const corpusCount = allDocsQuery.data?.total ?? allDocsQuery.data?.items.length;

  return (
    <div className="mx-auto w-full max-w-[1120px] space-y-5 pb-8 md:space-y-6">
      <KnowledgeHero
        categoryCount={categoriesQuery.data?.length}
        corpusCount={corpusCount}
        activeJobCount={activeJobCount}
      />

      <KnowledgeTabs value={tab} onChange={setTab} jobBadge={activeJobCount} />

      {tab === "ingest" && (
        <div className="grid gap-5 lg:grid-cols-[300px_1fr] lg:items-start">
          <KnowledgeCategoryRail
            categories={categoriesQuery.data ?? []}
            selected={selectedCategory}
            onSelect={setSelectedCategory}
            isLoading={categoriesQuery.isLoading}
          />
          <KnowledgeUploadDock
            key={fileKey}
            category={selectedCategory}
            title={title}
            onTitleChange={setTitle}
            selectedFile={file}
            onFileChange={setFile}
            isUploading={uploadMutation.isPending}
            onUpload={() => uploadMutation.mutate()}
          />
        </div>
      )}

      {tab === "jobs" && (
        <KnowledgeJobsPanel
          jobs={allJobs}
          isLoading={jobsQuery.isLoading}
          isError={jobsQuery.isError}
          onRefresh={() => queryClient.invalidateQueries({ queryKey: ["ingestion-jobs"] })}
        />
      )}

      {tab === "corpus" && (
        <KnowledgeCorpusGrid
          documents={documentsQuery.data?.items ?? []}
          filterTypes={filterTypes}
          activeFilter={corpusFilter}
          onFilterChange={setCorpusFilter}
          isLoading={documentsQuery.isLoading}
          isError={documentsQuery.isError}
          errorMessage={
            documentsQuery.isError ? (documentsQuery.error as Error).message : undefined
          }
          onReindex={handleReindex}
          reindexingId={reindexingId}
        />
      )}

      {tab === "graph" && (
        <KnowledgeGraphPanel
          graph={graphQuery.data}
          isLoading={graphQuery.isLoading}
          isError={graphQuery.isError}
          errorMessage={graphQuery.isError ? (graphQuery.error as Error).message : undefined}
          onRefresh={() => queryClient.invalidateQueries({ queryKey: ["knowledge-graph"] })}
        />
      )}
    </div>
  );
}
