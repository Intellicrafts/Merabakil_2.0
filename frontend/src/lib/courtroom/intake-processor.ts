import { getUserDocument, uploadUserDocument } from "@/lib/api";
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
      excerpt: `Document uploaded: ${file.name}`,
    };
  } catch {
    return { ...artifact, status: "failed", excerpt: "Upload failed" };
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
  await new Promise((r) => setTimeout(r, 600));

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

  onStep?.("profiling");
  await new Promise((r) => setTimeout(r, 800));

  const processed: CaseIntakeBundle = {
    ...bundle,
    artifacts,
    summary: buildSummary(bundle, config.matterType),
    processedAt: new Date().toISOString(),
  };

  const agents = generateAgentPersonas({ ...config, intake: processed }, processed);

  onStep?.("ready");
  await new Promise((r) => setTimeout(r, 400));

  return {
    bundle: processed,
    agents,
    seed: hashIntakeSeed(processed, config.matterType),
  };
}
