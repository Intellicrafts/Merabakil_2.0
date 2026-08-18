"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { streamReadAloud } from "@/lib/api";
import { getSpeechLocale } from "@/lib/indian-locales";
import { prepareSpeechText } from "@/lib/speech-text";

export type CourtroomSpeechStatus = "idle" | "loading" | "playing" | "paused";

export interface CourtroomSpeechControls {
  status: CourtroomSpeechStatus;
  activeEntryId: string | null;
  isSpeaking: boolean;
  /** @deprecated Prefer enqueueSpeak for courtroom hearing lines */
  speak: (entryId: string, text: string) => Promise<void>;
  enqueueSpeak: (entryId: string, text: string) => Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  unlock: () => Promise<void>;
}

interface QueueItem {
  entryId: string;
  text: string;
  resolve: () => void;
  reject: (err: unknown) => void;
}

function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (!("speechSynthesis" in window)) {
      resolve([]);
      return;
    }
    const existing = window.speechSynthesis.getVoices();
    if (existing.length > 0) {
      resolve(existing);
      return;
    }
    const onVoices = () => {
      window.speechSynthesis.removeEventListener("voiceschanged", onVoices);
      resolve(window.speechSynthesis.getVoices());
    };
    window.speechSynthesis.addEventListener("voiceschanged", onVoices);
    window.speechSynthesis.getVoices();
    setTimeout(() => {
      window.speechSynthesis.removeEventListener("voiceschanged", onVoices);
      resolve(window.speechSynthesis.getVoices());
    }, 500);
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function useCourtroomSpeech(speechLocale: "en-IN" | "hi-IN"): CourtroomSpeechControls {
  const [status, setStatus] = useState<CourtroomSpeechStatus>("idle");
  const [activeEntryId, setActiveEntryId] = useState<string | null>(null);
  const sessionRef = useRef(0);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const queueRef = useRef<QueueItem[]>([]);
  const drainingRef = useRef(false);

  const cleanup = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    for (const source of sourcesRef.current) {
      try {
        source.stop();
        source.disconnect();
      } catch {
        /* already stopped */
      }
    }
    sourcesRef.current = [];
    if (utteranceRef.current) {
      window.speechSynthesis.cancel();
      utteranceRef.current = null;
    }
  }, []);

  const stop = useCallback(() => {
    sessionRef.current += 1;
    cleanup();
    queueRef.current.forEach((item) => item.reject(new Error("Speech stopped")));
    queueRef.current = [];
    drainingRef.current = false;
    setStatus("idle");
    setActiveEntryId(null);
  }, [cleanup]);

  useEffect(() => () => cleanup(), [cleanup]);

  const unlock = useCallback(async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    if (audioContextRef.current.state === "suspended") {
      await audioContextRef.current.resume();
    }
    await loadVoices();
  }, []);

  const speakWithSynthesis = useCallback(
    async (entryId: string, text: string, session: number, cancelPrevious: boolean): Promise<void> => {
      if (!("speechSynthesis" in window)) {
        throw new Error("Speech synthesis unavailable");
      }
      const voices = await loadVoices();
      // Use the requested locale only if the text is in the matching script;
      // otherwise fall back to English so the browser doesn't mispronounce.
      const isDevanagari = /[ऀ-ॿ]/.test(text);
      const locale = isDevanagari ? getSpeechLocale(speechLocale) : getSpeechLocale("en-IN");

      await new Promise<void>((resolve, reject) => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = locale.bcp47;
        utterance.rate = 0.96;
        utterance.pitch = 1;
        const preferred =
          voices.find((v) => v.lang === locale.bcp47) ??
          voices.find((v) => v.lang.startsWith(locale.bcp47.split("-")[0])) ??
          voices.find((v) => /en(-|_)(IN|GB|US)/i.test(v.lang)) ??
          voices.find((v) => v.lang.startsWith("en"));
        if (preferred) utterance.voice = preferred;

        utterance.onend = () => {
          if (session !== sessionRef.current) return;
          utteranceRef.current = null;
          setStatus("idle");
          setActiveEntryId(null);
          resolve();
        };
        utterance.onerror = () => {
          if (session !== sessionRef.current) return;
          utteranceRef.current = null;
          setStatus("idle");
          setActiveEntryId(null);
          reject(new Error("Speech failed"));
        };
        utteranceRef.current = utterance;
        setStatus("playing");
        setActiveEntryId(entryId);
        if (cancelPrevious) window.speechSynthesis.cancel();
        window.speechSynthesis.speak(utterance);
      });
    },
    [speechLocale],
  );

  const speakWithStream = useCallback(
    async (entryId: string, text: string, session: number) => {
      const controller = new AbortController();
      abortRef.current = controller;
      const { reader, sampleRate } = await streamReadAloud(text, {
        signal: controller.signal,
        language: speechLocale,
        rewriteForSpeech: false,  // courtroom transcript already in the right language
      });
      if (session !== sessionRef.current) return;

      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === "suspended") await ctx.resume();

      let pending = new Uint8Array(0);
      let frames = 0;
      let nextStart = ctx.currentTime;

      const schedule = (pcm: Uint8Array) => {
        const samples = new Int16Array(pcm.buffer, pcm.byteOffset, pcm.byteLength / 2);
        const buffer = ctx.createBuffer(1, samples.length, sampleRate);
        const channel = buffer.getChannelData(0);
        for (let i = 0; i < samples.length; i += 1) channel[i] = samples[i] / 32768;
        const source = ctx.createBufferSource();
        source.buffer = buffer;
        source.connect(ctx.destination);
        const startAt = Math.max(ctx.currentTime, nextStart);
        source.start(startAt);
        nextStart = startAt + buffer.duration;
        frames += 1;
        sourcesRef.current.push(source);
        source.onended = () => {
          sourcesRef.current = sourcesRef.current.filter((s) => s !== source);
        };
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done || session !== sessionRef.current) break;
        if (!value) continue;
        const merged = new Uint8Array(pending.length + value.length);
        merged.set(pending);
        merged.set(value, pending.length);
        pending = merged;
        while (pending.length >= 4) {
          const view = new DataView(pending.buffer, pending.byteOffset, pending.byteLength);
          const frameLen = view.getUint32(0, true);
          if (pending.length < 4 + frameLen) break;
          schedule(pending.slice(4, 4 + frameLen));
          pending = pending.slice(4 + frameLen);
        }
      }

      if (frames === 0) throw new Error("No audio frames");

      setStatus("playing");
      setActiveEntryId(entryId);

      await new Promise<void>((resolve) => {
        const poll = () => {
          if (session !== sessionRef.current) {
            resolve();
            return;
          }
          if (sourcesRef.current.length === 0) {
            setStatus("idle");
            setActiveEntryId(null);
            resolve();
            return;
          }
          setTimeout(poll, 100);
        };
        poll();
      });
    },
    [speechLocale],
  );

  const speakInternal = useCallback(
    async (entryId: string, rawText: string, cancelPrevious: boolean) => {
      const text = prepareSpeechText(rawText);
      if (!text) return;

      const session = sessionRef.current;
      setStatus("loading");
      setActiveEntryId(entryId);

      try {
        await speakWithStream(entryId, text, session);
      } catch {
        if (session !== sessionRef.current) return;
        cleanup();
        try {
          await speakWithSynthesis(entryId, text, session, cancelPrevious);
        } catch {
          if (session === sessionRef.current) {
            setStatus("idle");
            setActiveEntryId(null);
          }
        }
      }
    },
    [cleanup, speakWithStream, speakWithSynthesis],
  );

  const drainQueue = useCallback(async () => {
    if (drainingRef.current) return;
    drainingRef.current = true;
    while (queueRef.current.length > 0) {
      const item = queueRef.current[0];
      try {
        await speakInternal(item.entryId, item.text, false);
        queueRef.current.shift();
        item.resolve();
      } catch (err) {
        queueRef.current.shift();
        item.reject(err);
      }
    }
    drainingRef.current = false;
  }, [speakInternal]);

  const enqueueSpeak = useCallback(
    (entryId: string, rawText: string) =>
      new Promise<void>((resolve, reject) => {
        queueRef.current.push({ entryId, text: rawText, resolve, reject });
        void drainQueue();
      }),
    [drainQueue],
  );

  const speak = useCallback(
    async (entryId: string, rawText: string) => {
      stop();
      await speakInternal(entryId, rawText, true);
    },
    [speakInternal, stop],
  );

  const pause = useCallback(() => {
    if (status === "playing" || status === "loading") {
      window.speechSynthesis.pause();
      const ctx = audioContextRef.current;
      if (ctx && ctx.state === "running") void ctx.suspend();
      setStatus("paused");
    }
  }, [status]);

  const resume = useCallback(() => {
    if (status === "paused") {
      window.speechSynthesis.resume();
      const ctx = audioContextRef.current;
      if (ctx && ctx.state === "suspended") void ctx.resume();
      setStatus("playing");
    }
  }, [status]);

  return {
    status,
    activeEntryId,
    isSpeaking: status === "playing" || status === "loading" || drainingRef.current,
    speak,
    enqueueSpeak,
    pause,
    resume,
    stop,
    unlock,
  };
}

/** Animate typewriter reveal; respects pause via isPaused callback. */
export async function runTypewriterReveal(
  text: string,
  onCharCount: (count: number) => void,
  isPaused: () => boolean,
  msPerChar = 24,
): Promise<void> {
  if (!text) {
    onCharCount(0);
    return;
  }
  if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    onCharCount(text.length);
    return;
  }
  onCharCount(0);
  for (let i = 1; i <= text.length; i += 1) {
    while (isPaused()) {
      await sleep(120);
    }
    onCharCount(i);
    await sleep(msPerChar);
  }
}
