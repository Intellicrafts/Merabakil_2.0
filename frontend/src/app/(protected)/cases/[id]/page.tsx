"use client";

import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowUpRight,
  Clock,
  FileText,
  FolderOpen,
  Scale,
  Sparkles,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";

import { CaseStatusBadge } from "@/components/cases/case-status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/components/ui/toast";
import {
  getCaseApi,
  getStoredUser,
  listAppointmentsByCaseId,
  listUserDocuments,
  shareCase,
  updateCaseApi,
  uploadCaseDocument,
} from "@/lib/api";
import type { AiBrief, LegalCase } from "@/lib/types";

// Document category options
const DOC_CATEGORIES = [
  { value: "identity_proof", label: "Identity Proof" },
  { value: "agreement", label: "Agreement / Contract" },
  { value: "property_doc", label: "Property Document" },
  { value: "court_order", label: "Court Order / Judgment" },
  { value: "fir", label: "FIR / Police Report" },
  { value: "legal_notice", label: "Legal Notice" },
  { value: "correspondence", label: "Correspondence" },
  { value: "financial", label: "Financial Document" },
  { value: "medical", label: "Medical Record" },
  { value: "other", label: "Other" },
];

function formatDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function UrgencyBadge({ urgency }: { urgency?: string }) {
  if (!urgency) return null;
  const styles: Record<string, string> = {
    high: "border-transparent bg-red-500/10 text-red-800 dark:text-red-300",
    medium: "border-transparent bg-amber-500/10 text-amber-800 dark:text-amber-300",
    low: "border-transparent bg-green-500/10 text-green-800 dark:text-green-300",
  };
  return (
    <Badge className={styles[urgency] ?? styles.medium}>
      {urgency.charAt(0).toUpperCase() + urgency.slice(1)} urgency
    </Badge>
  );
}

function BriefSection({ brief, isOwner }: { brief: AiBrief; isOwner: boolean }) {
  const hasContent =
    brief.problem_summary ||
    (brief.key_facts?.length ?? 0) > 0 ||
    (brief.legal_issues?.length ?? 0) > 0;

  if (!hasContent) {
    return (
      <p className="text-[13px] text-muted-foreground">
        No AI brief available for this case yet.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      {brief.problem_summary && (
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Problem Summary
          </p>
          <p className="text-[13px] leading-relaxed text-foreground">{brief.problem_summary}</p>
        </div>
      )}

      {(brief.key_facts?.length ?? 0) > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Key Facts
          </p>
          <ul className="space-y-1.5">
            {brief.key_facts!.map((fact, i) => (
              <li key={i} className="flex items-start gap-2 text-[13px]">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                {fact}
              </li>
            ))}
          </ul>
        </div>
      )}

      {brief.parties && (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Parties
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {brief.parties.client && (
              <div className="rounded-lg border border-black/[0.06] bg-muted/30 px-3 py-2.5 dark:border-white/[0.08]">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Client ({brief.parties.client.role ?? "Petitioner"})
                </p>
                <p className="mt-0.5 text-[13px] font-medium">{brief.parties.client.name ?? "—"}</p>
              </div>
            )}
            {brief.parties.opponent && (
              <div className="rounded-lg border border-black/[0.06] bg-muted/30 px-3 py-2.5 dark:border-white/[0.08]">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Opponent ({brief.parties.opponent.type ?? "Individual"})
                </p>
                <p className="mt-0.5 text-[13px] font-medium">{brief.parties.opponent.name ?? "—"}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {(brief.legal_issues?.length ?? 0) > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Legal Issues
          </p>
          <ul className="space-y-1.5">
            {brief.legal_issues!.map((issue, i) => (
              <li key={i} className="flex items-start gap-2 text-[13px]">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" />
                {issue}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ActionsSection({ brief }: { brief: AiBrief }) {
  const hasActions = (brief.recommended_actions?.length ?? 0) > 0;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <UrgencyBadge urgency={brief.urgency} />
        {brief.practice_area && (
          <Badge variant="outline" className="text-[11px]">
            {brief.practice_area}
          </Badge>
        )}
        {brief.jurisdiction && (
          <Badge variant="outline" className="text-[11px]">
            {brief.jurisdiction}
          </Badge>
        )}
      </div>

      {hasActions && (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Recommended Actions
          </p>
          <ol className="space-y-2">
            {brief.recommended_actions!.map((action, i) => (
              <li key={i} className="flex items-start gap-2 text-[13px]">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-semibold text-primary">
                  {i + 1}
                </span>
                {action}
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}

function DocumentsSection({ caseId, isOwner }: { caseId: string; isOwner: boolean }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [docType, setDocType] = useState("other");
  const [uploading, setUploading] = useState(false);

  const { data: docsPage, isLoading } = useQuery({
    queryKey: ["case-docs", caseId],
    queryFn: () => listUserDocuments(1, 50, caseId),
    staleTime: 30_000,
  });

  const docs = docsPage?.items ?? [];

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      await uploadCaseDocument(caseId, file, {
        title: file.name.replace(/\.[^.]+$/, "") || file.name,
        doc_type: docType,
      });
      toast({ title: "Document uploaded", variant: "success" });
      qc.invalidateQueries({ queryKey: ["case-docs", caseId] });
    } catch {
      toast({ title: "Upload failed", variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-4">
      {isOwner && (
        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={docType}
            onChange={(e) => setDocType(e.target.value)}
            className="h-9 w-48 rounded-lg text-[13px]"
          >
            {DOC_CATEGORIES.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
          </Select>
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            size="sm"
            variant="outline"
            className="h-9 gap-1.5 rounded-lg text-[13px]"
            disabled={uploading}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="h-3.5 w-3.5" />
            {uploading ? "Uploading…" : "Upload document"}
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-lg" />)}
        </div>
      ) : docs.length === 0 ? (
        <div className="rounded-lg border border-dashed border-black/[0.08] py-10 text-center dark:border-white/10">
          <FolderOpen className="mx-auto mb-2 h-7 w-7 text-muted-foreground/40" />
          <p className="text-[13px] text-muted-foreground">No documents yet</p>
        </div>
      ) : (
        <ul className="space-y-2">
          {docs.map((doc) => {
            const catLabel =
              DOC_CATEGORIES.find((c) => c.value === doc.doc_type)?.label ?? doc.doc_type;
            return (
              <li
                key={doc.document_id}
                className="flex items-center gap-3 rounded-lg border border-black/[0.06] bg-white/50 px-4 py-2.5 dark:border-white/[0.08] dark:bg-white/[0.04]"
              >
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground/60" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[13px] font-medium">{doc.title}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {catLabel}
                    {doc.created_at
                      ? ` · ${new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short" }).format(new Date(doc.created_at))}`
                      : ""}
                  </p>
                </div>
                <Badge variant="outline" className="shrink-0 text-[11px]">
                  {doc.status}
                </Badge>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function ShareSection({ caseItem }: { caseItem: LegalCase }) {
  const { toast } = useToast();
  const [lawyerUserId, setLawyerUserId] = useState("");
  const [message, setMessage] = useState("");
  const [sharing, setSharing] = useState(false);

  async function handleShare() {
    if (!lawyerUserId.trim()) return;
    setSharing(true);
    try {
      await shareCase(caseItem.id, lawyerUserId.trim(), message.trim());
      toast({ title: "Case shared", variant: "success" });
      setLawyerUserId("");
      setMessage("");
    } catch {
      toast({ title: "Failed to share case", variant: "destructive" });
    } finally {
      setSharing(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="lawyer-uid" className="text-[12px]">
          Lawyer User ID
        </Label>
        <input
          id="lawyer-uid"
          type="text"
          value={lawyerUserId}
          onChange={(e) => setLawyerUserId(e.target.value)}
          placeholder="Paste lawyer's user ID"
          className="h-9 w-full rounded-lg border border-input bg-background px-3 text-[13px] placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="share-message" className="text-[12px]">
          Message (optional)
        </Label>
        <textarea
          id="share-message"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={2}
          placeholder="Add a note for the lawyer…"
          className="w-full resize-none rounded-lg border border-input bg-background px-3 py-2 text-[13px] placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
      </div>
      <Button
        size="sm"
        className="gap-1.5 rounded-lg text-[13px]"
        disabled={!lawyerUserId.trim() || sharing}
        onClick={handleShare}
      >
        <Users className="h-3.5 w-3.5" />
        {sharing ? "Sharing…" : "Share with lawyer"}
      </Button>
    </div>
  );
}

export default function CaseDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { toast } = useToast();
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [statusUpdating, setStatusUpdating] = useState(false);

  useEffect(() => {
    const user = getStoredUser();
    setCurrentUserId(user?.user_id ?? null);
  }, []);

  const { data: caseItem, isLoading, error } = useQuery({
    queryKey: ["case", params.id],
    queryFn: () => getCaseApi(params.id),
    staleTime: 30_000,
    retry: 1,
  });

  const { data: linkedAppointments } = useQuery({
    queryKey: ["case-appointments", params.id],
    queryFn: () => listAppointmentsByCaseId(params.id),
    staleTime: 60_000,
    retry: 1,
    enabled: !!caseItem,
  });

  const qc = useQueryClient();

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (error || !caseItem) {
    return (
      <div className="mx-auto max-w-3xl space-y-4 py-12 text-center">
        <p className="text-sm text-muted-foreground">
          {error ? "Failed to load case." : "Case not found."}
        </p>
        <Button variant="outline" className="rounded-xl" onClick={() => router.push("/cases")}>
          Back to cases
        </Button>
      </div>
    );
  }

  const isOwner = caseItem.owner_id === currentUserId;
  const brief = caseItem.ai_brief ?? {};
  const hasBrief = Object.keys(brief).length > 0;

  async function handleStatusChange(newStatus: string) {
    setStatusUpdating(true);
    try {
      await updateCaseApi(params.id, { status: newStatus });
      qc.invalidateQueries({ queryKey: ["case", params.id] });
      qc.invalidateQueries({ queryKey: ["cases"] });
      toast({ title: "Status updated", variant: "success" });
    } catch {
      toast({ title: "Update failed", variant: "destructive" });
    } finally {
      setStatusUpdating(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-4xl space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <CaseStatusBadge status={caseItem.status} />
            {caseItem.source === "saarthi" && (
              <Badge className="border-transparent bg-violet-500/10 text-[11px] text-violet-800 dark:text-violet-300">
                <Sparkles className="mr-1 h-3 w-3" />
                AI-extracted
              </Badge>
            )}
            {caseItem.case_number && (
              <span className="text-xs text-muted-foreground">{caseItem.case_number}</span>
            )}
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{caseItem.title}</h1>
          {(caseItem.court || caseItem.jurisdiction) && (
            <p className="text-sm text-muted-foreground">
              {[caseItem.court, caseItem.jurisdiction].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>

        {isOwner && (
          <div className="w-full space-y-1.5 sm:w-44">
            <Label htmlFor="case-status" className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Update status
            </Label>
            <Select
              id="case-status"
              value={caseItem.status}
              onChange={(e) => void handleStatusChange(e.target.value)}
              className="h-10 rounded-xl"
              disabled={statusUpdating}
            >
              <option value="draft">Draft</option>
              <option value="open">Open</option>
              <option value="in_progress">In progress</option>
              <option value="closed">Closed</option>
            </Select>
          </div>
        )}
      </div>

      {/* Meta row */}
      <section className="grid gap-3 rounded-2xl border border-black/[0.06] bg-white/55 p-5 backdrop-blur-xl dark:border-white/[0.08] dark:bg-white/[0.035] sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Practice area", value: caseItem.practice_area || "—" },
          { label: "Jurisdiction", value: caseItem.jurisdiction || "—" },
          { label: "Created", value: formatDate(caseItem.created_at) },
          { label: "Last updated", value: formatDate(caseItem.updated_at) },
        ].map(({ label, value }) => (
          <div key={label}>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {label}
            </p>
            <p className="mt-1 text-sm font-medium">{value}</p>
          </div>
        ))}
      </section>

      {caseItem.description && (
        <p className="text-sm leading-relaxed text-muted-foreground">{caseItem.description}</p>
      )}

      {/* AI Brief + Actions */}
      {hasBrief ? (
        <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-[15px]">
                <Sparkles className="h-4 w-4 text-violet-500" />
                Case Brief
              </CardTitle>
              <CardDescription className="text-[12px]">
                AI-extracted from your Saarthi conversation
              </CardDescription>
            </CardHeader>
            <CardContent>
              <BriefSection brief={brief} isOwner={isOwner} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-[15px]">Next Steps</CardTitle>
            </CardHeader>
            <CardContent>
              <ActionsSection brief={brief} />
            </CardContent>
          </Card>
        </div>
      ) : (
        caseItem.source === "saarthi" && (
          <div className="flex items-center gap-2 rounded-xl border border-dashed border-violet-300/60 bg-violet-50/50 px-4 py-3 text-[13px] text-violet-800 dark:border-violet-700/40 dark:bg-violet-900/20 dark:text-violet-300">
            <Clock className="h-4 w-4 shrink-0" />
            Case brief is being prepared from your conversation. Continue chatting with Saarthi to
            generate it.
          </div>
        )
      )}

      {/* Documents */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-[15px]">Documents</CardTitle>
          {isOwner && (
            <CardDescription className="text-[12px]">
              Upload supporting documents — select a category before uploading.
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <DocumentsSection caseId={caseItem.id} isOwner={isOwner} />
        </CardContent>
      </Card>

      {/* Linked lawyer(s) from appointments */}
      {(linkedAppointments?.length ?? 0) > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-[15px]">
              <Scale className="h-4 w-4 text-primary/70" />
              Assigned Lawyer
            </CardTitle>
            <CardDescription className="text-[12px]">
              This case is linked to a consultation.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {linkedAppointments!.map((apt) => (
                <li
                  key={apt.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-black/[0.06] bg-white/50 px-4 py-3 dark:border-white/[0.08] dark:bg-white/[0.04]"
                >
                  <div>
                    <p className="text-[13px] font-semibold">{apt.lawyer_name}</p>
                    <p className="text-[11px] text-muted-foreground capitalize">
                      {apt.date} · {apt.time_slot} · {apt.status.replace("_", " ")}
                    </p>
                  </div>
                  <a
                    href={`/appointments/${apt.id}`}
                    className="shrink-0 text-[12px] font-medium text-primary underline-offset-2 hover:underline"
                  >
                    View appointment
                    <ArrowUpRight className="ml-0.5 inline h-3 w-3" />
                  </a>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* Sharing (owner only) */}
      {isOwner && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-[15px]">Share with a Lawyer</CardTitle>
            <CardDescription className="text-[12px]">
              Give a verified lawyer read access to this case and documents.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ShareSection caseItem={caseItem} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
