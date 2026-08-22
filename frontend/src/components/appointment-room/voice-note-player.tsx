"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";

import { fetchAppointmentAttachmentBlob } from "@/lib/api";
import type { AppointmentAttachment } from "@/lib/appointment-types";
import { cn } from "@/lib/utils";

function formatClock(total: number): string {
  if (!Number.isFinite(total) || total < 0) return "0:00";
  const seconds = Math.floor(total);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

interface VoiceNotePlayerProps {
  appointmentId: string;
  attachment: AppointmentAttachment;
  mine: boolean;
}

export function VoiceNotePlayer({ appointmentId, attachment, mine }: VoiceNotePlayerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [url, setUrl] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [rate, setRate] = useState(1);

  useEffect(() => {
    let revoke: string | null = null;
    let cancelled = false;
    void fetchAppointmentAttachmentBlob(appointmentId, attachment.id)
      .then((blob) => {
        if (cancelled) return;
        const next = URL.createObjectURL(blob);
        revoke = next;
        setUrl(next);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [appointmentId, attachment.id]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !url) return;
    audio.src = url;
    const onTime = () => setCurrent(audio.currentTime);
    const onMeta = () => setDuration(Number.isFinite(audio.duration) ? audio.duration : 0);
    const onEnd = () => {
      setPlaying(false);
      setCurrent(0);
    };
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("ended", onEnd);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("ended", onEnd);
    };
  }, [url]);

  async function toggle() {
    const audio = audioRef.current;
    if (!audio || !url) return;
    if (playing) {
      audio.pause();
      setPlaying(false);
      return;
    }
    audio.playbackRate = rate;
    await audio.play();
    setPlaying(true);
  }

  function seek(value: number) {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = value;
    setCurrent(value);
  }

  function cycleRate() {
    const next = rate === 1 ? 1.5 : rate === 1.5 ? 2 : 1;
    setRate(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  }

  const max = duration || 0;

  return (
    <div className={cn("mt-1 flex min-w-[196px] items-center gap-2", mine ? "text-white dark:text-slate-900" : "")}>
      <audio ref={audioRef} preload="metadata" className="hidden" />
      <button
        type="button"
        onClick={() => void toggle()}
        disabled={!url}
        className={cn(
          "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          mine
            ? "bg-white/15 text-white dark:bg-slate-900/15 dark:text-slate-900"
            : "bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900",
        )}
        aria-label={playing ? "Pause voice note" : "Play voice note"}
      >
        {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
      </button>
      <div className="min-w-0 flex-1">
        <input
          type="range"
          min={0}
          max={max || 0}
          step={0.1}
          value={Math.min(current, max)}
          onChange={(e) => seek(Number(e.target.value))}
          className="h-1 w-full cursor-pointer accent-current"
          aria-label="Voice note position"
        />
        <div className={cn("mt-0.5 flex justify-between text-[10px] tabular-nums", mine ? "opacity-70" : "text-muted-foreground")}>
          <span>{formatClock(current)}</span>
          <span>{formatClock(duration)}</span>
        </div>
      </div>
      <button
        type="button"
        onClick={cycleRate}
        className={cn(
          "shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
          mine ? "bg-white/10" : "bg-black/[0.05] dark:bg-white/10",
        )}
        aria-label="Playback speed"
      >
        {rate}x
      </button>
    </div>
  );
}
