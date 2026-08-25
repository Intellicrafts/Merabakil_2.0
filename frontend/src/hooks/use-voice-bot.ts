"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { ensureFreshToken } from "@/lib/api";
import { rafUpdateIntervalMs } from "@/lib/perf";
import { researchServiceUrl } from "@/lib/service-urls";
import type { LawyerMatchResult } from "@/lib/types";

export type VoiceBotState = "idle" | "listening" | "thinking" | "speaking";

export interface VoiceMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export interface VoiceBookedAppointment {
  id: string;
  lawyer_name: string;
  date: string;
  time_slot: string;
  status: string;
  matter_summary: string;
}

export function isVoiceBotSupported(): boolean {
  if (typeof window === "undefined") return false;
  return (
    "mediaDevices" in navigator &&
    typeof navigator.mediaDevices?.getUserMedia === "function" &&
    typeof AudioContext !== "undefined" &&
    typeof AudioWorkletNode !== "undefined"
  );
}

interface UseVoiceBotOptions {
  open: boolean;
  speechLocale: string;
}

export interface UseVoiceBotResult {
  botState: VoiceBotState;
  transcript: string;
  amplitude: number;
  permissionDenied: boolean;
  voiceMessages: VoiceMessage[];
  lawyerResults: LawyerMatchResult[];
  lastBooking: VoiceBookedAppointment | null;
  startListening: () => void;
  interrupt: () => void;
  stop: () => void;
}

function researchHttpBase(): string {
  if (typeof window !== "undefined") return researchServiceUrl();
  return process.env.NEXT_PUBLIC_RESEARCH_API_URL ?? "http://localhost:8004";
}

function researchWsBase(): string {
  const base = researchHttpBase();
  if (base.startsWith("/")) {
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${window.location.host}${base}`;
  }
  return base.replace(/^https/, "wss").replace(/^http/, "ws");
}

function pcmToAudioBuffer(pcm: Uint8Array, sampleRate: number, ctx: AudioContext): AudioBuffer {
  const samples = new Int16Array(pcm.buffer, pcm.byteOffset, pcm.byteLength / 2);
  const buf = ctx.createBuffer(1, samples.length, sampleRate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < samples.length; i++) ch[i] = samples[i] / 32768;
  return buf;
}

export function useVoiceBot({ open }: UseVoiceBotOptions): UseVoiceBotResult {
  const [botState, setBotState]         = useState<VoiceBotState>("idle");
  const [transcript, setTranscript]     = useState("");
  const [amplitude, setAmplitude]       = useState(0);
  const [permissionDenied, setPermission] = useState(false);
  const [voiceMessages, setVoiceMessages] = useState<VoiceMessage[]>([]);
  const [lawyerResults, setLawyerResults] = useState<LawyerMatchResult[]>([]);
  const [lastBooking, setLastBooking]   = useState<VoiceBookedAppointment | null>(null);

  const wsRef        = useRef<WebSocket | null>(null);

  // ★ AudioContexts are long-lived — created once on first connect, closed on unmount.
  //   stopMic() must NEVER close them; doing so after synchronous creation in a
  //   gesture handler breaks Safari's gesture-unlock requirement on reconnect.
  const micCtxRef        = useRef<AudioContext | null>(null);
  const playCtxRef       = useRef<AudioContext | null>(null);
  const workletLoadedRef = useRef(false); // addModule() is not idempotent on same ctx
  const reconnectAttemptsRef = useRef(0); // throttle auto-reconnect to avoid infinite loop

  const micStreamRef      = useRef<MediaStream | null>(null);
  const workletRef        = useRef<AudioWorkletNode | null>(null);
  const analyserRef       = useRef<AnalyserNode | null>(null);
  const sourcesRef        = useRef<AudioBufferSourceNode[]>([]);
  const nextStartRef      = useRef(0);
  // Drop in-flight audio chunks that arrive after an interruption — Gemini may
  // have sent several chunks before it received our clientContent.turnComplete.
  const playbackBlockedRef = useRef(false);
  const smoothAmpRef = useRef(0);
  const ampRafRef    = useRef<number | null>(null);
  const openRef      = useRef(open);
  const connectRef   = useRef<() => void>(() => {});

  useEffect(() => { openRef.current = open; }, [open]);

  // ── Amplitude loop ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (botState !== "speaking") {
      if (ampRafRef.current != null) cancelAnimationFrame(ampRafRef.current);
      ampRafRef.current = null;
      smoothAmpRef.current = 0;
      setAmplitude(0);
      return;
    }
    let lastFrame = 0;
    const frameInterval = rafUpdateIntervalMs();
    const tick = (frameNow: number) => {
      if (frameNow - lastFrame >= frameInterval) {
        lastFrame = frameNow;
        const an = analyserRef.current;
        if (an) {
          const data = new Uint8Array(an.frequencyBinCount);
          an.getByteTimeDomainData(data);
          let sq = 0;
          for (const v of data) sq += ((v - 128) / 128) ** 2;
          const raw = Math.sqrt(sq / data.length);
          smoothAmpRef.current = smoothAmpRef.current * 0.78 + raw * 0.22;
          setAmplitude(Math.min(1, smoothAmpRef.current * 6));
        }
      }
      ampRafRef.current = requestAnimationFrame(tick);
    };
    ampRafRef.current = requestAnimationFrame(tick);
    return () => { if (ampRafRef.current != null) cancelAnimationFrame(ampRafRef.current); };
  }, [botState]);

  // ── Helpers ────────────────────────────────────────────────────────────────

  const stopPlayback = useCallback(() => {
    analyserRef.current = null;
    playbackBlockedRef.current = false;
    for (const s of sourcesRef.current) { try { s.stop(); s.disconnect(); } catch {} }
    sourcesRef.current = [];
    nextStartRef.current = 0;
  }, []);

  // ★ stopMic stops the stream + worklet ONLY — does NOT close the AudioContext.
  //   The AudioContext must stay alive so Safari's gesture-unlock persists across
  //   reconnects. Closing it here would null micCtxRef before ws.onopen uses it.
  const stopMic = useCallback(() => {
    try { workletRef.current?.disconnect(); } catch {}
    workletRef.current = null;
    micStreamRef.current?.getTracks().forEach((t) => t.stop());
    micStreamRef.current = null;
    // micCtxRef intentionally NOT closed here
  }, []);

  const stop = useCallback(() => {
    wsRef.current?.close();
    wsRef.current = null;
    stopPlayback();
    stopMic();
    setBotState("idle");
    setTranscript("");
  }, [stopPlayback, stopMic]);

  const interrupt = useCallback(() => {
    stopPlayback();
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "interrupt" }));
    }
    setBotState("listening");
  }, [stopPlayback]);

  const scheduleChunk = useCallback((pcm: Uint8Array) => {
    if (playbackBlockedRef.current) return;
    const ctx = playCtxRef.current;
    if (!ctx) return;
    if (!analyserRef.current) {
      const an = ctx.createAnalyser();
      an.fftSize = 512;
      an.smoothingTimeConstant = 0.85;
      an.connect(ctx.destination);
      analyserRef.current = an;
    }
    const ab = pcmToAudioBuffer(pcm, 24000, ctx);
    const src = ctx.createBufferSource();
    src.buffer = ab;
    src.connect(analyserRef.current);
    const at = Math.max(ctx.currentTime, nextStartRef.current);
    src.start(at);
    nextStartRef.current = at + ab.duration;
    sourcesRef.current.push(src);
    src.onended = () => { sourcesRef.current = sourcesRef.current.filter((s) => s !== src); };
  }, []);

  // ── Connect ────────────────────────────────────────────────────────────────
  const connect = useCallback(() => {
    // ★ Create + resume AudioContexts SYNCHRONOUSLY in the gesture handler.
    //   Safari requires AudioContext.resume() to be called synchronously; once
    //   we hit the first `await` below the gesture token is gone.
    //   We never close these contexts mid-session (only on unmount).
    if (!playCtxRef.current || playCtxRef.current.state === "closed") {
      playCtxRef.current = new AudioContext({ sampleRate: 24000 });
    }
    void playCtxRef.current.resume();

    if (!micCtxRef.current || micCtxRef.current.state === "closed") {
      micCtxRef.current = new AudioContext({ sampleRate: 16000 });
      workletLoadedRef.current = false; // new ctx needs addModule again
    }
    void micCtxRef.current.resume();

    void (async () => {
      const token = await ensureFreshToken();
      if (!token) { setBotState("idle"); return; }

      // Clean up previous session (WS, worklet, stream) — but NOT AudioContexts.
      // Null wsRef BEFORE closing so the old WS's onclose guard fires and returns early.
      const prevWs = wsRef.current;
      wsRef.current = null;
      prevWs?.close();
      stopPlayback();
      stopMic();
      setBotState("listening");
      setTranscript("");

      const url = `${researchWsBase()}/api/v1/research/voice/live?token=${encodeURIComponent(token)}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;
      ws.binaryType = "arraybuffer";

      ws.onopen = async () => {
        const micCtx = micCtxRef.current;
        if (!micCtx) {
          console.error("[voice-bot] micCtx is null in onopen — unexpected");
          ws.close();
          return;
        }
        try {
          // Ensure context is running — Safari may still be suspended here
          if (micCtx.state === "suspended") await micCtx.resume();

          const stream = await navigator.mediaDevices.getUserMedia({
            audio: { echoCancellation: true, noiseSuppression: true },
          });
          micStreamRef.current = stream;

          // addModule throws if called twice on the same context with the same name
          if (!workletLoadedRef.current) {
            await micCtx.audioWorklet.addModule("/mv-pcm-capture.js");
            workletLoadedRef.current = true;
          }

          const source = micCtx.createMediaStreamSource(stream);
          const worklet = new AudioWorkletNode(micCtx, "mv-pcm-capture");
          workletRef.current = worklet;

          worklet.port.onmessage = (e: MessageEvent<ArrayBuffer>) => {
            if (ws.readyState === WebSocket.OPEN) ws.send(e.data);
          };

          // source → worklet → silentGain(0) → destination:
          // Chrome/Safari only call process() if the node is reachable from
          // the destination. A silent gain prevents mic audio from playing back.
          const silentGain = micCtx.createGain();
          silentGain.gain.value = 0;
          source.connect(worklet);
          worklet.connect(silentGain);
          silentGain.connect(micCtx.destination);
        } catch (err: unknown) {
          console.error("[voice-bot] mic/worklet setup failed:", err);
          if (err instanceof Error && (err.name === "NotAllowedError" || err.name === "PermissionDeniedError")) {
            setPermission(true);
          }
          setBotState("idle");
          ws.close();
        }
      };

      ws.onmessage = (e: MessageEvent) => {
        if (e.data instanceof ArrayBuffer) {
          scheduleChunk(new Uint8Array(e.data));
          return;
        }
        try {
          const msg = JSON.parse(e.data as string) as {
            type: string; value?: string; text?: string; message?: string; role?: string;
            lawyers?: LawyerMatchResult[];
            appointment?: VoiceBookedAppointment;
          };
          switch (msg.type) {
            case "state":
              if (msg.value) {
                if (msg.value !== "speaking") stopPlayback();
                if (msg.value === "speaking") playbackBlockedRef.current = false;
                setBotState(msg.value as VoiceBotState);
                if (msg.value === "listening" || msg.value === "speaking") {
                  reconnectAttemptsRef.current = 0;
                }
              }
              break;
            case "interrupted":
              playbackBlockedRef.current = true;
              stopPlayback();
              break;
            case "transcript":
              if (msg.text && msg.role) {
                // Completed turn — append to conversation history
                setVoiceMessages((prev) => [
                  ...prev,
                  { id: crypto.randomUUID(), role: msg.role as "user" | "assistant", content: msg.text! },
                ]);
              } else if (msg.text) {
                // Legacy live interim transcript (user speech preview)
                setTranscript(msg.text);
              }
              break;
            case "lawyer_results":
              if (msg.lawyers?.length) {
                setLawyerResults(msg.lawyers);
              }
              break;
            case "appointment_booked":
              if (msg.appointment) {
                setLastBooking(msg.appointment);
              }
              break;
            case "error":
              console.warn("[voice-bot] server error:", msg.message);
              break;
          }
        } catch { /* ignore malformed */ }
      };

      ws.onclose = (e: CloseEvent) => {
        // Guard: ignore if a newer session has already replaced this WS.
        // Without this, closing the old WS in connect() fires onclose and sets
        // idle, overwriting the "listening" state of the new session.
        if (wsRef.current !== ws) return;
        stopPlayback();
        stopMic();
        if (openRef.current) setBotState("idle");
        if (e.code === 4001) console.warn("[voice-bot] auth rejected by server");
      };

      ws.onerror = (e) => {
        if (wsRef.current !== ws) return;
        console.error("[voice-bot] WebSocket error:", e);
        stopPlayback();
        stopMic();
        setBotState("idle");
      };
    })();
  }, [stopPlayback, stopMic, scheduleChunk]);

  useEffect(() => { connectRef.current = connect; }, [connect]);

  // Auto-start when overlay opens, auto-reconnect when session drops mid-session.
  useEffect(() => {
    if (open) {
      reconnectAttemptsRef.current = 0;
      setPermission(false);
      setTranscript("");
      setVoiceMessages([]);
      setLawyerResults([]);
      setLastBooking(null);
      connectRef.current();
    } else {
      stop();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // If session drops while overlay is still open, reconnect — but cap attempts so
  // a persistent failure (bad network, mic denied) doesn't loop forever.
  useEffect(() => {
    if (!open || botState !== "idle" || permissionDenied) return;
    if (reconnectAttemptsRef.current >= 3) {
      console.warn("[voice-bot] giving up reconnect after 3 attempts");
      return;
    }
    const delay = 800 + reconnectAttemptsRef.current * 500; // 800 / 1300 / 1800 ms
    const t = setTimeout(() => {
      if (openRef.current && !permissionDenied) {
        reconnectAttemptsRef.current += 1;
        connectRef.current();
      }
    }, delay);
    return () => clearTimeout(t);
  }, [open, botState, permissionDenied]);

  // Cleanup on unmount — close AudioContexts here (and ONLY here)
  useEffect(() => () => {
    stop();
    void micCtxRef.current?.close();
    micCtxRef.current = null;
    void playCtxRef.current?.close();
    playCtxRef.current = null;
  }, [stop]);

  return { botState, transcript, amplitude, permissionDenied, voiceMessages, lawyerResults, lastBooking, startListening: connect, interrupt, stop };
}
