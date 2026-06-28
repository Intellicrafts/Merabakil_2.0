"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Database, Loader2, RefreshCw, Upload } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import {
  getJob,
  listCategories,
  listIngestionJobs,
  listKnowledgeDocuments,
  uploadDocument,
} from "@/lib/api";
import type { Category, IngestionJob } from "@/lib/types";

function jobProgress(status: string): number {
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

export default function KnowledgeHubPage() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [tab, setTab] = useState("upload");
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [title, setTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [activeJobs, setActiveJobs] = useState<string[]>([]);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const categoriesQuery = useQuery({
    queryKey: ["categories"],
    queryFn: listCategories,
  });

  const documentsQuery = useQuery({
    queryKey: ["knowledge-documents"],
    queryFn: () => listKnowledgeDocuments(1, 50),
  });

  const jobsQuery = useQuery({
    queryKey: ["ingestion-jobs"],
    queryFn: () => listIngestionJobs(1, 20),
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
      }
      setTitle("");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
    },
    onError: (err: Error) => {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    },
  });

  const allJobs: IngestionJob[] = [
    ...(jobsQuery.data?.items ?? []),
    ...activeJobs
      .filter((id) => !jobsQuery.data?.items.some((j) => j.job_id === id))
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
      ),
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
          <Database className="h-6 w-6 text-primary" />
          Knowledge Hub
        </h1>
        <p className="text-sm text-muted-foreground">
          Ingest corpus documents, monitor jobs, and browse the indexed library.
        </p>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="upload">Upload</TabsTrigger>
          <TabsTrigger value="jobs">Job queue</TabsTrigger>
          <TabsTrigger value="corpus">Corpus browser</TabsTrigger>
        </TabsList>

        <TabsContent value="upload">
          <div className="grid gap-6 lg:grid-cols-[300px_1fr]">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Category</CardTitle>
                <CardDescription>Select a corpus folder to ingest into.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {categoriesQuery.isLoading && <Skeleton className="h-10 w-full" />}
                {categoriesQuery.data && (
                  <>
                    <Select
                      value={selectedCategory?.doc_type ?? ""}
                      onChange={(e) => {
                        const cat = categoriesQuery.data.find((c) => c.doc_type === e.target.value);
                        if (cat) setSelectedCategory(cat);
                      }}
                    >
                      {categoriesQuery.data.map((cat) => (
                        <option key={cat.doc_type} value={cat.doc_type}>
                          {cat.doc_type} ({cat.jurisdiction})
                        </option>
                      ))}
                    </Select>
                    {selectedCategory && (
                      <div className="space-y-2 rounded-md bg-muted p-3 text-xs text-muted-foreground">
                        <p className="font-medium text-foreground">{selectedCategory.purpose}</p>
                        <p>{selectedCategory.ingestion_tips}</p>
                        <p>
                          Recommended: {selectedCategory.recommended_min_pdfs}–
                          {selectedCategory.recommended_optimal_pdfs} PDFs
                        </p>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Upload className="h-4 w-4" /> Upload zone
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="k-title">Title</Label>
                  <Input
                    id="k-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="Document title"
                  />
                </div>
                <div
                  className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 bg-muted/30 px-6 py-10 text-center"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const dropped = e.dataTransfer.files[0];
                    if (dropped) setFile(dropped);
                  }}
                >
                  <Upload className="mb-2 h-8 w-8 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    Drag &amp; drop a PDF or text file, or browse below.
                  </p>
                  <Input
                    ref={fileRef}
                    type="file"
                    accept=".pdf,.txt"
                    className="mt-4 max-w-xs"
                    onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  />
                  {file && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
                    </p>
                  )}
                </div>
                <Button
                  disabled={!file || !selectedCategory || uploadMutation.isPending}
                  onClick={() => uploadMutation.mutate()}
                >
                  {uploadMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  Ingest document
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="jobs">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Ingestion jobs</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={() => queryClient.invalidateQueries({ queryKey: ["ingestion-jobs"] })}
              >
                <RefreshCw className="h-4 w-4" /> Refresh
              </Button>
            </CardHeader>
            <CardContent>
              {jobsQuery.isLoading && <Skeleton className="h-24 w-full" />}
              {jobsQuery.isError && allJobs.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Job list unavailable. Active uploads are still tracked locally.
                </p>
              )}
              {allJobs.length === 0 && !jobsQuery.isLoading && (
                <p className="py-8 text-center text-sm text-muted-foreground">No jobs yet.</p>
              )}
              {allJobs.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Progress</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allJobs.map((job) => (
                      <TableRow key={job.job_id}>
                        <TableCell className="font-medium">{job.title || job.job_id}</TableCell>
                        <TableCell>{job.doc_type || "—"}</TableCell>
                        <TableCell>
                          <Badge
                            variant={job.status === "indexed" ? "default" : "secondary"}
                            className={job.status === "failed" ? "bg-destructive text-destructive-foreground" : undefined}
                          >
                            {job.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="min-w-[120px]">
                          <Progress
                            value={jobProgress(job.status)}
                            indicatorClassName={
                              job.status === "failed" ? "bg-destructive" : undefined
                            }
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="corpus">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Indexed corpus</CardTitle>
            </CardHeader>
            <CardContent>
              {documentsQuery.isLoading && <Skeleton className="h-32 w-full" />}
              {documentsQuery.isError && (
                <p className="text-sm text-destructive">{(documentsQuery.error as Error).message}</p>
              )}
              {documentsQuery.data?.items.length === 0 && (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No documents in the corpus yet.
                </p>
              )}
              {documentsQuery.data && documentsQuery.data.items.length > 0 && (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Jurisdiction</TableHead>
                      <TableHead>Chunks</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {documentsQuery.data.items.map((doc) => (
                      <TableRow key={doc.document_id}>
                        <TableCell className="font-medium">{doc.title}</TableCell>
                        <TableCell>{doc.doc_type}</TableCell>
                        <TableCell>{doc.jurisdiction ?? "—"}</TableCell>
                        <TableCell>{doc.chunk_count}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{doc.status}</Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
