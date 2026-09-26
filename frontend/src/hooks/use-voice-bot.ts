"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { AnalyticsEvents, track } from "@/lib/analytics";
import { ensureFreshToken, fetchGuestVoiceToken, GuestLimitError } from "@/lib/api";
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
  priorMessages?: Array<{ role: string; content: string }>;
  /** Anonymous guest session: mint a short-lived token, cap at ~90s, no reconnect. */
  guest?: boolean;
  onGuestLimit?: () => void;
  onGuestEnded?: () => void;
  /** Conversation id, so voice turns land in the same server-side memory as text. */
  sessionId?: string | null;
}

/** Why voice can't continue: unavailable (server/feature), or reconnects exhausted. */
export type VoiceErrorKind = "unavailable" | "reconnect_failed" | null;

const GUEST_SECONDS = 90;

type VoiceEndedBy = "user" | "limit" | "error";

export function durationBucket(seconds: number, endedBy: VoiceEndedBy, guest: boolean): string {
  if (guest && (endedBy === "limit" || seconds >= GUEST_SECONDS)) return "90s_cap";
  if (seconds < 30) return "<30s";
  if (seconds < 60) return "30-60s";
  if (seconds < 90) return "60-90s";
  return "over_90s"; // members only — their sessions aren't capped at 90s
}

export interface UseVoiceBotResult {
  botState: VoiceBotState;
  transcript: string;
  amplitude: number;
  permissionDenied: boolean;
  voiceMessages: VoiceMessage[];
  lawyerResults: LawyerMatchResult[];
  lastBooking: VoiceBookedAppointment | null;
  dismissLastBooking: () => void;
  startListening: () => void;
  interrupt: () => void;
  stop: () => void;
  errorKind: VoiceErrorKind;
  /** Audio is blocked until the user taps (iOS Safari autoplay rules). */
  needsGesture: boolean;
  /** Guest sessions only: seconds left in the free preview once live. */
  secondsLeft: number | null;
  retry: () => void;
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

export function useVoiceBot({
  open,
  speechLocale,
  priorMessages,
  guest = false,
  onGuestLimit,
  onGuestEnded,
  sessionId,
}: UseVoiceBotOptions): UseVoiceBotResult {
  const [botState, setBotState]         = useState<VoiceBotState>("idle");
  const [transcript, setTranscript]     = useState("");
  const [amplitude, setAmplitude]       = useState(0);
  const [permissionDenied, setPermission] = useState(false);
  const [voiceMessages, setVoiceMessages] = useState<VoiceMessage[]>([]);
  const [lawyerResults, setLawyerResults] = useState<LawyerMatchResult[]>([]);
  const [lastBooking, setLastBooking]   = useState<VoiceBookedAppointment | null>(null);
  const [errorKind, setErrorKind]       = useState<VoiceErrorKind>(null);
  const [needsGesture, setNeedsGesture] = useState(false);
  const [secondsLeft, setSecondsLeft]   = useState<number | null>(null);
  // Bumped on every connect/stop: an await that resumes under an older generation bails out.
  const connectGenRef = useRef(0);
  const localeRef = useRef(speechLocale);
  const sessionIdRef = useRef(sessionId ?? null);
  const guestTickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // voice_session_ended: set when the mic goes live; reported once per session.
  const sessionStartRef = useRef<number | null>(null);
  const endReasonRef = useRef<VoiceEndedBy | null>(null);

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
  const openRef          = useRef(open);
  const connectRef       = useRef<() => void>(() => {});
  const priorMessagesRef = useRef(priorMessages ?? []);
  // Guest voice: bounded, one-shot session (no auto-reconnect).
  const guestRef         = useRef(guest);
  const guestTimerRef    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onGuestLimitRef  = useRef(onGuestLimit);
  const onGuestEndedRef  = useRef(onGuestEnded);
  const stopRef          = useRef<() => void>(() => {});

  useEffect(() => { openRef.current = open; }, [open]);
  useEffect(() => { priorMessagesRef.current = priorMessages ?? []; }, [priorMessages]);
  useEffect(() => { guestRef.current = guest; }, [guest]);
  useEffect(() => { onGuestLimitRef.current = onGuestLimit; }, [onGuestLimit]);
  useEffect(() => { onGuestEndedRef.current = onGuestEnded; }, [onGuestEnded]);
  useEffect(() => { localeRef.current = speechLocale; }, [speechLocale]);
  useEffect(() => { sessionIdRef.current = sessionId ?? null; }, [sessionId]);

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

  const reportSessionEnd = useCallback((endedBy: VoiceEndedBy) => {
    const started = sessionStartRef.current;
    sessionStartRef.current = null;
    if (!started) return;
    const seconds = (Date.now() - started) / 1000;
    track(AnalyticsEvents.VOICE_SESSION_ENDED, {
      is_guest: guestRef.current,
      duration_bucket: durationBucket(seconds, endedBy, guestRef.current),
      ended_by: endedBy,
    });
  }, []);

  const stop = useCallback(() => {
    reportSessionEnd(endReasonRef.current ?? "user");
    endReasonRef.current = null;
    connectGenRef.current += 1; // cancel any connect still awaiting
    if (guestTimerRef.current) {
      clearTimeout(guestTimerRef.current);
      guestTimerRef.current = null;
    }
    if (guestTickRef.current) {
      clearInterval(guestTickRef.current);
      guestTickRef.current = null;
    }
    setSecondsLeft(null);
    wsRef.current?.close();
    wsRef.current = null;
    stopPlayback();
    stopMic();
    setBotState("idle");
    setTranscript("");
  }, [stopPlayback, stopMic, reportSessionEnd]);
  stopRef.current = stop;

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

    const gen = ++connectGenRef.current;
    const stale = () => gen !== connectGenRef.current || !openRef.current;
    setErrorKind(null);

    void (async () => {
      // Autoplay rules (iOS Safari): without a user tap the audio stays suspended.
      const playCtx = playCtxRef.current!;
      await Promise.race([playCtx.resume(), new Promise((r) => setTimeout(r, 1200))]);
      if (stale()) return;
      if (playCtx.state !== "running") {
        setNeedsGesture(true);
        setBotState("idle");
        return;
      }
      setNeedsGesture(false);

      // Clean up any previous session (WS, worklet, stream) — but NOT AudioContexts.
      // Null wsRef BEFORE closing so the old WS's onclose guard fires and returns early.
      const prevWs = wsRef.current;
      wsRef.current = null;
      prevWs?.close();
      stopPlayback();
      stopMic();

      // Microphone first: a denied mic must not consume the guest's daily preview
      // or open a paid session.
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true },
        });
      } catch (err) {
        if (err instanceof Error && (err.name === "NotAllowedError" || err.name === "PermissionDeniedError")) {
          setPermission(true);
        } else {
          setErrorKind("unavailable");
        }
        setBotState("idle");
        return;
      }
      if (stale()) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      micStreamRef.current = stream;

      let token: string | null;
      if (guestRef.current) {
        try {
          token = await fetchGuestVoiceToken();
        } catch (err) {
          stopMic();
          setBotState("idle");
          if (err instanceof GuestLimitError) onGuestLimitRef.current?.();
          else setErrorKind("unavailable");
          return;
        }
      } else {
        token = await ensureFreshToken();
      }
      if (stale()) {
        stopMic();
        return;
      }
      if (!token) {
        stopMic();
        setBotState("idle");
        setErrorKind("unavailable");
        return;
      }

      setBotState("listening");
      setTranscript("");

      const url = `${researchWsBase()}/api/v1/research/voice/live?token=${encodeURIComponent(token)}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;
      ws.binaryType = "arraybuffer";

      ws.onopen = async () => {
        const micCtx = micCtxRef.current;
        const micStream = micStreamRef.current;
        if (!micCtx || !micStream || wsRef.current !== ws) {
          ws.close();
          return;
        }
        try {
          if (micCtx.state === "suspended") await micCtx.resume();

          // addModule throws if called twice on the same context with the same name
          if (!workletLoadedRef.current) {
            await micCtx.audioWorklet.addModule("/mv-pcm-capture.js");
            workletLoadedRef.current = true;
          }
          if (wsRef.current !== ws) return;

          const source = micCtx.createMediaStreamSource(micStream);
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
          sessionStartRef.current = Date.now();

          // Guest preview clock starts only now that the mic is actually live.
          if (guestRef.current) {
            if (guestTimerRef.current) clearTimeout(guestTimerRef.current);
            if (guestTickRef.current) clearInterval(guestTickRef.current);
            const endsAt = Date.now() + GUEST_SECONDS * 1000;
            setSecondsLeft(GUEST_SECONDS);
            guestTickRef.current = setInterval(() => {
              setSecondsLeft(Math.max(0, Math.round((endsAt - Date.now()) / 1000)));
            }, 1000);
            guestTimerRef.current = setTimeout(() => {
              endReasonRef.current = "limit";
              stopRef.current();
              onGuestEndedRef.current?.();
            }, GUEST_SECONDS * 1000);
          }
        } catch {
          setErrorKind("unavailable");
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
            case "ready":
              ws.send(JSON.stringify({
                type: "context",
                messages: priorMessagesRef.current.slice(-10).map((m) => ({
                  role: m.role,
                  content: m.content.slice(0, 1000),
                })),
                session_id: sessionIdRef.current,
                locale: localeRef.current,
              }));
              break;
            case "guest_ended":
              endReasonRef.current = "limit";
              stopRef.current();
              onGuestEndedRef.current?.();
              break;
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
              setErrorKind("unavailable");
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
        // Closes the server made on purpose are final — don't auto-reconnect into them.
        reportSessionEnd(e.code === 4090 || e.code === 4408 ? "limit" : "error");
        if (e.code === 4001 || e.code === 4029 || e.code === 4402 || e.code === 4408) {
          setErrorKind("unavailable");
        }
      };

      ws.onerror = (e) => {
        if (wsRef.current !== ws) return;
        reportSessionEnd("error");
        console.error("[voice-bot] WebSocket error:", e);
        stopPlayback();
        stopMic();
        setBotState("idle");
      };
    })();
  }, [stopPlayback, stopMic, scheduleChunk, reportSessionEnd]);

  useEffect(() => { connectRef.current = connect; }, [connect]);

  // Auto-start when overlay opens, auto-reconnect when session drops mid-session.
  useEffect(() => {
    if (open) {
      reconnectAttemptsRef.current = 0;
      setPermission(false);
      setErrorKind(null);
      setNeedsGesture(false);
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
    if (!open || botState !== "idle" || permissionDenied || needsGesture || errorKind) return;
    if (guestRef.current) return; // guest voice is a one-shot session — never auto-reconnect
    if (reconnectAttemptsRef.current >= 3) {
      setErrorKind("reconnect_failed");
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
  }, [open, botState, permissionDenied, needsGesture, errorKind]);

  // Cleanup on unmount — close AudioContexts here (and ONLY here)
  useEffect(() => () => {
    stop();
    void micCtxRef.current?.close();
    micCtxRef.current = null;
    void playCtxRef.current?.close();
    playCtxRef.current = null;
  }, [stop]);

  const dismissLastBooking = useCallback(() => setLastBooking(null), []);
  const retry = useCallback(() => {
    reconnectAttemptsRef.current = 0;
    setErrorKind(null);
    setNeedsGesture(false);
    connectRef.current(); // called from a tap, so audio can unlock
  }, []);

  return {
    botState,
    transcript,
    amplitude,
    permissionDenied,
    voiceMessages,
    lawyerResults,
    lastBooking,
    dismissLastBooking,
    startListening: connect,
    interrupt,
    stop,
    errorKind,
    needsGesture,
    secondsLeft,
    retry,
  };
}
