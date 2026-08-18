"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { streamReadAloud } from "@/lib/api";
import { getSpeechLocale } from "@/lib/indian-locales";
import { prepareSpeechText } from "@/lib/speech-text";

function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  return new Promise((resolve) => {
    if (!("speechSynthesis" in window)) { resolve([]); return; }
    const existing = window.speechSynthesis.getVoices();
    if (existing.length > 0) { resolve(existing); return; }
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

export type ReadAloudStatus = "idle" | "loading" | "playing" | "paused";

export interface ReadAloudState {
  status: ReadAloudStatus;
  activeMessageId: string | null;
  isSpeaking: boolean;
}

export interface ReadAloudControls {
  state: ReadAloudState;
  speak: (messageId: string, markdown: string) => Promise<void>;
  pause: () => void;
  resume: () => void;
  stop: () => void;
  toggle: (messageId: string, markdown: string) => Promise<void>;
}

function pcmToAudioBuffer(
  ctx: AudioContext,
  pcm: Uint8Array,
  sampleRate: number,
): AudioBuffer {
  const samples = new Int16Array(pcm.buffer, pcm.byteOffset, pcm.byteLength / 2);
  const buffer = ctx.createBuffer(1, samples.length, sampleRate);
  const channel = buffer.getChannelData(0);
  for (let i = 0; i < samples.length; i += 1) {
    channel[i] = samples[i] / 32768;
  }
  return buffer;
}

export function useReadAloud(speechLocale = "en-IN"): ReadAloudControls {
  const [status, setStatus] = useState<ReadAloudStatus>("idle");
  const [activeMessageId, setActiveMessageId] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const sourcesRef = useRef<AudioBufferSourceNode[]>([]);
  const nextStartTimeRef = useRef(0);
  const usingSpeechRef = useRef(false);
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const sessionRef = useRef(0);

  const cleanupAudio = useCallback(() => {
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
    nextStartTimeRef.current = 0;
    if (utteranceRef.current) {
      window.speechSynthesis.cancel();
      utteranceRef.current = null;
    }
    usingSpeechRef.current = false;
  }, []);

  const stop = useCallback(() => {
    sessionRef.current += 1;
    cleanupAudio();
    setStatus("idle");
    setActiveMessageId(null);
  }, [cleanupAudio]);

  useEffect(() => () => cleanupAudio(), [cleanupAudio]);

  const ensureContext = useCallback(async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    if (audioContextRef.current.state === "suspended") {
      await audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }, []);

  const scheduleBuffer = useCallback((ctx: AudioContext, buffer: AudioBuffer, session: number) => {
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    const startAt = Math.max(ctx.currentTime, nextStartTimeRef.current);
    source.start(startAt);
    nextStartTimeRef.current = startAt + buffer.duration;
    sourcesRef.current.push(source);
    source.onended = () => {
      sourcesRef.current = sourcesRef.current.filter((s) => s !== source);
      if (
        session === sessionRef.current &&
        !usingSpeechRef.current &&
        sourcesRef.current.length === 0
      ) {
        setStatus("idle");
        setActiveMessageId(null);
      }
    };
  }, []);

  const playWithSpeechSynthesis = useCallback(
    async (messageId: string, text: string, session: number) => {
      if (!("speechSynthesis" in window)) {
        throw new Error("Speech synthesis not supported");
      }
      usingSpeechRef.current = true;
      // If the text is not Devanagari/Hindi, use English locale — the text content
      // is always in English (markdown-stripped) unless the backend already rewrote it.
      const isDevanagari = /[ऀ-ॿ]/.test(text);
      const locale = isDevanagari ? getSpeechLocale(speechLocale) : getSpeechLocale("en-IN");
      const voices = await loadVoices();
      const preferred =
        voices.find((v) => v.lang === locale.bcp47) ??
        voices.find((v) => v.lang.startsWith(locale.bcp47.split("-")[0])) ??
        voices.find((v) => /en(-|_)(IN|GB|US)/i.test(v.lang)) ??
        voices.find((v) => v.lang.startsWith("en"));

      await new Promise<void>((resolve, reject) => {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = locale.bcp47;
        utterance.rate = 1.02;
        utterance.pitch = 1;
        if (preferred) utterance.voice = preferred;

        utterance.onend = () => {
          if (session !== sessionRef.current) return;
          usingSpeechRef.current = false;
          utteranceRef.current = null;
          setStatus("idle");
          setActiveMessageId(null);
          resolve();
        };
        utterance.onerror = () => {
          if (session !== sessionRef.current) return;
          usingSpeechRef.current = false;
          utteranceRef.current = null;
          setStatus("idle");
          setActiveMessageId(null);
          reject(new Error("Speech synthesis failed"));
        };
        utteranceRef.current = utterance;
        setStatus("playing");
        setActiveMessageId(messageId);
        window.speechSynthesis.speak(utterance);
      });
    },
    [speechLocale],
  );

  const parseFramedStream = useCallback(
    async (
      reader: ReadableStreamDefaultReader<Uint8Array>,
      ctx: AudioContext,
      sampleRate: number,
      session: number,
    ): Promise<number> => {
      let pending = new Uint8Array(0);
      let framesScheduled = 0;

      const appendAndDrain = () => {
        while (pending.length >= 4) {
          const view = new DataView(pending.buffer, pending.byteOffset, pending.byteLength);
          const frameLen = view.getUint32(0, true);
          if (pending.length < 4 + frameLen) break;
          const pcm = pending.slice(4, 4 + frameLen);
          pending = pending.slice(4 + frameLen);
          const buffer = pcmToAudioBuffer(ctx, pcm, sampleRate);
          scheduleBuffer(ctx, buffer, session);
          framesScheduled += 1;
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done || session !== sessionRef.current) break;
        if (!value) continue;
        const merged = new Uint8Array(pending.length + value.length);
        merged.set(pending);
        merged.set(value, pending.length);
        pending = merged;
        appendAndDrain();
      }
      appendAndDrain();
      return framesScheduled;
    },
    [scheduleBuffer],
  );

  const speak = useCallback(
    async (messageId: string, markdown: string) => {
      stop();
      const text = prepareSpeechText(markdown);
      if (!text) return;

      // Unlock AudioContext synchronously within the user-gesture call stack.
      // Safari drops the gesture context on the first await, so resume() must
      // be initiated here — before the network request — or audio never plays.
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }
      if (audioContextRef.current.state === "suspended") {
        void audioContextRef.current.resume();
      }

      const session = sessionRef.current;
      setStatus("loading");
      setActiveMessageId(messageId);
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        const { reader, sampleRate } = await streamReadAloud(text, {
          signal: controller.signal,
          language: speechLocale,
          // prepareSpeechText already strips markdown — only non-English needs the
          // LLM rewrite (to translate the English answer into the target language).
          rewriteForSpeech: !speechLocale.startsWith("en"),
        });
        if (session !== sessionRef.current) return;
        const ctx = await ensureContext();
        setStatus("playing");
        const frames = await parseFramedStream(reader, ctx, sampleRate, session);
        if (frames === 0) throw new Error("No audio frames received");
      } catch {
        if (session !== sessionRef.current) return;
        cleanupAudio();
        try {
          await playWithSpeechSynthesis(messageId, text, session);
        } catch {
          if (session === sessionRef.current) {
            setStatus("idle");
            setActiveMessageId(null);
          }
        }
      }
    },
    [cleanupAudio, ensureContext, parseFramedStream, playWithSpeechSynthesis, speechLocale, stop],
  );

  const pause = useCallback(() => {
    if (usingSpeechRef.current) {
      window.speechSynthesis.pause();
      setStatus("paused");
      return;
    }
    const ctx = audioContextRef.current;
    if (!ctx || status !== "playing") return;
    void ctx.suspend().then(() => setStatus("paused"));
  }, [status]);

  const resume = useCallback(() => {
    if (usingSpeechRef.current) {
      window.speechSynthesis.resume();
      setStatus("playing");
      return;
    }
    const ctx = audioContextRef.current;
    if (!ctx || status !== "paused") return;
    void ctx.resume().then(() => setStatus("playing"));
  }, [status]);

  const toggle = useCallback(
    async (messageId: string, markdown: string) => {
      if (activeMessageId === messageId && status === "playing") {
        pause();
        return;
      }
      if (activeMessageId === messageId && status === "paused") {
        resume();
        return;
      }
      await speak(messageId, markdown);
    },
    [activeMessageId, pause, resume, speak, status],
  );

  return {
    state: {
      status,
      activeMessageId,
      isSpeaking: status === "playing" || status === "loading",
    },
    speak,
    pause,
    resume,
    stop,
    toggle,
  };
}
