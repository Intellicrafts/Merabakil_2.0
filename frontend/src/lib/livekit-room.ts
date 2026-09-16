/**
 * LiveKit helpers — graceful disconnect and suppression of expected teardown noise
 * (DataChannel User-Initiated Abort / closed unexpectedly during kick or leave).
 */

const SUPPRESSED_LOG_FRAGMENTS = [
  "User-Initiated Abort",
  "closed unexpectedly",
  "Abort connection attempt due to user initiated disconnect",
  "DataChannel error on lossy",
  "DataChannel error on reliable",
];

let loggingConfigured = false;

export function initLiveKitClient(): void {
  if (loggingConfigured || typeof window === "undefined") return;
  loggingConfigured = true;

  void import("livekit-client").then((lk) => {
    lk.setLogLevel(lk.LogLevel.warn);
    lk.setLogExtension((level, msg) => {
      if (SUPPRESSED_LOG_FRAGMENTS.some((fragment) => msg.includes(fragment))) {
        return;
      }
      if (level >= lk.LogLevel.error) {
        console.error(`[livekit] ${msg}`);
      } else if (level >= lk.LogLevel.warn) {
        console.warn(`[livekit] ${msg}`);
      }
    });
  });
}

type LiveKitRoomLike = {
  state?: string;
  disconnect?: (stopLocalTracks?: boolean) => Promise<void>;
};

const disconnectInFlight = new WeakMap<object, Promise<void>>();

export async function disconnectLiveKitRoom(room: unknown): Promise<void> {
  if (!room || typeof room !== "object") return;
  const key = room as object;
  const pending = disconnectInFlight.get(key);
  if (pending) return pending;

  const run = (async () => {
    const r = room as LiveKitRoomLike;
    try {
      if (r.state === "disconnected") return;
      await r.disconnect?.(true);
    } catch {
      /* expected during kick, navigation, or concurrent teardown */
    }
  })();

  disconnectInFlight.set(key, run);
  try {
    await run;
  } finally {
    disconnectInFlight.delete(key);
  }
}

export function cleanupLiveKitMedia(options: {
  localStreamRef: { current: MediaStream | null };
  setLocalStream?: (stream: MediaStream | null) => void;
  remoteAudioElsRef?: { current: HTMLAudioElement[] };
  remoteStreamRef?: { current: MediaStream | null };
}): void {
  options.localStreamRef.current?.getTracks().forEach((track) => track.stop());
  options.localStreamRef.current = null;
  options.setLocalStream?.(null);
  options.remoteStreamRef && (options.remoteStreamRef.current = null);
  options.remoteAudioElsRef?.current.forEach((el) => {
    try {
      el.pause();
      el.srcObject = null;
      el.remove();
    } catch {
      /* ignore */
    }
  });
  if (options.remoteAudioElsRef) options.remoteAudioElsRef.current = [];
}
