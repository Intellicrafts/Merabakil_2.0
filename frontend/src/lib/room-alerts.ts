export type AlertVariant = "summon" | "emergency" | "ops" | "call";

const MUTE_KEY = "legalos.room-alerts.muted";

let audioCtx: AudioContext | null = null;

function ctx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!audioCtx) {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return null;
    audioCtx = new Ctx();
  }
  return audioCtx;
}

export function isAlertsMuted(): boolean {
  if (typeof window === "undefined") return false;
  return sessionStorage.getItem(MUTE_KEY) === "1";
}

export function setAlertsMuted(muted: boolean): void {
  if (typeof window === "undefined") return;
  sessionStorage.setItem(MUTE_KEY, muted ? "1" : "0");
}

export function shouldPlaySound(): boolean {
  return !isAlertsMuted();
}

export async function playAlertChime(variant: AlertVariant = "summon"): Promise<void> {
  if (!shouldPlaySound()) return;
  const ac = ctx();
  if (!ac) return;
  if (ac.state === "suspended") await ac.resume().catch(() => undefined);

  const tones: Record<AlertVariant, [number, number]> = {
    summon: [523.25, 659.25],
    emergency: [440, 554.37],
    ops: [392, 493.88],
    call: [440, 523.25],
  };
  const [a, b] = tones[variant];
  const now = ac.currentTime;
  const gain = ac.createGain();
  gain.connect(ac.destination);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.12, now + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);

  for (const [i, freq] of [a, b].entries()) {
    const osc = ac.createOscillator();
    osc.type = "sine";
    osc.frequency.value = freq;
    osc.connect(gain);
    const start = now + i * 0.11;
    osc.start(start);
    osc.stop(start + 0.14);
  }
}

export function requestNotificationPermission(): void {
  if (typeof Notification === "undefined" || Notification.permission !== "default") return;
  void Notification.requestPermission().catch(() => undefined);
}

export function showBrowserNotification(title: string, body: string, tagId?: string): void {
  if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
  try {
    const tag = tagId ? `legalos-${tagId}` : `legalos-${title}`;
    new Notification(title, { body, tag, silent: false });
  } catch {
    /* ignore */
  }
}

let ringTimer: number | null = null;
let ringNodes: { osc: OscillatorNode; gain: GainNode }[] = [];

export function stopCallRingtone(): void {
  if (typeof window !== "undefined" && ringTimer !== null) {
    window.clearInterval(ringTimer);
    ringTimer = null;
  }
  for (const node of ringNodes) {
    try {
      node.osc.stop();
      node.osc.disconnect();
      node.gain.disconnect();
    } catch {
      /* already stopped */
    }
  }
  ringNodes = [];
}

export async function playCallRingtone(): Promise<void> {
  if (!shouldPlaySound()) return;
  stopCallRingtone();
  const ac = ctx();
  if (!ac) return;
  if (ac.state === "suspended") await ac.resume().catch(() => undefined);

  const pulse = () => {
    const now = ac.currentTime;
    for (const [i, freq] of [440, 523.25].entries()) {
      const gain = ac.createGain();
      gain.connect(ac.destination);
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.exponentialRampToValueAtTime(0.1, now + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
      const osc = ac.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq;
      osc.connect(gain);
      osc.start(now + i * 0.08);
      osc.stop(now + 0.5);
      ringNodes.push({ osc, gain });
    }
  };

  pulse();
  ringTimer = window.setInterval(pulse, 2200);
}
