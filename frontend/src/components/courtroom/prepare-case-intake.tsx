"use client";

import { useCallback, useRef, useState } from "react";
import Image from "next/image";
import { FileText, ImageIcon, Mic, Upload, Video } from "lucide-react";

import { revokeArtifactPreview } from "@/lib/courtroom/case-bundle";
import type { CaseIntakeArtifact, CaseIntakeBundle } from "@/lib/courtroom/types";
import { cn } from "@/lib/utils";

interface PrepareCaseIntakeProps {
  bundle: CaseIntakeBundle;
  onChange: (bundle: CaseIntakeBundle) => void;
  pdfFiles: Map<string, File>;
  onPdfFile: (artifactId: string, file: File) => void;
  disabled?: boolean;
}

function newArtifact(kind: CaseIntakeArtifact["kind"], name: string): CaseIntakeArtifact {
  return {
    id: `art-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    kind,
    name,
    status: "pending",
  };
}

export function PrepareCaseIntake({
  bundle,
  onChange,
  pdfFiles,
  onPdfFile,
  disabled,
}: PrepareCaseIntakeProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [captureKind, setCaptureKind] = useState<CaseIntakeArtifact["kind"]>("pdf");
  const [recording, setRecording] = useState(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);

  const update = useCallback(
    (patch: Partial<CaseIntakeBundle>) => onChange({ ...bundle, ...patch }),
    [bundle, onChange],
  );

  const addArtifact = useCallback(
    (artifact: CaseIntakeArtifact) => {
      onChange({ ...bundle, artifacts: [...bundle.artifacts, artifact] });
    },
    [bundle, onChange],
  );

  const removeArtifact = useCallback(
    (id: string) => {
      const art = bundle.artifacts.find((a) => a.id === id);
      if (art) revokeArtifactPreview(art);
      onChange({ ...bundle, artifacts: bundle.artifacts.filter((a) => a.id !== id) });
    },
    [bundle, onChange],
  );

  const handleFilePick = (files: FileList | null) => {
    if (!files?.length || disabled) return;
    const file = files[0];
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    let kind: CaseIntakeArtifact["kind"] = captureKind;
    if (ext === "pdf") kind = "pdf";
    else if (["doc", "docx"].includes(ext)) kind = "doc";
    else if (file.type.startsWith("image/")) kind = "photo";
    else if (file.type.startsWith("audio/")) kind = "audio";
    else if (file.type.startsWith("video/")) kind = "video";

    const artifact = newArtifact(kind, file.name);
    artifact.sizeBytes = file.size;
    artifact.previewUrl = URL.createObjectURL(file);
    artifact.status = "ready";

    if (kind === "pdf" || kind === "doc") {
      onPdfFile(artifact.id, file);
    }
    addArtifact(artifact);
    if (fileRef.current) fileRef.current.value = "";
  };

  const startVoiceNote = async () => {
    if (disabled || recording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks: BlobPart[] = [];
      recorder.ondataavailable = (e) => chunks.push(e.data);
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "audio/webm" });
        const artifact = newArtifact("audio", `Voice note ${new Date().toLocaleTimeString()}`);
        artifact.previewUrl = URL.createObjectURL(blob);
        artifact.status = "ready";
        artifact.sizeBytes = blob.size;
        addArtifact(artifact);
        stream.getTracks().forEach((t) => t.stop());
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      /* mic unavailable */
    }
  };

  const stopVoiceNote = () => {
    mediaRecorderRef.current?.stop();
    setRecording(false);
  };

  const intakeModes = [
    { id: "text" as const, label: "Text brief", icon: FileText },
    { id: "pdf" as const, label: "PDF / DOC", icon: Upload },
    { id: "photo" as const, label: "Photo", icon: ImageIcon },
    { id: "audio" as const, label: "Audio", icon: Mic },
    { id: "video" as const, label: "Video", icon: Video },
  ];

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <span className="text-[11px] font-medium text-muted-foreground">Case brief</span>
        <textarea
          value={bundle.brief}
          onChange={(e) => update({ brief: e.target.value })}
          disabled={disabled}
          rows={4}
          placeholder="Summarize the dispute, parties, and procedural posture…"
          className="w-full resize-y rounded-xl border border-black/[0.08] bg-white/80 px-3 py-2 text-[13px] dark:border-white/10 dark:bg-white/[0.04]"
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1.5">
          <span className="text-[11px] font-medium text-muted-foreground">Key facts</span>
          <textarea
            value={bundle.facts}
            onChange={(e) => update({ facts: e.target.value })}
            disabled={disabled}
            rows={2}
            className="w-full rounded-xl border border-black/[0.08] bg-white/80 px-3 py-2 text-[12px] dark:border-white/10 dark:bg-white/[0.04]"
          />
        </label>
        <label className="space-y-1.5">
          <span className="text-[11px] font-medium text-muted-foreground">Issues & relief</span>
          <textarea
            value={bundle.issues}
            onChange={(e) => update({ issues: e.target.value })}
            disabled={disabled}
            rows={2}
            placeholder="Issues…"
            className="w-full rounded-xl border border-black/[0.08] bg-white/80 px-3 py-2 text-[12px] dark:border-white/10 dark:bg-white/[0.04]"
          />
        </label>
      </div>

      <label className="block space-y-1.5">
        <span className="text-[11px] font-medium text-muted-foreground">Relief sought</span>
        <input
          value={bundle.reliefSought}
          onChange={(e) => update({ reliefSought: e.target.value })}
          disabled={disabled}
          className="h-9 w-full rounded-xl border border-black/[0.08] bg-white/80 px-3 text-[12px] dark:border-white/10 dark:bg-white/[0.04]"
        />
      </label>

      <div className="space-y-2">
        <span className="text-[11px] font-medium text-muted-foreground">Multimodal intake</span>
        <div className="flex flex-wrap gap-1.5">
          {intakeModes.map((mode) => (
            <button
              key={mode.id}
              type="button"
              disabled={disabled}
              onClick={() => {
                setCaptureKind(mode.id === "text" ? "pdf" : mode.id);
                if (mode.id !== "text") fileRef.current?.click();
              }}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors",
                "border-black/[0.06] bg-white/70 text-muted-foreground hover:border-stone-400/40 dark:border-white/10 dark:bg-white/[0.04]",
              )}
            >
              <mode.icon className="h-3 w-3" />
              {mode.label}
            </button>
          ))}
          <button
            type="button"
            disabled={disabled}
            onClick={recording ? stopVoiceNote : startVoiceNote}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
              recording
                ? "border-red-500/40 bg-red-500/10 text-red-700 dark:text-red-300"
                : "border-black/[0.06] bg-white/70 text-muted-foreground dark:border-white/10 dark:bg-white/[0.04]",
            )}
          >
            <Mic className="h-3 w-3" />
            {recording ? "Stop recording" : "Record voice"}
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          accept=".pdf,.doc,.docx,image/*,audio/*,video/*"
          onChange={(e) => handleFilePick(e.target.files)}
        />
      </div>

      {bundle.artifacts.length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-2">
          {bundle.artifacts.map((art) => (
            <li
              key={art.id}
              className="flex items-center gap-2 rounded-xl border border-black/[0.05] bg-white/50 p-2 dark:border-white/[0.06] dark:bg-white/[0.03]"
            >
              {art.kind === "photo" && art.previewUrl && (
                <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg">
                  <Image src={art.previewUrl} alt="" fill className="object-cover" unoptimized sizes="40px" />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11px] font-semibold">{art.name}</p>
                <p className="text-[10px] capitalize text-muted-foreground">
                  {art.kind} · {art.status}
                  {pdfFiles.has(art.id) ? " · queued upload" : ""}
                </p>
              </div>
              <button
                type="button"
                disabled={disabled}
                onClick={() => removeArtifact(art.id)}
                className="text-[10px] text-muted-foreground hover:text-foreground"
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
