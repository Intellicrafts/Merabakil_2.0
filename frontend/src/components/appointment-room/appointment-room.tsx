"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Mic, MicOff, Paperclip, Phone, PhoneOff, Send, Siren, Video, VideoOff, X } from "lucide-react";

import { CallStage } from "@/components/appointment-room/call-stage";
import { CameraCapture } from "@/components/appointment-room/camera-capture";
import { ChatPane } from "@/components/appointment-room/chat-pane";
import { RoomCountdown } from "@/components/appointment-room/room-countdown";
import { RoomAlertBanner, type RoomAlertKind } from "@/components/appointment-room/room-alert-banner";
import { RejoinPromptModal } from "@/components/appointment-room/rejoin-prompt-modal";
import { VoiceNoteComposer } from "@/components/appointment-room/voice-note-composer";
import { useAppointmentRoomEvents } from "@/hooks/use-appointment-room-events";
import { useToast } from "@/components/ui/toast";
import {
  fetchRoomToken,
  getAppointment,
  getAppointmentJoinState,
  getStoredUser,
  leaveAppointment,
  listAppointmentMessages,
  markAppointmentRead,
  postAppointmentMessage,
  postAppointmentTyping,
  reactAppointmentMessage,
  recordAppointmentCallEvent,
  requestAppointmentEmergency,
  resolveAppointmentEmergency,
  summonAppointmentOpponent,
  uploadAppointmentAttachment,
} from "@/lib/api";
import type { AppointmentMessage, AppointmentRecord, JoinStateDto, RoomStreamEvent, SummonAlertPayload } from "@/lib/appointment-types";
import {
  playAlertChime,
  requestNotificationPermission,
  showBrowserNotification,
} from "@/lib/room-alerts";
import { cn } from "@/lib/utils";

function mergeJoinIntoApt(apt: AppointmentRecord, js: JoinStateDto): AppointmentRecord {
  return {
    ...apt,
    join_state: js.join_state,
    seconds_until_start: js.seconds_until_start,
    seconds_until_end: js.seconds_until_end,
    opponent_present: js.opponent_present,
    pending_summon: js.pending_summon,
    scheduled_at: js.scheduled_at,
    scheduled_end_at: js.scheduled_end_at,
    status: (js.status as AppointmentRecord["status"]) ?? apt.status,
    priority: js.priority ?? apt.priority,
    emergency_status: js.emergency_status ?? apt.emergency_status,
    emergency_reason: js.emergency_reason ?? apt.emergency_reason,
    last_summon_at: js.last_summon_at ?? apt.last_summon_at,
  };
}

function formatCountdown(totalSeconds: number): string {
  const seconds = Math.max(0, totalSeconds);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${s}s`;
}

function secondsUntil(iso: string | null | undefined): number {
  if (!iso) return 0;
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return 0;
  return Math.max(0, Math.round((ts - Date.now()) / 1000));
}

function mergeMessage(prev: AppointmentMessage[], incoming: AppointmentMessage): AppointmentMessage[] {
  if (prev.some((item) => item.id === incoming.id)) {
    return prev.map((item) => (item.id === incoming.id ? { ...item, ...incoming, pending: false } : item));
  }
  const pendingIdx = prev.findIndex(
    (item) =>
      item.pending &&
      item.sender_user_id === incoming.sender_user_id &&
      (item.body === incoming.body || item.attachment_id === incoming.attachment_id),
  );
  if (pendingIdx >= 0) {
    const next = [...prev];
    next[pendingIdx] = { ...incoming, pending: false };
    return next;
  }
  return [...prev, incoming];
}

interface AppointmentRoomProps {
  appointmentId: string;
}

export function AppointmentRoom({ appointmentId }: AppointmentRoomProps) {
  const router = useRouter();
  const { toast } = useToast();
  const user = useMemo(() => getStoredUser(), []);
  const userId = user?.user_id ?? "";
  const [apt, setApt] = useState<AppointmentRecord | null>(null);
  const [connecting, setConnecting] = useState(true);
  const [join, setJoin] = useState<JoinStateDto | null>(null);
  const [messages, setMessages] = useState<AppointmentMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [callOn, setCallOn] = useState(false);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [livekitReady, setLivekitReady] = useState(false);
  const [typingRemote, setTypingRemote] = useState(false);
  const [showSummon, setShowSummon] = useState(false);
  const [summoning, setSummoning] = useState(false);
  const [pingSent, setPingSent] = useState(false);
  const lastPingAt = useRef(0);
  const prevOpponentPresent = useRef<boolean | null>(null);
  const roomRef = useRef<unknown>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [, setStreamTick] = useState(0);
  const typingTimer = useRef<number | null>(null);
  const typingSent = useRef(false);
  const callStartedAt = useRef<number | null>(null);
  const sseLive = useRef(false);
  const messagesRef = useRef<AppointmentMessage[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const draftRef = useRef<HTMLTextAreaElement>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [voiceOn, setVoiceOn] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpReason, setHelpReason] = useState("");
  const [helpSending, setHelpSending] = useState(false);
  const [activeAlert, setActiveAlert] = useState<{
    kind: RoomAlertKind;
    title: string;
    body: string;
  } | null>(null);
  const lastEmergencyStatus = useRef<string>("none");

  const counterpart = apt?.counterpart_name ?? "Counsel";

  const syncEmergencyAlert = useCallback((record: AppointmentRecord) => {
    const status = record.emergency_status ?? "none";
    if (status === lastEmergencyStatus.current) return;
    lastEmergencyStatus.current = status;
    if (status === "open") {
      void playAlertChime("emergency");
      showBrowserNotification("Ops notified", record.emergency_reason || "Your help request was sent to platform ops.");
      setActiveAlert({
        kind: "emergency",
        title: "Ops has been notified",
        body: record.emergency_reason || "An administrator will review your request shortly.",
      });
      return;
    }
    if (status === "ack") {
      void playAlertChime("ops");
      setActiveAlert({
        kind: "ops_ack",
        title: "Ops acknowledged your request",
        body: "An administrator is reviewing this appointment.",
      });
      return;
    }
    if (status === "resolved") {
      setActiveAlert(null);
    }
  }, []);

  const leave = useCallback(() => {
    const room = roomRef.current as { disconnect?: () => Promise<void> } | null;
    void room?.disconnect?.();
    roomRef.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    setLocalStream(null);
    remoteStreamRef.current = null;
    void leaveAppointment(appointmentId).catch(() => undefined);
    router.push("/lawyer-marketplace");
  }, [appointmentId, router]);

  const expireToDetails = useCallback(() => {
    const room = roomRef.current as { disconnect?: () => Promise<void> } | null;
    void room?.disconnect?.();
    router.replace(`/appointments/${appointmentId}`);
  }, [appointmentId, router]);

  const onRoomEvent = useCallback(
    (event: RoomStreamEvent) => {
      if (event.type === "message" || event.type === "attachment") {
        if (!event.payload?.id) return;
        if (event.payload.sender_role === "admin") {
          void playAlertChime("ops");
          setActiveAlert({
            kind: "ops_message",
            title: "Message from ops",
            body: event.payload.body,
          });
        }
        setMessages((prev) => mergeMessage(prev, event.payload));
        return;
      }
      if (event.type === "typing" && event.payload.user_id && event.payload.user_id !== userId) {
        setTypingRemote(Boolean(event.payload.on));
        return;
      }
      if (event.type === "reaction" && event.payload.messageId) {
        setMessages((prev) =>
          prev.map((item) =>
            item.id === event.payload.messageId ? { ...item, reactions: event.payload.reactions } : item,
          ),
        );
        return;
      }
      if (event.type === "summon") {
        const payload = event.payload as SummonAlertPayload;
        if (payload.target_user_id && payload.target_user_id !== userId) return;
        setJoin((prev) => ({ ...(prev ?? ({} as JoinStateDto)), ...payload, pending_summon: false }));
        setApt((prev) => (prev ? mergeJoinIntoApt(prev, { ...payload, pending_summon: false }) : prev));
        return;
      }
      if (event.type === "emergency" || event.type === "ops_update") {
        if (event.payload?.id) {
          setApt(event.payload);
          syncEmergencyAlert(event.payload);
          if (event.payload.scheduled_end_at) {
            setJoin((prev) =>
              prev
                ? {
                    ...prev,
                    scheduled_end_at: event.payload.scheduled_end_at,
                    emergency_status: event.payload.emergency_status,
                    emergency_reason: event.payload.emergency_reason,
                  }
                : prev,
            );
          }
        }
      }
    },
    [counterpart, syncEmergencyAlert, userId],
  );

  const { connected: sseOn } = useAppointmentRoomEvents(appointmentId, onRoomEvent);
  sseLive.current = sseOn;
  messagesRef.current = messages;

  useEffect(() => {
    requestNotificationPermission();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const row = await getAppointment(appointmentId);
        if (cancelled) return;
        setApt(row);
        setConnecting(false);
        if (row.join_state === "expired") {
          expireToDetails();
          return;
        }
        if (row.join_state !== "joinable") {
          setError("This appointment is not joinable yet.");
          return;
        }
        const token = await fetchRoomToken(appointmentId);
        setLivekitReady(Boolean(token.configured && token.token && token.url));
        const history = await listAppointmentMessages(appointmentId);
        if (!cancelled) setMessages(history);
        if (token.configured && token.token && token.url) {
          await connectLiveKit(token.url, token.token);
        }
      } catch (err) {
        if (!cancelled) {
          const message = (err as Error).message;
          if (message.toLowerCase().includes("join window") || message.toLowerCase().includes("closed")) {
            expireToDetails();
            return;
          }
          setError(message);
        }
        if (!cancelled) setConnecting(false);
      }
    })();
    return () => {
      cancelled = true;
      const room = roomRef.current as { disconnect?: () => Promise<void> } | null;
      void room?.disconnect?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointmentId]);

  async function connectLiveKit(url: string, token: string) {
    try {
      const lk = await import("livekit-client");
      const room = new lk.Room({ adaptiveStream: true, dynacast: true });
      roomRef.current = room;
      room.on(lk.RoomEvent.ParticipantConnected, () =>
        setJoin((prev) => (prev ? { ...prev, opponent_present: true } : prev)),
      );
      room.on(lk.RoomEvent.ParticipantDisconnected, () =>
        setJoin((prev) => (prev ? { ...prev, opponent_present: false } : prev)),
      );
      room.on(lk.RoomEvent.LocalTrackPublished, (pub: { track?: { mediaStream?: MediaStream } }) => {
        const track = pub.track;
        if (track?.mediaStream) {
          localStreamRef.current = track.mediaStream;
          setLocalStream(track.mediaStream);
        }
      });
      room.on(lk.RoomEvent.TrackSubscribed, (track: { kind: unknown; mediaStream?: MediaStream }) => {
        if (track.kind === lk.Track.Kind.Video || track.kind === lk.Track.Kind.Audio) {
          const media = track.mediaStream;
          if (media) {
            remoteStreamRef.current = media;
            setStreamTick((n) => n + 1);
          }
        }
      });
      await room.connect(url, token);
    } catch {
      setLivekitReady(false);
    }
  }

  useEffect(() => {
    const poll = async () => {
      try {
        const js = await getAppointmentJoinState(appointmentId);
        setJoin(js);
        setApt((prev) => (prev ? mergeJoinIntoApt(prev, js) : prev));
        if (!js.pending_summon) {
          setActiveAlert((prev) => (prev?.kind === "summon" ? null : prev));
        }
        if (js.emergency_status && js.emergency_status !== "none") {
          syncEmergencyAlert({
            id: appointmentId,
            emergency_status: js.emergency_status,
            emergency_reason: js.emergency_reason ?? "",
          } as AppointmentRecord);
        }
        if (!sseOn) setTypingRemote(Boolean(js.opponent_typing));
        if (js.join_state === "expired") expireToDetails();
      } catch {
        /* keep last */
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), sseOn ? 8000 : 3000);
    return () => window.clearInterval(timer);
  }, [appointmentId, counterpart, expireToDetails, syncEmergencyAlert, sseOn]);

  useEffect(() => {
    if (sseOn) return undefined;
    let cancelled = false;
    const pull = async () => {
      try {
        const persisted = messagesRef.current.filter((item) => !item.pending && !item.id.startsWith("tmp-"));
        const last = persisted[persisted.length - 1];
        const rows = await listAppointmentMessages(appointmentId, last?.id);
        if (cancelled || rows.length === 0) return;
        setMessages((prev) => rows.reduce((acc, row) => mergeMessage(acc, row), prev));
      } catch {
        /* keep last */
      }
    };
    void pull();
    const timer = window.setInterval(() => void pull(), 3500);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [appointmentId, sseOn]);

  useEffect(() => {
    if (!join && !apt) return;
    const present = join?.opponent_present ?? apt?.opponent_present;
    const joinable = (join?.join_state ?? apt?.join_state) === "joinable";
    if (prevOpponentPresent.current === false && present === true) {
      toast({ title: `${counterpart} joined the room`, variant: "success" });
      setShowSummon(false);
      setPingSent(false);
    }
    prevOpponentPresent.current = present ?? null;
    if (joinable && present === false) {
      const recentlyPinged = Date.now() - lastPingAt.current < 30_000;
      if (recentlyPinged) return undefined;
      const timer = window.setTimeout(() => setShowSummon(true), 600);
      return () => window.clearTimeout(timer);
    }
    setShowSummon(false);
    return undefined;
  }, [join?.opponent_present, join?.join_state, apt?.opponent_present, apt?.join_state, counterpart, toast]);

  const lastMessageId = messages[messages.length - 1]?.id;
  useEffect(() => {
    if (!lastMessageId || lastMessageId.startsWith("tmp-")) return;
    void markAppointmentRead(appointmentId, lastMessageId).catch(() => undefined);
  }, [appointmentId, lastMessageId]);

  useEffect(() => {
    if (apt) syncEmergencyAlert(apt);
  }, [apt?.emergency_status, apt?.emergency_reason, apt, syncEmergencyAlert]);

  const setTyping = useCallback(
    (on: boolean) => {
      if (on) {
        if (!typingSent.current) {
          typingSent.current = true;
          void postAppointmentTyping(appointmentId, true).catch(() => undefined);
        }
        return;
      }
      if (!typingSent.current) return;
      typingSent.current = false;
      void postAppointmentTyping(appointmentId, false).catch(() => undefined);
    },
    [appointmentId],
  );

  async function handleSend(e?: React.FormEvent) {
    e?.preventDefault();
    const body = draft.trim();
    if (!body || sending) return;
    const tempId = `tmp-${crypto.randomUUID()}`;
    const optimistic: AppointmentMessage = {
      id: tempId,
      sender_user_id: userId,
      sender_role: apt?.my_role ?? "citizen",
      body,
      created_at: new Date().toISOString(),
      reactions: {},
      kind: "text",
      pending: true,
    };
    setSending(true);
    setDraft("");
    if (draftRef.current) draftRef.current.style.height = "auto";
    setTyping(false);
    setMessages((prev) => [...prev, optimistic]);
    try {
      const saved = await postAppointmentMessage(appointmentId, body);
      setMessages((prev) => mergeMessage(prev.filter((item) => item.id !== tempId), saved));
    } catch (err) {
      setMessages((prev) => prev.filter((item) => item.id !== tempId));
      setDraft(body);
      toast({ title: "Message not sent", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  }

  async function handleReact(messageId: string, emoji: string) {
    try {
      const updated = await reactAppointmentMessage(appointmentId, messageId, emoji);
      setMessages((prev) =>
        prev.map((item) => (item.id === messageId ? { ...item, reactions: updated.reactions } : item)),
      );
    } catch {
      /* ignore */
    }
  }

  async function shareFile(file: File, kind: "document" | "image" | "screenshot" | "voice", caption?: string) {
    const tempId = `tmp-${crypto.randomUUID()}`;
    const note = caption?.trim() || file.name;
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        sender_user_id: userId,
        sender_role: apt?.my_role ?? "citizen",
        body: note,
        created_at: new Date().toISOString(),
        reactions: {},
        kind: "attachment",
        pending: true,
      },
    ]);
    try {
      const saved = await uploadAppointmentAttachment(appointmentId, file, { kind, caption: note });
      setMessages((prev) => mergeMessage(prev.filter((item) => item.id !== tempId), saved));
    } catch (err) {
      setMessages((prev) => prev.filter((item) => item.id !== tempId));
      toast({ title: "Could not share file", description: (err as Error).message, variant: "destructive" });
      throw err;
    }
  }

  async function toggleCall() {
    if (!livekitReady) {
      toast({ title: "Call unavailable", description: "LiveKit is not configured. Chat still works." });
      return;
    }
    const room = roomRef.current as
      | {
          localParticipant?: {
            setCameraEnabled?: (on: boolean) => Promise<void>;
            setMicrophoneEnabled?: (on: boolean) => Promise<void>;
          };
        }
      | null;
    if (!callOn) {
      await room?.localParticipant?.setCameraEnabled?.(!cameraOff);
      await room?.localParticipant?.setMicrophoneEnabled?.(!muted);
      const lp = roomRef.current as {
        localParticipant?: { videoTrackPublications?: Map<string, { track?: { mediaStream?: MediaStream } }> };
      } | null;
      lp?.localParticipant?.videoTrackPublications?.forEach((pub) => {
        if (pub.track?.mediaStream) {
          localStreamRef.current = pub.track.mediaStream;
          setLocalStream(pub.track.mediaStream);
        }
      });
      callStartedAt.current = Date.now();
      void recordAppointmentCallEvent(appointmentId, "started").catch(() => undefined);
      setCallOn(true);
    } else {
      const elapsed = callStartedAt.current ? Math.max(0, Math.round((Date.now() - callStartedAt.current) / 1000)) : 0;
      callStartedAt.current = null;
      await room?.localParticipant?.setCameraEnabled?.(false);
      await room?.localParticipant?.setMicrophoneEnabled?.(false);
      void recordAppointmentCallEvent(appointmentId, "ended", elapsed).catch(() => undefined);
      setCallOn(false);
    }
  }

  async function toggleMute() {
    const next = !muted;
    setMuted(next);
    const room = roomRef.current as
      | { localParticipant?: { setMicrophoneEnabled?: (on: boolean) => Promise<void> } }
      | null;
    await room?.localParticipant?.setMicrophoneEnabled?.(!next);
  }

  async function toggleCamera() {
    const next = !cameraOff;
    setCameraOff(next);
    const room = roomRef.current as
      | { localParticipant?: { setCameraEnabled?: (on: boolean) => Promise<void> } }
      | null;
    await room?.localParticipant?.setCameraEnabled?.(!next);
  }

  async function handleForce() {
    setSummoning(true);
    try {
      await summonAppointmentOpponent(appointmentId);
      lastPingAt.current = Date.now();
      setPingSent(true);
      toast({ title: "Join request sent", description: `${counterpart} will be notified instantly.` });
      setShowSummon(false);
    } catch (err) {
      toast({ title: "Could not send request", description: (err as Error).message, variant: "destructive" });
    } finally {
      setSummoning(false);
    }
  }

  const endAt = join?.scheduled_end_at ?? apt?.scheduled_end_at;

  if (error) {
    return (
      <div className="mx-auto max-w-lg py-16 text-center">
        <p className="text-sm font-semibold">{error}</p>
        <button type="button" className="mp-btn-primary mt-4 h-9 rounded-xl px-4 text-[13px]" onClick={leave}>
          Back to appointments
        </button>
      </div>
    );
  }

  if (!apt) {
    return (
      <div className="mx-auto w-full max-w-[680px] space-y-4 px-4 py-6">
        <div className="h-64 animate-pulse rounded-3xl bg-white/40 dark:bg-white/[0.04]" />
        {connecting && (
          <p className="text-center text-sm text-muted-foreground">Connecting to appointment room…</p>
        )}
      </div>
    );
  }

  const present = join?.opponent_present ?? apt.opponent_present;
  const emergencyActive = apt.emergency_status === "open" || apt.emergency_status === "ack";

  async function handleRequestHelp() {
    const reason = helpReason.trim();
    if (reason.length < 3) {
      toast({ title: "Add a short reason", variant: "destructive" });
      return;
    }
    setHelpSending(true);
    try {
      const updated = await requestAppointmentEmergency(appointmentId, reason);
      setApt(updated);
      syncEmergencyAlert(updated);
      setHelpOpen(false);
      setHelpReason("");
    } catch (err) {
      const message = (err as Error).message;
      toast({
        title: "Could not request help",
        description: message.includes("500")
          ? "Ops service may need a restart. Restart the marketplace server on port 8010."
          : message,
        variant: "destructive",
      });
    } finally {
      setHelpSending(false);
    }
  }

  return (
    <div className="apt-room flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="mx-auto flex w-full max-w-[680px] shrink-0 items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="truncate text-[15px] font-semibold tracking-tight">{counterpart}</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">
            {present ? "In the room" : "Not present"} · <RoomCountdown endAt={endAt} /> remaining
            {sseOn ? " · Live" : " · Reconnecting"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {!emergencyActive ? (
            <button
              type="button"
              onClick={() => setHelpOpen(true)}
              className="inline-flex h-9 items-center rounded-xl border border-amber-500/40 bg-amber-50 px-3 text-[12px] font-semibold text-amber-900 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-100"
            >
              <Siren className="mr-1 h-3.5 w-3.5" />
              Request help
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void resolveAppointmentEmergency(appointmentId).then(setApt).catch(() => undefined)}
              className="inline-flex h-9 items-center rounded-xl border border-emerald-500/40 px-3 text-[12px] font-semibold text-emerald-800 dark:text-emerald-200"
            >
              Mark resolved
            </button>
          )}
          <button type="button" className="mp-btn-primary h-9 rounded-xl px-3 text-[12px] font-semibold" onClick={leave}>
            <X className="mr-1 h-3.5 w-3.5" />
            Leave
          </button>
        </div>
      </header>

      {activeAlert ? (
        <div className="mx-auto w-full max-w-[680px] shrink-0 px-4 pb-2">
          <RoomAlertBanner
            kind={activeAlert.kind}
            title={activeAlert.title}
            body={activeAlert.body}
            onDismiss={() => setActiveAlert(null)}
          />
        </div>
      ) : null}

      {emergencyActive && !activeAlert ? (
        <div className="mx-auto w-full max-w-[680px] shrink-0 px-4 pb-2">
          <RoomAlertBanner
            kind={apt.emergency_status === "ack" ? "ops_ack" : "emergency"}
            title={apt.emergency_status === "ack" ? "Ops acknowledged your request" : "Ops has been notified"}
            body={apt.emergency_reason || "An administrator is reviewing this appointment."}
            onDismiss={() => setActiveAlert(null)}
          />
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden md:flex-row">
        {callOn && (
          <div className="mx-auto h-[28vh] max-h-56 w-full max-w-[680px] shrink-0 px-4 md:mx-0 md:h-auto md:max-h-none md:w-[40%] md:min-h-0">
            <CallStage
              visible={callOn}
              localStream={localStream}
              remoteStream={remoteStreamRef.current}
              counterpartName={counterpart}
            />
          </div>
        )}
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <ChatPane
            appointmentId={appointmentId}
            messages={messages}
            userId={userId}
            typing={typingRemote}
            counterpartName={counterpart}
            onReact={handleReact}
          />
        </div>
      </div>

      <form
        onSubmit={handleSend}
        className="mx-auto w-full max-w-[680px] shrink-0 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2"
      >
        <div className="mb-2 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void toggleCall()}
            className={cn("h-9 rounded-xl px-3 text-[12px] font-semibold", callOn ? "mp-btn-accent" : "mp-btn-primary")}
          >
            {callOn ? <PhoneOff className="mr-1 h-3.5 w-3.5" /> : <Phone className="mr-1 h-3.5 w-3.5" />}
            {callOn ? "End call" : "Call"}
          </button>
          <button
            type="button"
            onClick={() => void toggleMute()}
            className="mp-btn-primary h-9 rounded-xl px-3 text-[12px]"
            disabled={!callOn}
          >
            {muted ? <MicOff className="h-3.5 w-3.5" /> : <Mic className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => void toggleCamera()}
            className="mp-btn-primary h-9 rounded-xl px-3 text-[12px]"
            disabled={!callOn}
          >
            {cameraOff ? <VideoOff className="h-3.5 w-3.5" /> : <Video className="h-3.5 w-3.5" />}
          </button>
        </div>
        <div className="flex items-end gap-2 border-t border-black/[0.06] pt-3 dark:border-white/[0.08]">
          <input
            ref={fileRef}
            type="file"
            className="hidden"
            accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.webp,application/pdf,image/*"
            onChange={(e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (file) void shareFile(file, file.type.startsWith("image/") ? "image" : "document").catch(() => undefined);
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="mb-0.5 inline-flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground hover:bg-black/[0.04] hover:text-foreground dark:hover:bg-white/10"
            aria-label="Attach file"
          >
            <Paperclip className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setCameraOpen(true)}
            className="mb-0.5 inline-flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground hover:bg-black/[0.04] hover:text-foreground dark:hover:bg-white/10"
            aria-label="Camera shot"
          >
            <Camera className="h-4 w-4" />
          </button>
          <VoiceNoteComposer
            onActiveChange={setVoiceOn}
            onSend={(file, caption) => shareFile(file, "voice", caption)}
          />
          {!voiceOn ? (
            <>
              <textarea
                ref={draftRef}
                value={draft}
                onChange={(e) => {
                  setDraft(e.target.value);
                  e.target.style.height = "auto";
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 112)}px`;
                  setTyping(true);
                  if (typingTimer.current) window.clearTimeout(typingTimer.current);
                  typingTimer.current = window.setTimeout(() => setTyping(false), 1200);
                }}
                onBlur={() => setTyping(false)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    void handleSend();
                  }
                }}
                rows={1}
                placeholder="Write a message"
                className="no-scrollbar max-h-28 min-h-10 flex-1 resize-none bg-transparent px-1 py-2 text-[13.5px] outline-none"
              />
              <button type="submit" className="mp-btn-accent h-10 w-10 rounded-xl" disabled={sending || !draft.trim()}>
                <Send className="h-4 w-4" />
              </button>
            </>
          ) : null}
        </div>
      </form>

      {showSummon && !present && (
        <RejoinPromptModal
          counterpartName={counterpart}
          waiting={summoning}
          sent={pingSent}
          onWait={() => setShowSummon(false)}
          onSendRequest={() => void handleForce()}
        />
      )}
      <CameraCapture
        open={cameraOpen}
        reuseStream={callOn ? localStream : null}
        onClose={() => setCameraOpen(false)}
        onSend={(file, caption) => shareFile(file, "screenshot", caption)}
      />
      {helpOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-sm rounded-2xl bg-background p-4 shadow-xl">
            <h3 className="text-[15px] font-semibold">Request ops help</h3>
            <p className="mt-1 text-[12px] text-muted-foreground">Describe what you need. Admins can extend time, reassign counsel, or send guidance.</p>
            <textarea
              value={helpReason}
              onChange={(e) => setHelpReason(e.target.value)}
              rows={3}
              placeholder="Brief reason…"
              className="mt-3 w-full resize-none rounded-xl border border-black/[0.08] bg-transparent px-3 py-2 text-[13px] outline-none dark:border-white/10"
            />
            <div className="mt-3 flex justify-end gap-2">
              <button type="button" className="h-9 rounded-xl px-3 text-[12px]" onClick={() => setHelpOpen(false)}>
                Cancel
              </button>
              <button
                type="button"
                disabled={helpSending}
                className="mp-btn-accent h-9 rounded-xl px-3 text-[12px] font-semibold"
                onClick={() => void handleRequestHelp()}
              >
                {helpSending ? "Sending…" : "Notify ops"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
