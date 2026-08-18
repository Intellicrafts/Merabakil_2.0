import { getUserDocument, streamResearch, uploadUserDocument } from "@/lib/api";
import { hashIntakeSeed } from "@/lib/courtroom/case-bundle";
import { generateAgentPersonas } from "@/lib/courtroom/agent-profiles";
import type {
  AgentPersona,
  CaseIntakeArtifact,
  CaseIntakeBundle,
  CourtroomSessionConfig,
  ProcessingStep,
} from "@/lib/courtroom/types";

function buildSummary(bundle: CaseIntakeBundle, matterType: string): string {
  const parts = [
    bundle.brief.trim(),
    bundle.facts.trim() && `Facts: ${bundle.facts.trim()}`,
    bundle.issues.trim() && `Issues: ${bundle.issues.trim()}`,
    bundle.reliefSought.trim() && `Relief: ${bundle.reliefSought.trim()}`,
  ].filter(Boolean);
  const artifactNote =
    bundle.artifacts.length > 0
      ? ` ${bundle.artifacts.length} supporting artifact(s) on record.`
      : "";
  return (
    parts.join(" · ").slice(0, 400) ||
    `${matterType} matter prepared for AI courtroom simulation.${artifactNote}`
  );
}

async function pollDocumentIndexed(documentId: string, maxAttempts = 10): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const doc = await getUserDocument(documentId);
      if (doc.status === "indexed" || doc.status === "ready") return true;
      if (doc.status === "failed") return false;
    } catch {
      return false;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  return false;
}

export async function processPdfArtifact(
  artifact: CaseIntakeArtifact,
  file: File,
  matterTitle: string,
): Promise<CaseIntakeArtifact> {
  try {
    const uploaded = await uploadUserDocument(file, {
      title: matterTitle || file.name,
      doc_type: "courtroom_intake",
    });
    const indexed = await pollDocumentIndexed(uploaded.document_id);
    return {
      ...artifact,
      documentId: uploaded.document_id,
      status: indexed ? "ready" : "processing",
      excerpt: indexed
        ? `Document indexed: ${file.name}`
        : `Document uploaded but not fully indexed yet: ${file.name}`,
    };
  } catch {
    return { ...artifact, status: "failed", excerpt: "Upload failed" };
  }
}

/** Structured extraction from brief + artifact excerpts into facts/issues/relief. */
export async function extractStructuredIntake(
  bundle: CaseIntakeBundle,
  matterType: string,
): Promise<Pick<CaseIntakeBundle, "facts" | "issues" | "reliefSought" | "brief">> {
  const alreadyRich =
    bundle.facts.trim().length > 40 &&
    bundle.issues.trim().length > 20 &&
    bundle.reliefSought.trim().length > 10;
  if (alreadyRich) {
    return {
      brief: bundle.brief,
      facts: bundle.facts,
      issues: bundle.issues,
      reliefSought: bundle.reliefSought,
    };
  }

  const excerpts = bundle.artifacts
    .map((a) => a.excerpt)
    .filter(Boolean)
    .join("\n")
    .slice(0, 2000);

  const prompt = `Extract structured Indian litigation intake as JSON only (no markdown) for a ${matterType} matter.
Source brief:
${bundle.brief.slice(0, 1500)}

Existing facts: ${bundle.facts || "(none)"}
Existing issues: ${bundle.issues || "(none)"}
Existing relief: ${bundle.reliefSought || "(none)"}
Document excerpts:
${excerpts || "(none)"}

Return:
{
  "brief": "1-3 sentence case synopsis",
  "facts": "semicolon-separated material facts (3-8)",
  "issues": "semicolon-separated legal/factual issues for framing (3-6)",
  "reliefSought": "prayer / relief sought in one short paragraph"
}`;

  try {
    let raw = "";
    const result = await streamResearch(prompt, undefined, [], {
      onToken: (t) => {
        raw += t;
      },
    });
    const text = raw || result.answer || "";
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end <= start) throw new Error("no json");
    const parsed = JSON.parse(text.slice(start, end + 1)) as {
      brief?: string;
      facts?: string;
      issues?: string;
      reliefSought?: string;
    };
    return {
      brief: (parsed.brief || bundle.brief || "").trim() || bundle.brief,
      facts: (parsed.facts || bundle.facts || "").trim() || bundle.facts,
      issues: (parsed.issues || bundle.issues || "").trim() || bundle.issues,
      reliefSought:
        (parsed.reliefSought || bundle.reliefSought || "").trim() || bundle.reliefSought,
    };
  } catch {
    // Heuristic fallback: split brief into facts/issues
    const sentences = bundle.brief
      .split(/(?<=[.?!])\s+/)
      .map((s) => s.trim())
      .filter((s) => s.length > 20);
    return {
      brief: bundle.brief,
      facts: bundle.facts || sentences.slice(0, 3).join("; "),
      issues:
        bundle.issues ||
        sentences.slice(3, 6).join("; ") ||
        `Whether the ${matterType} claim is made out on the pleaded facts`,
      reliefSought:
        bundle.reliefSought ||
        `Appropriate relief in the ${matterType} matter as per the pleadings`,
    };
  }
}

export interface ProcessIntakeResult {
  bundle: CaseIntakeBundle;
  agents: AgentPersona[];
  seed: number;
}

export async function processCaseIntake(
  config: CourtroomSessionConfig,
  bundle: CaseIntakeBundle,
  onStep?: (step: ProcessingStep) => void,
  pdfFiles?: Map<string, File>,
): Promise<ProcessIntakeResult> {
  onStep?.("extracting");
  await new Promise((r) => setTimeout(r, 400));

  const artifacts: CaseIntakeArtifact[] = [];
  for (const art of bundle.artifacts) {
    if ((art.kind === "pdf" || art.kind === "doc") && pdfFiles?.has(art.id)) {
      const file = pdfFiles.get(art.id)!;
      artifacts.push(await processPdfArtifact(art, file, config.matterTitle));
    } else {
      artifacts.push({
        ...art,
        status: art.previewUrl || art.excerpt ? "ready" : "ready",
        excerpt: art.excerpt ?? `${art.kind} artifact captured locally`,
      });
    }
  }

  const indexingPending = artifacts.some(
    (a) =>
      (a.kind === "pdf" || a.kind === "doc") &&
      a.documentId &&
      a.status !== "ready" &&
      a.status !== "failed",
  );
  const indexingFailed = artifacts.some(
    (a) => (a.kind === "pdf" || a.kind === "doc") && a.status === "failed",
  );

  const withArts: CaseIntakeBundle = { ...bundle, artifacts };
  const extracted = await extractStructuredIntake(withArts, config.matterType);

  onStep?.("profiling");
  await new Promise((r) => setTimeout(r, 400));

  const processed: CaseIntakeBundle = {
    ...bundle,
    ...extracted,
    artifacts,
    summary: buildSummary({ ...bundle, ...extracted, artifacts }, config.matterType),
    processedAt: new Date().toISOString(),
    indexingWarning: indexingFailed
      ? "One or more PDF uploads failed. Hearing will rely on typed intake only."
      : indexingPending
        ? "Some PDFs are still indexing. Document RAG may be incomplete until they finish."
        : undefined,
  };

  const agents = generateAgentPersonas({ ...config, intake: processed }, processed);

  onStep?.("ready");
  await new Promise((r) => setTimeout(r, 200));

  return {
    bundle: processed,
    agents,
    seed: hashIntakeSeed(processed, config.matterType),
  };
}
