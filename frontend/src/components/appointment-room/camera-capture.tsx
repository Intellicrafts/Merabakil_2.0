"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, FlipHorizontal2, ImagePlus, RefreshCw, RotateCw, SwitchCamera, X } from "lucide-react";

import { cn } from "@/lib/utils";

interface CameraCaptureProps {
  open: boolean;
  reuseStream?: MediaStream | null;
  onClose: () => void;
  onSend: (file: File, caption: string) => Promise<void>;
}

type Phase = "requesting" | "live" | "review" | "denied";

async function blobFromCanvas(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Could not capture"))), "image/jpeg", 0.9);
  });
}

async function renderEdited(source: Blob, rotation: number, flipped: boolean): Promise<File> {
  const url = URL.createObjectURL(source);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const swap = rotation % 180 !== 0;
    const canvas = document.createElement("canvas");
    canvas.width = swap ? img.height : img.width;
    canvas.height = swap ? img.width : img.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not edit photo");
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rotation * Math.PI) / 180);
    if (flipped) ctx.scale(-1, 1);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
    const blob = await blobFromCanvas(canvas);
    return new File([blob], `shot-${Date.now()}.jpg`, { type: "image/jpeg" });
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function CameraCapture({ open, reuseStream, onClose, onSend }: CameraCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const ownedRef = useRef(false);
  const [phase, setPhase] = useState<Phase>("requesting");
  const [facing, setFacing] = useState<"user" | "environment">("environment");
  const [retry, setRetry] = useState(0);
  const [shot, setShot] = useState<Blob | null>(null);
  const [shotUrl, setShotUrl] = useState<string | null>(null);
  const [rotation, setRotation] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [caption, setCaption] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return undefined;
    let cancelled = false;
    setPhase("requesting");
    setError(null);
    setShot(null);
    setCaption("");
    setRotation(0);
    setFlipped(false);

    (async () => {
      try {
        if (reuseStream) {
          streamRef.current = reuseStream;
          ownedRef.current = false;
        } else {
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
          ownedRef.current = true;
        }
        setPhase("live");
      } catch (err) {
        if (cancelled) return;
        const name = (err as DOMException).name;
        setError(
          name === "NotAllowedError"
            ? "Camera permission is blocked. Allow access, or pick a photo from your device."
            : "Camera is not available on this device. You can still pick a photo.",
        );
        setPhase("denied");
      }
    })();

    return () => {
      cancelled = true;
      if (ownedRef.current) {
        streamRef.current?.getTracks().forEach((track) => track.stop());
      }
      streamRef.current = null;
    };
  }, [open, facing, reuseStream, retry]);

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
    if (!video || !video.videoWidth) {
      setError("Camera is still starting. Try capture again in a moment.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
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
    setCaption("");
    setPhase(streamRef.current ? "live" : "requesting");
  }

  async function send() {
    if (!shot) return;
    setSending(true);
    try {
      const file = await renderEdited(shot, rotation, flipped);
      await onSend(file, caption.trim());
      onClose();
    } catch (err) {
      setError((err as Error).message || "Could not send photo");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center sm:p-5">
      <button type="button" className="mp-modal-veil absolute inset-0" onClick={onClose} aria-label="Close camera" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="camera-title"
        className="relative z-[81] w-full max-w-lg overflow-hidden rounded-t-3xl border border-black/[0.08] bg-white shadow-[0_24px_80px_rgba(15,23,42,0.28)] dark:border-white/10 dark:bg-[hsl(220_14%_9%)] sm:rounded-3xl"
      >
        <div className="flex items-center justify-between px-4 pt-4">
          <h2 id="camera-title" className="text-[15px] font-semibold tracking-tight">
            {phase === "review" ? "Review photo" : "Take a photo"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground hover:bg-black/[0.05] dark:hover:bg-white/10"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="px-4 pt-1 text-[12px] text-muted-foreground">
          {phase === "requesting"
            ? "Allow camera access to capture a photo for this appointment."
            : phase === "review"
              ? "Retake, rotate, or flip, then send."
              : phase === "denied"
                ? "Permission is needed to use the camera."
                : "Frame the document or scene, then capture."}
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
              <p className="text-[13px]">{phase === "requesting" ? "Waiting for camera permission…" : error}</p>
            </div>
          )}
        </div>

        {error && phase !== "denied" && (
          <p className="px-4 pt-2 text-[12px] text-red-600 dark:text-red-300">{error}</p>
        )}

        {phase === "review" && (
          <div className="px-4 pt-3">
            <input
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Add a note (optional)"
              maxLength={200}
              className="h-10 w-full rounded-xl border border-black/[0.08] bg-transparent px-3 text-[13px] outline-none focus:border-slate-400 dark:border-white/10"
            />
          </div>
        )}

        <div className="flex flex-wrap items-center justify-center gap-2 px-4 py-4">
          {phase === "live" && (
            <>
              {!reuseStream && (
                <button
                  type="button"
                  onClick={() => setFacing((prev) => (prev === "user" ? "environment" : "user"))}
                  className="mp-btn-primary h-10 rounded-xl px-3 text-[12px] font-semibold"
                >
                  <SwitchCamera className="mr-1 h-3.5 w-3.5" />
                  Flip cam
                </button>
              )}
              <button
                type="button"
                onClick={() => void capture()}
                className="mp-btn-accent inline-flex h-12 items-center rounded-full px-5 text-[13px] font-semibold"
              >
                <Camera className="mr-1.5 h-4 w-4" />
                Capture
              </button>
            </>
          )}
          {phase === "review" && (
            <>
              <button type="button" onClick={retake} className="mp-btn-primary h-10 rounded-xl px-3 text-[12px] font-semibold">
                <RefreshCw className="mr-1 h-3.5 w-3.5" />
                Retake
              </button>
              <button
                type="button"
                onClick={() => setRotation((n) => (n + 90) % 360)}
                className="mp-btn-primary h-10 rounded-xl px-3 text-[12px] font-semibold"
              >
                <RotateCw className="mr-1 h-3.5 w-3.5" />
                Rotate
              </button>
              <button
                type="button"
                onClick={() => setFlipped((on) => !on)}
                className="mp-btn-primary h-10 rounded-xl px-3 text-[12px] font-semibold"
              >
                <FlipHorizontal2 className="mr-1 h-3.5 w-3.5" />
                Flip
              </button>
              <button
                type="button"
                onClick={() => void send()}
                disabled={sending}
                className={cn("mp-btn-accent h-10 rounded-xl px-4 text-[12px] font-semibold", sending && "opacity-60")}
              >
                {sending ? "Sending…" : "Send"}
              </button>
            </>
          )}
          {phase === "denied" && (
            <>
              <button
                type="button"
                onClick={() => setRetry((n) => n + 1)}
                className="mp-btn-primary h-10 rounded-xl px-3 text-[12px] font-semibold"
              >
                Try again
              </button>
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="mp-btn-accent h-10 rounded-xl px-3 text-[12px] font-semibold"
              >
                <ImagePlus className="mr-1 h-3.5 w-3.5" />
                Choose photo
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
