"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Camera, MoreVertical, Paperclip, Phone, Send, Siren, Video, X } from "lucide-react";

import "./room.css";
import { useVisualViewportInset } from "@/hooks/use-visual-viewport-inset";
import { cn } from "@/lib/utils";

import { CallModal } from "@/components/appointment-room/call-modal";
import { IncomingCallOverlay } from "@/components/appointment-room/calls/incoming-call-overlay";
import { OutgoingCallOverlay } from "@/components/appointment-room/calls/outgoing-call-overlay";
import { CameraCapture } from "@/components/appointment-room/camera-capture";
import { ChatPane } from "@/components/appointment-room/chat-pane";
import { RoomCountdown } from "@/components/appointment-room/room-countdown";
import { RoomAlertBanner, type RoomAlertKind } from "@/components/appointment-room/room-alert-banner";
import { RejoinPromptModal } from "@/components/appointment-room/rejoin-prompt-modal";
import { VoiceNoteComposer } from "@/components/appointment-room/voice-note-composer";
import { useAppointmentRoomEvents } from "@/hooks/use-appointment-room-events";
import { useToast } from "@/components/ui/toast";
import {
  cancelAppointmentCall,
  fetchRoomToken,
  getAppointment,
  getAppointmentJoinState,
  getStoredUser,
  getToken,
  leaveAppointment,
  listAppointmentMessages,
  markAppointmentRead,
  postAppointmentMessage,
  postAppointmentTyping,
  reactAppointmentMessage,
  recordAppointmentCallEvent,
  requestAppointmentEmergency,
  resolveAppointmentEmergency,
  respondAppointmentCall,
  ringAppointmentCall,
  summonAppointmentOpponent,
  uploadAppointmentAttachment,
} from "@/lib/api";
import type {
  AppointmentMessage,
  AppointmentRecord,
  CallMode,
  CallPhase,
  IncomingCallPayload,
  JoinStateDto,
  RoomStreamEvent,
  SummonAlertPayload,
  ModerationEventPayload,
} from "@/lib/appointment-types";
import { AnalyticsEvents, track } from "@/lib/analytics";
import { callHub } from "@/lib/call-hub";
import { playAlertChime, requestNotificationPermission, showBrowserNotification, stopCallRingtone } from "@/lib/room-alerts";
import { cleanupLiveKitMedia, disconnectLiveKitRoom, initLiveKitClient } from "@/lib/livekit-room";
import { marketplaceServiceUrl } from "@/lib/service-urls";

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

function myModeration(apt: AppointmentRecord): { status?: string; reason?: string; suspended_until?: string | null } | undefined {
  return apt.my_role === "lawyer" ? apt.lawyer_moderation : apt.citizen_moderation;
}

function isSessionModerationBlocked(apt: AppointmentRecord | null): boolean {
  if (!apt) return false;
  const status = myModeration(apt)?.status;
  return status === "kicked" || status === "suspended";
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
  const searchParams = useSearchParams();
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
  const [callPhase, setCallPhase] = useState<CallPhase>("idle");
  const [callMode, setCallMode] = useState<CallMode>("video");
  const [activeCallId, setActiveCallId] = useState<string | null>(null);
  const [incomingCall, setIncomingCall] = useState<IncomingCallPayload | null>(null);
  const [callBusy, setCallBusy] = useState(false);
  const [callElapsed, setCallElapsed] = useState(0);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const [livekitReady, setLivekitReady] = useState(false);
  const [livekitConfigured, setLivekitConfigured] = useState(false);
  const [livekitConnectFailed, setLivekitConnectFailed] = useState(false);
  const [typingRemote, setTypingRemote] = useState(false);
  const [showSummon, setShowSummon] = useState(false);
  const [summoning, setSummoning] = useState(false);
  const [pingSent, setPingSent] = useState(false);
  const lastPingAt = useRef(0);
  const prevOpponentPresent = useRef<boolean | null>(null);
  const roomRef = useRef<unknown>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const remoteAudioElsRef = useRef<HTMLAudioElement[]>([]);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [, setStreamTick] = useState(0);
  const typingTimer = useRef<number | null>(null);
  const typingSent = useRef(false);
  const callStartedAt = useRef<number | null>(null);
  const ringTimeoutRef = useRef<number | null>(null);
  const autoAcceptRef = useRef<string | null>(null);
  const sseLive = useRef(false);
  const messagesRef = useRef<AppointmentMessage[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);
  const draftRef = useRef<HTMLTextAreaElement>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [voiceOn, setVoiceOn] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpReason, setHelpReason] = useState("");
  const [helpSending, setHelpSending] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const keyboardInset = useVisualViewportInset();
  const [activeAlert, setActiveAlert] = useState<{
    kind: RoomAlertKind;
    title: string;
    body: string;
  } | null>(null);
  const [sessionBlocked, setSessionBlocked] = useState(false);
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

  const teardownLiveKit = useCallback(async () => {
    const room = roomRef.current;
    roomRef.current = null;
    await disconnectLiveKitRoom(room);
    cleanupLiveKitMedia({
      localStreamRef,
      setLocalStream,
      remoteAudioElsRef,
      remoteStreamRef,
    });
    setLivekitReady(false);
  }, []);

  const leave = useCallback(() => {
    void teardownLiveKit().finally(() => {
      void leaveAppointment(appointmentId).catch(() => undefined);
      router.push("/lawyer-marketplace");
    });
  }, [appointmentId, router, teardownLiveKit]);

  const expireToDetails = useCallback(() => {
    void teardownLiveKit().finally(() => {
      router.replace(`/appointments/${appointmentId}`);
    });
  }, [appointmentId, router, teardownLiveKit]);

  const disconnectConference = useCallback(() => {
    void teardownLiveKit();
    if (callPhase === "in_call") {
      setCallPhase("idle");
      setActiveCallId(null);
    }
  }, [callPhase, teardownLiveKit]);

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
      if (event.type === "incoming_call" && event.payload?.call_id) {
        if (event.payload.caller_user_id === userId) return;
        stopCallRingtone();
        void playAlertChime("call");
        setIncomingCall(event.payload);
        setCallPhase("incoming_ring");
        callHub.ingestIncoming(event.payload, { inRoom: true });
        return;
      }
      if (event.type === "call_accepted" && event.payload?.call_id) {
        if (ringTimeoutRef.current) window.clearTimeout(ringTimeoutRef.current);
        stopCallRingtone();
        setIncomingCall(null);
        if (callPhase === "in_call") return;
        setActiveCallId(event.payload.call_id);
        setCallMode(event.payload.mode);
        if (callPhase === "outgoing_ring" || callPhase === "incoming_ring") {
          void enterInCall(event.payload.mode, event.payload.call_id);
        }
        callHub.onAccepted(event.payload, counterpart);
        return;
      }
      if (
        event.type === "call_declined" ||
        event.type === "call_cancelled" ||
        event.type === "call_missed" ||
        event.type === "call_ended"
      ) {
        if (ringTimeoutRef.current) window.clearTimeout(ringTimeoutRef.current);
        stopCallRingtone();
        setIncomingCall(null);
        if (callPhase === "in_call" && event.type === "call_ended") {
          void disableCallTracks();
          toast({ title: "Call ended", description: `${counterpart} left the call.` });
        } else if (callPhase !== "idle") {
          setCallPhase("idle");
          setActiveCallId(null);
        }
        callHub.onDeclinedOrCancelled();
        if (event.type === "call_declined") {
          toast({ title: "Call declined", description: `${counterpart} is unavailable right now.` });
        }
        return;
      }
      if (event.type === "moderation") {
        const payload = event.payload as ModerationEventPayload;
        if (payload.appointment?.id) {
          setApt(payload.appointment);
        }
        const isTarget = payload.target_user_id === userId;
        if (payload.action === "unsuspend") {
          if (isTarget) {
            setSessionBlocked(false);
            setActiveAlert(null);
          }
          return;
        }
        void playAlertChime("ops");
        if (isTarget) {
          setSessionBlocked(true);
          disconnectConference();
          void leaveAppointment(appointmentId).catch(() => undefined);
          const blockedCopy =
            "You cannot rejoin or send messages until platform operations allows you back.";
          if (payload.action === "suspend") {
            setActiveAlert({
              kind: "moderation",
              title: "Suspended by platform ops",
              body: payload.reason ? `${payload.reason} ${blockedCopy}` : blockedCopy,
            });
          } else {
            setActiveAlert({
              kind: "moderation",
              title: "Removed from conference by ops",
              body: payload.reason ? `${payload.reason} ${blockedCopy}` : blockedCopy,
            });
          }
          return;
        }
        const name = payload.target_name || (payload.target === "lawyer" ? "Counsel" : "Citizen");
        setActiveAlert({
          kind: "moderation",
          title: payload.action === "suspend" ? `${name} suspended by ops` : `${name} removed from conference`,
          body:
            payload.reason ||
            (payload.action === "suspend"
              ? "Platform ops temporarily suspended this participant."
              : "Platform ops removed this participant from the conference."),
        });
        setJoin((prev) => (prev ? { ...prev, opponent_present: false } : prev));
        return;
      }
      if (event.type === "counsel_reassigned") {
        const payload = event.payload as AppointmentRecord & {
          removed_counsel_user_id?: string;
          reason?: string;
        };
        const removedId = payload.removed_counsel_user_id;
        if (removedId && userId === removedId) {
          disconnectConference();
          void leaveAppointment(appointmentId).catch(() => undefined);
          setActiveAlert({
            kind: "ops_message",
            title: "Consultation reassigned",
            body:
              payload.reason ||
              "This consultation has been reassigned to another advocate. You no longer have access.",
          });
          toast({
            title: "Consultation reassigned",
            description: payload.reason || "You no longer have access to this appointment.",
            variant: "destructive",
          });
        } else if (payload?.id) {
          setApt(payload);
        }
        return;
      }
      if (event.type === "emergency" || event.type === "ops_update") {
        if (event.payload?.id) {
          const payload = event.payload as AppointmentRecord & { removed_counsel_user_id?: string; reason?: string };
          if (
            payload.removed_counsel_user_id &&
            userId === payload.removed_counsel_user_id &&
            apt?.my_role === "lawyer"
          ) {
            disconnectConference();
            void leaveAppointment(appointmentId).catch(() => undefined);
            setActiveAlert({
              kind: "ops_message",
              title: "Consultation reassigned",
              body: payload.reason || "You no longer have access to this appointment.",
            });
            return;
          }
          setApt(payload);
          syncEmergencyAlert(payload);
          if (payload.scheduled_end_at) {
            setJoin((prev) =>
              prev
                ? {
                    ...prev,
                    scheduled_end_at: payload.scheduled_end_at,
                    emergency_status: payload.emergency_status,
                    emergency_reason: payload.emergency_reason,
                  }
                : prev,
            );
          }
        }
      }
    },
    [appointmentId, callPhase, counterpart, disconnectConference, syncEmergencyAlert, toast, userId],
  );

  const { connected: sseOn } = useAppointmentRoomEvents(appointmentId, onRoomEvent);
  sseLive.current = sseOn;
  messagesRef.current = messages;

  useEffect(() => {
    initLiveKitClient();
    requestNotificationPermission();
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const row = await getAppointment(appointmentId);
        if (cancelled) return;
        setApt(row);
        setSessionBlocked(isSessionModerationBlocked(row));
        setConnecting(false);
        if (isSessionModerationBlocked(row)) {
          const mod = myModeration(row);
          setActiveAlert({
            kind: "moderation",
            title: mod?.status === "kicked" ? "Removed from conference by ops" : "Suspended by platform ops",
            body: mod?.reason
              ? `${mod.reason} You cannot rejoin or send messages until platform operations allows you back.`
              : "You cannot rejoin or send messages until platform operations allows you back.",
          });
          return;
        }
        if (row.join_state === "expired") {
          expireToDetails();
          return;
        }
        if (row.join_state !== "joinable") {
          setError("This appointment is not joinable yet.");
          return;
        }
        const token = await fetchRoomToken(appointmentId);
        track(AnalyticsEvents.CONSULTATION_JOINED, { consultation_mode: "video_chat" });
        const configured = Boolean(token.configured && token.token && token.url);
        setLivekitConfigured(configured);
        setLivekitConnectFailed(false);
        setLivekitReady(configured);
        const history = await listAppointmentMessages(appointmentId);
        if (!cancelled) setMessages(history);
        if (configured && token.token && token.url) {
          const connected = await connectLiveKit(token.url, token.token);
          if (!cancelled) {
            setLivekitReady(connected);
            setLivekitConnectFailed(!connected);
            if (!connected) {
              toast({
                title: "Could not connect to call service",
                description: "Chat still works. Check your network or try rejoining the room.",
                variant: "destructive",
              });
            }
          }
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
      void teardownLiveKit();
      // Record call-end event if navigating away mid-call
      if (callStartedAt.current) {
        const elapsed = Math.max(0, Math.round((Date.now() - callStartedAt.current) / 1000));
        if (elapsed > 0) {
          void recordAppointmentCallEvent(appointmentId, "ended", elapsed).catch(() => undefined);
        }
        callHub.onEnded();
        callStartedAt.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appointmentId]);

  async function connectLiveKit(url: string, token: string): Promise<boolean> {
    try {
      if (
        typeof window !== "undefined" &&
        (window as Window & { __E2E_LIVEKIT__?: boolean }).__E2E_LIVEKIT__
      ) {
        roomRef.current = {
          on: () => undefined,
          connect: async () => undefined,
          disconnect: async () => undefined,
          localParticipant: {
            setCameraEnabled: async () => undefined,
            setMicrophoneEnabled: async () => undefined,
            videoTrackPublications: new Map<string, { track?: { mediaStream?: MediaStream } }>(),
          },
        };
        return true;
      }
      const lk = await import("livekit-client");
      const room = new lk.Room({ dynacast: true, disconnectOnPageLeave: false });
      roomRef.current = room;

      room.on(lk.RoomEvent.Disconnected, () => {
        if (roomRef.current === room) {
          roomRef.current = null;
        }
        cleanupLiveKitMedia({
          localStreamRef,
          setLocalStream,
          remoteAudioElsRef,
          remoteStreamRef,
        });
        setLivekitReady(false);
      });
      const composedRemote = new MediaStream();
      const composedLocal = new MediaStream();

      const getTrackMST = (track: unknown): MediaStreamTrack | undefined => {
        const t = track as Record<string, unknown>;
        if (t.mediaStreamTrack instanceof MediaStreamTrack) return t.mediaStreamTrack;
        const ms = t.mediaStream;
        if (ms instanceof MediaStream) return ms.getTracks()[0];
        return undefined;
      };

      room.on(lk.RoomEvent.ParticipantConnected, () =>
        setJoin((prev) => (prev ? { ...prev, opponent_present: true } : prev)),
      );
      room.on(lk.RoomEvent.ParticipantDisconnected, () =>
        setJoin((prev) => (prev ? { ...prev, opponent_present: false } : prev)),
      );
      room.on(lk.RoomEvent.LocalTrackPublished, (pub: unknown) => {
        const mst = getTrackMST((pub as Record<string, unknown>).track);
        if (mst) {
          composedLocal.getTracks().filter((t) => t.kind === mst.kind).forEach((t) => composedLocal.removeTrack(t));
          composedLocal.addTrack(mst);
          localStreamRef.current = composedLocal;
          setLocalStream(new MediaStream(composedLocal.getTracks()));
        }
      });
      room.on(lk.RoomEvent.TrackSubscribed, (track: unknown) => {
        const t = track as Record<string, unknown>;
        if (t.kind === lk.Track.Kind.Audio) {
          // Use LiveKit's own attach() for audio — handles autoplay + browser compat reliably
          const audioEl = (t.attach as () => HTMLAudioElement)();
          audioEl.autoplay = true;
          audioEl.style.cssText = "position:absolute;width:0;height:0;";
          document.body.appendChild(audioEl);
          remoteAudioElsRef.current.push(audioEl);
        } else if (t.kind === lk.Track.Kind.Video) {
          const mst = getTrackMST(track);
          if (mst) {
            composedRemote.getTracks().filter((t2) => t2.kind === "video").forEach((t2) => composedRemote.removeTrack(t2));
            composedRemote.addTrack(mst);
            remoteStreamRef.current = composedRemote;
            setStreamTick((n) => n + 1);
          }
        }
      });
      room.on(lk.RoomEvent.TrackUnsubscribed, (track: unknown) => {
        const t = track as Record<string, unknown>;
        if (t.kind === lk.Track.Kind.Audio) {
          // Detach and remove audio elements created for this track
          const detach = t.detach as ((el: HTMLAudioElement) => void) | undefined;
          remoteAudioElsRef.current.forEach((el) => { detach?.(el); el.remove(); });
          remoteAudioElsRef.current = [];
        } else if (t.kind === lk.Track.Kind.Video) {
          const mst = getTrackMST(track);
          if (mst) { composedRemote.removeTrack(mst); setStreamTick((n) => n + 1); }
        }
      });
      await room.connect(url, token);
      return true;
    } catch {
      setLivekitReady(false);
      return false;
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
        if (
          js.pending_incoming_call &&
          js.pending_incoming_call.caller_user_id !== userId &&
          callPhase === "idle"
        ) {
          setIncomingCall(js.pending_incoming_call);
          setCallPhase("incoming_ring");
          callHub.ingestIncoming(js.pending_incoming_call, { inRoom: true });
        }
        if (js.join_state === "expired") expireToDetails();
      } catch {
        /* keep last */
      }
    };
    void poll();
    const timer = window.setInterval(() => void poll(), sseOn ? 8000 : 3000);
    return () => window.clearInterval(timer);
  }, [appointmentId, expireToDetails, syncEmergencyAlert, sseOn, userId, callPhase]);

  useEffect(() => {
    if (callPhase !== "in_call" || !callStartedAt.current) {
      setCallElapsed(0);
      return;
    }
    const tick = () => {
      if (!callStartedAt.current) return;
      setCallElapsed(Math.max(0, Math.round((Date.now() - callStartedAt.current) / 1000)));
    };
    tick();
    const timer = window.setInterval(tick, 1000);
    return () => window.clearInterval(timer);
  }, [callPhase]);

  useEffect(() => {
    const acceptId = searchParams.get("acceptCall");
    if (!acceptId || !livekitReady || autoAcceptRef.current === acceptId) return;
    autoAcceptRef.current = acceptId;
    const hub = callHub.getState();
    const mode =
      hub.phase !== "idle" && "mode" in hub && hub.callId === acceptId ? hub.mode : incomingCall?.mode ?? "video";
    void (async () => {
      await enterInCall(mode, acceptId);
      setIncomingCall(null);
      router.replace(`/appointments/${appointmentId}/room`);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [livekitReady, searchParams, appointmentId]);

  useEffect(() => {
    return () => {
      if (ringTimeoutRef.current) window.clearTimeout(ringTimeoutRef.current);
      stopCallRingtone();
    };
  }, []);

  // Hard tab/browser close: send call-end via keepalive fetch so the opponent is notified promptly.
  // React's cleanup (useEffect return) does NOT run reliably on tab close — pagehide does.
  // On React navigation (router.push/back), pagehide does NOT fire, so no double-send.
  useEffect(() => {
    const handlePageHide = () => {
      if (!callStartedAt.current) return;
      const elapsed = Math.max(0, Math.round((Date.now() - callStartedAt.current) / 1000));
      if (elapsed <= 0) return;
      const token = getToken();
      if (!token) return;
      const base = marketplaceServiceUrl();
      void fetch(`${base}/api/v1/appointments/${appointmentId}/call-event`, {
        method: "POST",
        keepalive: true,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ type: "ended", talk_seconds: elapsed }),
      }).catch(() => undefined);
    };
    window.addEventListener("pagehide", handlePageHide);
    return () => window.removeEventListener("pagehide", handlePageHide);
  }, [appointmentId]);

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
    if (sessionBlocked) return;
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
    if (sessionBlocked) return;
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

  async function disableCallTracks() {
    const room = roomRef.current as
      | {
          localParticipant?: {
            setCameraEnabled?: (on: boolean) => Promise<void>;
            setMicrophoneEnabled?: (on: boolean) => Promise<void>;
          };
        }
      | null;
    await room?.localParticipant?.setCameraEnabled?.(false);
    await room?.localParticipant?.setMicrophoneEnabled?.(false);
    const elapsed = callStartedAt.current ? Math.max(0, Math.round((Date.now() - callStartedAt.current) / 1000)) : 0;
    callStartedAt.current = null;
    if (elapsed > 0) {
      void recordAppointmentCallEvent(appointmentId, "ended", elapsed).catch(() => undefined);
    }
    setCallPhase("idle");
    setActiveCallId(null);
    setCallElapsed(0);
    callHub.onEnded();
  }

  async function enterInCall(mode: CallMode, callId: string) {
    if (!livekitReady) return;
    const room = roomRef.current as
      | {
          localParticipant?: {
            setCameraEnabled?: (on: boolean) => Promise<void>;
            setMicrophoneEnabled?: (on: boolean) => Promise<void>;
            videoTrackPublications?: Map<string, { track?: { mediaStream?: MediaStream } }>;
          };
        }
      | null;
    setCameraOff(mode === "audio");
    setMuted(false);
    await room?.localParticipant?.setMicrophoneEnabled?.(true);
    await room?.localParticipant?.setCameraEnabled?.(mode === "video");
    room?.localParticipant?.videoTrackPublications?.forEach((pub) => {
      if (pub.track?.mediaStream) {
        localStreamRef.current = pub.track.mediaStream;
        setLocalStream(pub.track.mediaStream);
      }
    });
    callStartedAt.current = Date.now();
    setActiveCallId(callId);
    setCallMode(mode);
    setCallPhase("in_call");
    void recordAppointmentCallEvent(appointmentId, "started").catch(() => undefined);
  }

  async function startCall(mode: CallMode) {
    if (!livekitReady) {
      const description = livekitConfigured
        ? "Call service is configured but not connected. Try leaving and rejoining the room."
        : "LiveKit is not configured. Chat still works.";
      toast({ title: "Call unavailable", description });
      return;
    }
    setCallBusy(true);
    try {
      const payload = await ringAppointmentCall(appointmentId, mode);
      const callId = payload.call_id;
      setCallMode(mode);
      setActiveCallId(callId);
      setCallPhase("outgoing_ring");
      callHub.startOutgoing({
        appointmentId,
        callId,
        mode,
        counterpartName: counterpart,
      });
      if (ringTimeoutRef.current) window.clearTimeout(ringTimeoutRef.current);
      ringTimeoutRef.current = window.setTimeout(() => {
        void cancelOutgoing(callId);
        toast({ title: "No answer", description: `${counterpart} did not answer.` });
      }, 45000);
    } catch (err) {
      toast({ title: "Could not start call", description: (err as Error).message, variant: "destructive" });
    } finally {
      setCallBusy(false);
    }
  }

  async function cancelOutgoing(callIdOverride?: string) {
    const callId = callIdOverride ?? activeCallId;
    if (!callId || (callPhase !== "outgoing_ring" && !callIdOverride)) return;
    setCallBusy(true);
    try {
      await cancelAppointmentCall(appointmentId, callId);
    } catch {
      /* ignore */
    } finally {
      if (ringTimeoutRef.current) window.clearTimeout(ringTimeoutRef.current);
      stopCallRingtone();
      setCallPhase("idle");
      setActiveCallId(null);
      callHub.onDeclinedOrCancelled();
      setCallBusy(false);
    }
  }

  async function acceptIncoming() {
    if (!incomingCall) return;
    setCallBusy(true);
    try {
      await respondAppointmentCall(appointmentId, incomingCall.call_id, "accept");
      stopCallRingtone();
      await enterInCall(incomingCall.mode, incomingCall.call_id);
      setIncomingCall(null);
      callHub.onAccepted(incomingCall, counterpart);
    } catch (err) {
      toast({ title: "Could not join call", description: (err as Error).message, variant: "destructive" });
    } finally {
      setCallBusy(false);
    }
  }

  async function declineIncoming() {
    if (!incomingCall) return;
    setCallBusy(true);
    try {
      await respondAppointmentCall(appointmentId, incomingCall.call_id, "decline");
    } catch {
      /* ignore */
    } finally {
      stopCallRingtone();
      setIncomingCall(null);
      setCallPhase("idle");
      callHub.onDeclinedOrCancelled();
      setCallBusy(false);
    }
  }

  async function endCall() {
    setCallBusy(true);
    try {
      await disableCallTracks();
    } finally {
      setCallBusy(false);
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
  // Show video stage whenever camera is on, regardless of initiated call mode
  const effectiveMode: CallMode = callMode === "audio" && cameraOff ? "audio" : "video";

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

  const callStatusLabel = livekitReady
    ? "Calls on"
    : livekitConfigured && livekitConnectFailed
      ? "Call failed"
      : livekitConfigured
        ? "Connecting"
        : "Chat only";

  return (
    <div className="apt-room flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="apt-room-header mx-auto w-full max-w-[680px] shrink-0 px-4 pb-2 pt-1 sm:py-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={leave}
            aria-label="Leave room"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-muted-foreground hover:bg-black/[0.04] hover:text-foreground dark:hover:bg-white/10"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-semibold tracking-tight">{counterpart}</p>
            <p className="mt-0.5 hidden truncate text-[11px] text-muted-foreground sm:block">
              {present ? "In the room" : "Not present"} · <RoomCountdown endAt={endAt} /> remaining
              {sseOn ? " · Live" : " · Reconnecting"} · {callStatusLabel}
            </p>
          </div>
          <div className="hidden shrink-0 items-center gap-2 sm:flex">
            {callPhase === "idle" && livekitReady && !sessionBlocked && (
              <>
                <button
                  type="button"
                  onClick={() => void startCall("audio")}
                  disabled={callBusy}
                  aria-label="Start audio call"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-black/[0.08] bg-white text-slate-600 shadow-sm hover:bg-slate-50 hover:text-primary disabled:opacity-40 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-300 dark:hover:bg-white/10"
                >
                  <Phone className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => void startCall("video")}
                  disabled={callBusy}
                  aria-label="Start video call"
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 disabled:opacity-40"
                >
                  <Video className="h-4 w-4" />
                </button>
                <div className="h-4 w-px bg-black/10 dark:bg-white/10" />
              </>
            )}
            {!emergencyActive ? (
              <button
                type="button"
                onClick={() => setHelpOpen(true)}
                className="inline-flex min-h-11 items-center rounded-xl border border-amber-500/40 bg-amber-50 px-3 text-[12px] font-semibold text-amber-900 hover:bg-amber-100 dark:bg-amber-950/40 dark:text-amber-100"
              >
                <Siren className="mr-1 h-3.5 w-3.5" />
                Request help
              </button>
            ) : (
              <button
                type="button"
                onClick={() => void resolveAppointmentEmergency(appointmentId).then(setApt).catch(() => undefined)}
                className="inline-flex min-h-11 items-center rounded-xl border border-emerald-500/40 px-3 text-[12px] font-semibold text-emerald-800 dark:text-emerald-200"
              >
                Mark resolved
              </button>
            )}
            <button type="button" className="mp-btn-primary min-h-11 rounded-xl px-3 text-[12px] font-semibold" onClick={leave}>
              <X className="mr-1 h-3.5 w-3.5" />
              Leave
            </button>
          </div>
          <div className="relative sm:hidden">
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              aria-label="Room menu"
              aria-expanded={menuOpen}
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground hover:bg-black/[0.04] dark:hover:bg-white/10"
            >
              <MoreVertical className="h-5 w-5" />
            </button>
            {menuOpen ? (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-40"
                  onClick={() => setMenuOpen(false)}
                  aria-label="Close menu"
                />
                <div className="absolute right-0 top-full z-50 mt-1 min-w-[11rem] max-w-[calc(100vw-2rem)] overflow-hidden rounded-xl border border-black/[0.08] bg-background py-1 shadow-lg dark:border-white/10">
                  {!emergencyActive ? (
                    <button
                      type="button"
                      onClick={() => {
                        setHelpOpen(true);
                        setMenuOpen(false);
                      }}
                      className="flex w-full min-h-11 items-center px-4 text-left text-[13px] font-medium"
                    >
                      <Siren className="mr-2 h-4 w-4 shrink-0" />
                      Request help
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        void resolveAppointmentEmergency(appointmentId).then(setApt).catch(() => undefined);
                        setMenuOpen(false);
                      }}
                      className="flex w-full min-h-11 items-center px-4 text-left text-[13px] font-medium text-emerald-700 dark:text-emerald-300"
                    >
                      Mark resolved
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setMenuOpen(false);
                      leave();
                    }}
                    className="flex w-full min-h-11 items-center px-4 text-left text-[13px] font-medium text-red-600 dark:text-red-400"
                  >
                    <X className="mr-2 h-4 w-4 shrink-0" />
                    Leave room
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
        <div className="mt-2 flex items-center gap-2 sm:hidden">
          <div className="apt-room-actions-scroll min-w-0 flex-1">
            <span className="shrink-0 rounded-full bg-black/[0.04] px-2 py-1 text-[10px] font-medium dark:bg-white/[0.08]">
              {present ? "In room" : "Waiting"}
            </span>
            <span className="shrink-0 rounded-full bg-black/[0.04] px-2 py-1 text-[10px] font-medium tabular-nums dark:bg-white/[0.08]">
              <RoomCountdown endAt={endAt} /> left
            </span>
            <span className="shrink-0 rounded-full bg-black/[0.04] px-2 py-1 text-[10px] font-medium dark:bg-white/[0.08]">
              {sseOn ? "Live" : "Reconnecting"}
            </span>
            <span className="shrink-0 rounded-full bg-black/[0.04] px-2 py-1 text-[10px] font-medium dark:bg-white/[0.08]">
              {callStatusLabel}
            </span>
          </div>
          {callPhase === "idle" && livekitReady && !sessionBlocked ? (
            <div className="flex shrink-0 items-center gap-1.5">
              <button
                type="button"
                onClick={() => void startCall("audio")}
                disabled={callBusy}
                aria-label="Start audio call"
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-black/[0.08] bg-white text-slate-600 shadow-sm disabled:opacity-40 dark:border-white/10 dark:bg-white/[0.05] dark:text-slate-300"
              >
                <Phone className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => void startCall("video")}
                disabled={callBusy}
                aria-label="Start video call"
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm disabled:opacity-40"
              >
                <Video className="h-4 w-4" />
              </button>
            </div>
          ) : null}
        </div>
      </header>

      {activeAlert ? (
        <div className="mx-auto w-full max-w-[680px] shrink-0 px-4 pb-2">
          <RoomAlertBanner
            kind={activeAlert.kind}
            title={activeAlert.title}
            body={activeAlert.body}
            onDismiss={activeAlert.kind === "moderation" ? undefined : () => setActiveAlert(null)}
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

      {callPhase === "in_call" && (
        <CallModal
          localStream={localStream}
          remoteStream={remoteStreamRef.current}
          counterpartName={counterpart}
          mode={effectiveMode}
          muted={muted}
          cameraOff={cameraOff}
          elapsedLabel={`${Math.floor(callElapsed / 60)}:${String(callElapsed % 60).padStart(2, "0")}`}
          isRemoteConnected={!!(join?.opponent_present ?? apt?.opponent_present)}
          onToggleMute={() => void toggleMute()}
          onToggleCamera={() => void toggleCamera()}
          onEnd={() => void endCall()}
          ending={callBusy}
        />
      )}

      {callPhase === "incoming_ring" && incomingCall ? (
        <IncomingCallOverlay
          counterpartName={incomingCall.caller_name}
          mode={incomingCall.mode}
          onAccept={() => void acceptIncoming()}
          onDecline={() => void declineIncoming()}
          busy={callBusy}
        />
      ) : null}

      {callPhase === "outgoing_ring" ? (
        <OutgoingCallOverlay
          counterpartName={counterpart}
          mode={callMode}
          onCancel={() => void cancelOutgoing()}
          cancelling={callBusy}
        />
      ) : null}

      {!sessionBlocked ? (
      <form
        onSubmit={handleSend}
        className="mx-auto w-full max-w-[680px] shrink-0 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2"
        style={
          keyboardInset > 0
            ? { paddingBottom: `calc(max(0.75rem, env(safe-area-inset-bottom)) + ${keyboardInset}px)` }
            : undefined
        }
      >
        <div
          className={cn(
            "flex gap-2 border-t border-black/[0.06] pt-3 dark:border-white/[0.08]",
            voiceOn ? "flex-col sm:flex-row sm:items-end" : "items-end",
          )}
        >
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
          {!voiceOn ? (
            <div className="flex shrink-0 items-end gap-2">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground hover:bg-black/[0.04] hover:text-foreground dark:hover:bg-white/10"
                aria-label="Attach file"
              >
                <Paperclip className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => setCameraOpen(true)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-muted-foreground hover:bg-black/[0.04] hover:text-foreground dark:hover:bg-white/10"
                aria-label="Camera shot"
              >
                <Camera className="h-4 w-4" />
              </button>
              <VoiceNoteComposer
                onActiveChange={setVoiceOn}
                onSend={(file, caption) => shareFile(file, "voice", caption)}
              />
            </div>
          ) : (
            <VoiceNoteComposer
              onActiveChange={setVoiceOn}
              onSend={(file, caption) => shareFile(file, "voice", caption)}
            />
          )}
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
                className="no-scrollbar max-h-28 min-h-11 flex-1 resize-none bg-transparent px-1 py-2.5 text-[13.5px] outline-none"
              />
              <button type="submit" className="mp-btn-accent h-11 w-11 shrink-0 rounded-xl" disabled={sending || !draft.trim()}>
                <Send className="h-4 w-4" />
              </button>
            </>
          ) : null}
        </div>
      </form>
      ) : (
        <div className="mx-auto w-full max-w-[680px] shrink-0 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-2 text-center text-[12px] text-muted-foreground">
          Messaging is disabled until platform operations allows you to rejoin.
        </div>
      )}

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
        reuseStream={callPhase === "in_call" ? localStream : null}
        onClose={() => setCameraOpen(false)}
        onSend={(file, caption) => shareFile(file, "screenshot", caption)}
      />
      {helpOpen ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4">
          <button
            type="button"
            className="absolute inset-0"
            onClick={() => setHelpOpen(false)}
            aria-label="Close help request"
          />
          <div className="apt-bottom-sheet apt-bottom-sheet-panel relative w-full max-w-sm rounded-t-3xl bg-background p-4 shadow-xl sm:rounded-2xl">
            <h3 className="text-[15px] font-semibold">Request ops help</h3>
            <p className="mt-1 text-[12px] text-muted-foreground">Describe what you need. Admins can extend time, reassign counsel, or send guidance.</p>
            <textarea
              value={helpReason}
              onChange={(e) => setHelpReason(e.target.value)}
              rows={3}
              placeholder="Brief reason…"
              className="mt-3 w-full resize-none rounded-xl border border-black/[0.08] bg-transparent px-3 py-2 text-[13px] outline-none dark:border-white/10"
            />
            <div className="mt-3 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                className="min-h-11 rounded-xl px-3 text-[12px] font-medium"
                onClick={() => setHelpOpen(false)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={helpSending}
                className="mp-btn-accent min-h-11 rounded-xl px-4 text-[12px] font-semibold"
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
