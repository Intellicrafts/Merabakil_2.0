"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, FlipHorizontal2, ImagePlus, RefreshCw, RotateCw, SwitchCamera, X } from "lucide-react";

import { useTranslation } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface SaarthiCameraCaptureProps {
  open: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
}

type Phase = "requesting" | "live" | "review" | "denied";

async function blobFromCanvas(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not capture"))), "image/jpeg", 0.9);
  });
}

function snapCanvasDimension(value: number): number {
  const n = Math.max(1, Math.floor(value));
  return n % 2 === 0 ? n : n - 1;
}

async function renderEdited(source: Blob, rotation: number, flipped: boolean): Promise<File> {
  const url = URL.createObjectURL(source);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    if (!img.width || !img.height) throw new Error("Could not read photo dimensions");
    const swap = rotation % 180 !== 0;
    const canvas = document.createElement("canvas");
    canvas.width = snapCanvasDimension(swap ? img.height : img.width);
    canvas.height = snapCanvasDimension(swap ? img.width : img.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not edit photo");
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    if (flipped) ctx.scale(-1, 1);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    const blob = await blobFromCanvas(canvas);
    return new File([blob], `photo-${Date.now()}.jpg`, { type: "image/jpeg" });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function SaarthiCameraCapture({ open, onClose, onCapture }: SaarthiCameraCaptureProps) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [phase, setPhase] = useState<Phase>("requesting");
  const [facing, setFacing] = useState<"user" | "environment">("environment");
  const [retry, setRetry] = useState(0);
  const [shot, setShot] = useState<Blob | null>(null);
  const [shotUrl, setShotUrl] = useState<string | null>(null);
  const [rotation, setRotation] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setPhase("requesting");
    setError(null);
    setShot(null);
    setRotation(0);
    setFlipped(false);

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            facingMode: { ideal: facing },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        setPhase("live");
      } catch (err) {
        if (cancelled) return;
        const name = (err as DOMException).name;
        setError(
          name === "NotAllowedError"
            ? t("chat.cameraBlocked")
            : t("chat.cameraNotAvailable"),
        );
        setPhase("denied");
      }
    })();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    };
  }, [open, facing, retry, t]);

  useEffect(() => {
    if (!open || phase !== "live" || !videoRef.current || !streamRef.current) return;
    videoRef.current.srcObject = streamRef.current;
    void videoRef.current.play().catch(() => undefined);
  }, [open, phase]);

  useEffect(() => {
    return () => {
      if (shotUrl) URL.revokeObjectURL(shotUrl);
    };
  }, [shotUrl]);

  if (!open) return null;

  async function capture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) {
      setError(t("chat.cameraStillStarting"));
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = snapCanvasDimension(video.videoWidth);
    canvas.height = snapCanvasDimension(video.videoHeight);
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    const blob = await blobFromCanvas(canvas);
    if (shotUrl) URL.revokeObjectURL(shotUrl);
    setShot(blob);
    setShotUrl(URL.createObjectURL(blob));
    setRotation(0);
    setFlipped(false);
    setPhase("review");
  }

  function retake() {
    if (shotUrl) URL.revokeObjectURL(shotUrl);
    setShot(null);
    setShotUrl(null);
    setPhase(streamRef.current ? "live" : "requesting");
  }

  async function confirmPhoto() {
    if (!shot) return;
    setConfirming(true);
    try {
      const file = await renderEdited(shot, rotation, flipped);
      onCapture(file);
      onClose();
    } catch (err) {
      setError((err as Error).message || t("chat.couldNotProcess"));
    } finally {
      setConfirming(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-5">
      <button
        type="button"
        className="mp-modal-veil absolute inset-0"
        onClick={onClose}
        aria-label={t("chat.closeCamera")}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="saarthi-camera-title"
        className={cn(
          "relative z-[81] w-full max-w-lg overflow-hidden",
          "rounded-t-[1.75rem] border border-black/[0.08] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.28)]",
          "pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] sm:rounded-3xl sm:pb-4",
          "dark:border-white/10 dark:bg-zinc-950",
        )}
      >
        <div className="flex items-center justify-between px-4 pt-4">
          <h2 id="saarthi-camera-title" className="text-[15px] font-semibold tracking-tight">
            {phase === "review" ? t("chat.reviewPhoto") : t("chat.takePhoto")}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground hover:bg-black/[0.05] dark:hover:bg-white/10"
            aria-label={t("chat.closeCamera")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="px-4 pt-1 text-[12px] text-muted-foreground">
          {phase === "requesting"
            ? t("chat.cameraPermReq")
            : phase === "review"
              ? t("chat.retakeRotateFlip")
              : phase === "denied"
                ? t("chat.cameraPermNeeded")
                : t("chat.frameDocument")}
        </p>

        <div className="mt-3 bg-slate-950">
          {phase === "live" && (
            <video ref={videoRef} autoPlay muted playsInline className="aspect-[4/3] w-full object-cover" />
          )}
          {phase === "review" && shotUrl && (
            <div className="flex aspect-[4/3] items-center justify-center overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={shotUrl}
                alt="Captured"
                className="max-h-full max-w-full object-contain"
                style={{ transform: `rotate(${rotation}deg) scaleX(${flipped ? -1 : 1})` }}
              />
            </div>
          )}
          {(phase === "requesting" || phase === "denied") && (
            <div className="flex aspect-[4/3] flex-col items-center justify-center gap-2 px-6 text-center text-slate-300">
              <Camera className="h-8 w-8 opacity-70" />
              <p className="text-[13px]">{phase === "requesting" ? t("chat.waitingCameraPerm") : error}</p>
            </div>
          )}
        </div>

        {error && phase !== "denied" && (
          <p className="px-4 pt-2 text-[12px] text-red-600 dark:text-red-300">{error}</p>
        )}

        <div className="grid grid-cols-2 gap-2 px-4 py-4 sm:flex sm:flex-wrap sm:items-center sm:justify-center">
          {phase === "live" && (
            <>
              <button
                type="button"
                onClick={() => setFacing((prev) => (prev === "user" ? "environment" : "user"))}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-black/[0.08] bg-white px-3 text-[12px] font-semibold dark:border-white/10 dark:bg-zinc-900"
              >
                <SwitchCamera className="mr-1 h-3.5 w-3.5" />
                {t("chat.flipCam")}
              </button>
              <button
                type="button"
                onClick={() => void capture()}
                className="inline-flex h-12 items-center justify-center rounded-full bg-gradient-to-b from-amber-800 to-amber-900 px-5 text-[13px] font-semibold text-white shadow-[0_4px_14px_rgba(120,53,15,0.35)] dark:from-amber-600 dark:to-amber-700"
              >
                <Camera className="mr-1.5 h-4 w-4" />
                {t("chat.capture")}
              </button>
            </>
          )}
          {phase === "review" && (
            <>
              <button
                type="button"
                onClick={retake}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-black/[0.08] bg-white px-3 text-[12px] font-semibold dark:border-white/10 dark:bg-zinc-900"
              >
                <RefreshCw className="mr-1 h-3.5 w-3.5" />
                {t("chat.retake")}
              </button>
              <button
                type="button"
                onClick={() => setRotation((n) => (n + 90) % 360)}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-black/[0.08] bg-white px-3 text-[12px] font-semibold dark:border-white/10 dark:bg-zinc-900"
              >
                <RotateCw className="mr-1 h-3.5 w-3.5" />
                {t("chat.rotate")}
              </button>
              <button
                type="button"
                onClick={() => setFlipped((on) => !on)}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-black/[0.08] bg-white px-3 text-[12px] font-semibold dark:border-white/10 dark:bg-zinc-900"
              >
                <FlipHorizontal2 className="mr-1 h-3.5 w-3.5" />
                {t("chat.flip")}
              </button>
              <button
                type="button"
                onClick={() => void confirmPhoto()}
                disabled={confirming}
                className={cn(
                  "inline-flex h-11 items-center justify-center rounded-xl bg-gradient-to-b from-amber-800 to-amber-900 px-4 text-[12px] font-semibold text-white dark:from-amber-600 dark:to-amber-700",
                  confirming && "opacity-60",
                )}
              >
                {confirming ? t("chat.uploading") : t("chat.usePhoto")}
              </button>
            </>
          )}
          {phase === "denied" && (
            <>
              <button
                type="button"
                onClick={() => setRetry((n) => n + 1)}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-black/[0.08] bg-white px-3 text-[12px] font-semibold dark:border-white/10 dark:bg-zinc-900"
              >
                {t("chat.tryAgain")}
              </button>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-gradient-to-b from-amber-800 to-amber-900 px-3 text-[12px] font-semibold text-white dark:from-amber-600 dark:to-amber-700"
              >
                <ImagePlus className="mr-1 h-3.5 w-3.5" />
                {t("chat.choosePhoto")}
              </button>
            </>
          )}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            if (shotUrl) URL.revokeObjectURL(shotUrl);
            setShot(file);
            setShotUrl(URL.createObjectURL(file));
            setRotation(0);
            setFlipped(false);
            setPhase("review");
          }}
        />
      </div>
    </div>
  );
}
