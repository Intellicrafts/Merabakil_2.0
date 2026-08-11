"use client";

import { useCallback, useEffect, useRef } from "react";

import type { TranscriptEntry, TranscriptLanguage } from "@/lib/courtroom/types";
import { formatTranscriptLine } from "@/lib/courtroom/bilingual";
import { runTypewriterReveal } from "@/hooks/use-courtroom-speech";
import type { CourtroomSpeechControls } from "@/hooks/use-courtroom-speech";

export interface HearingLinePipelineState {
  typingEntryId: string | null;
  typingCharCount: number;
  completedEntryIds: Set<string>;
}

interface UseHearingLinePipelineOptions {
  listeningMode: boolean;
  displayLanguage: TranscriptLanguage;
  phase: string;
  isPaused: () => boolean;
  speech: CourtroomSpeechControls;
  onLineComplete: (entry: TranscriptEntry) => void;
  onTypingUpdate: (entryId: string | null, charCount: number) => void;
}

function speechTextForEntry(entry: TranscriptEntry, language: TranscriptLanguage): string {
  const lang = language === "hi" ? "hi" : "en";
  return formatTranscriptLine(entry, lang).primary;
}

export function useHearingLinePipeline({
  listeningMode,
  displayLanguage,
  phase,
  isPaused,
  speech,
  onLineComplete,
  onTypingUpdate,
}: UseHearingLinePipelineOptions) {
  const pendingRef = useRef<TranscriptEntry[]>([]);
  const drainingRef = useRef(false);
  const seenIdsRef = useRef(new Set<string>());
  const speechRef = useRef(speech);
  speechRef.current = speech;

  const processEntry = useCallback(
    async (entry: TranscriptEntry) => {
      const text = speechTextForEntry(entry, displayLanguage);
      onTypingUpdate(entry.id, 0);

      if (listeningMode) {
        // Pace typewriter roughly with speech; Promise.all never advances early
        const typeTask = runTypewriterReveal(
          text,
          (count) => onTypingUpdate(entry.id, count),
          isPaused,
          Math.min(42, Math.max(22, Math.floor(2800 / Math.max(text.length, 1)))),
        );
        const speakTask = speechRef.current.enqueueSpeak(entry.id, text);
        await Promise.all([typeTask, speakTask]);
        // Ensure full text shown when speech finished first
        onTypingUpdate(entry.id, text.length);
      } else {
        onTypingUpdate(entry.id, text.length);
      }
      onTypingUpdate(null, 0);
      onLineComplete(entry);
    },
    [displayLanguage, isPaused, listeningMode, onLineComplete, onTypingUpdate],
  );

  const drain = useCallback(async () => {
    if (drainingRef.current) return;
    drainingRef.current = true;
    while (pendingRef.current.length > 0) {
      const entry = pendingRef.current.shift()!;
      if (isPaused()) {
        pendingRef.current.unshift(entry);
        await new Promise((r) => setTimeout(r, 150));
        continue;
      }
      await processEntry(entry);
    }
    drainingRef.current = false;
    if (pendingRef.current.length > 0) void drain();
  }, [isPaused, processEntry]);

  const enqueue = useCallback(
    (entry: TranscriptEntry) => {
      if (seenIdsRef.current.has(entry.id)) return;
      seenIdsRef.current.add(entry.id);
      pendingRef.current.push(entry);
      void drain();
    },
    [drain],
  );

  const reset = useCallback(() => {
    pendingRef.current = [];
    seenIdsRef.current.clear();
    drainingRef.current = false;
    onTypingUpdate(null, 0);
  }, [onTypingUpdate]);

  return { enqueue, reset, seenIdsRef };
}

/** Hook helper: watch transcript length and enqueue new lines during hearing. */
export function useHearingTranscriptWatcher(
  transcript: TranscriptEntry[],
  phase: string,
  enqueue: (entry: TranscriptEntry) => void,
) {
  const prevLenRef = useRef(0);

  useEffect(() => {
    if (phase !== "hearing") {
      prevLenRef.current = 0;
      return;
    }
    if (transcript.length <= prevLenRef.current) return;
    for (let i = prevLenRef.current; i < transcript.length; i += 1) {
      enqueue(transcript[i]);
    }
    prevLenRef.current = transcript.length;
  }, [transcript, phase, enqueue]);
}
