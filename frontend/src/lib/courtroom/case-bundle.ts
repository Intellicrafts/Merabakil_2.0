import type { CaseIntakeArtifact, CaseIntakeBundle } from "@/lib/courtroom/types";

export function createEmptyIntakeBundle(): CaseIntakeBundle {
  return {
    brief: "",
    facts: "",
    issues: "",
    reliefSought: "",
    artifacts: [],
    summary: "",
  };
}

export function intakeArtifactCount(bundle: CaseIntakeBundle): number {
  return bundle.artifacts.length + (bundle.brief.trim() ? 1 : 0);
}

export function intakeSummaryChips(bundle: CaseIntakeBundle): string[] {
  const chips: string[] = [];
  if (bundle.brief.trim()) chips.push("Brief");
  if (bundle.facts.trim()) chips.push("Facts");
  if (bundle.issues.trim()) chips.push("Issues");
  const kinds = new Set(bundle.artifacts.map((a) => a.kind));
  if (kinds.has("pdf") || kinds.has("doc")) chips.push("Documents");
  if (kinds.has("photo")) chips.push("Photos");
  if (kinds.has("audio")) chips.push("Audio");
  if (kinds.has("video")) chips.push("Video");
  return chips;
}

export function hasMinimumIntake(bundle: CaseIntakeBundle): boolean {
  const textLen =
    bundle.brief.trim().length +
    bundle.facts.trim().length +
    bundle.issues.trim().length;
  return textLen >= 20 || bundle.artifacts.some((a) => a.status === "ready" || a.previewUrl);
}

export function revokeArtifactPreview(artifact: CaseIntakeArtifact): void {
  if (artifact.previewUrl?.startsWith("blob:")) {
    URL.revokeObjectURL(artifact.previewUrl);
  }
}

export function hashIntakeSeed(bundle: CaseIntakeBundle, matterType: string): number {
  const raw = `${matterType}:${bundle.brief}:${bundle.facts}:${bundle.artifacts.length}`;
  let h = 0;
  for (let i = 0; i < raw.length; i++) h = (h * 31 + raw.charCodeAt(i)) | 0;
  return Math.abs(h);
}
