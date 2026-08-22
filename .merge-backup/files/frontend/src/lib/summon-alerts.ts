const DISMISS_KEY = "legalos.summon.dismissed";
const HANDLED_KEY = "legalos.summon.handled";
const MAX_STORED = 40;

function readSet(key: string): Set<string> {
  if (typeof sessionStorage === "undefined") return new Set();
  try {
    const raw = sessionStorage.getItem(key);
    const list: string[] = raw ? JSON.parse(raw) : [];
    return new Set(list);
  } catch {
    return new Set();
  }
}

function writeSet(key: string, set: Set<string>): void {
  if (typeof sessionStorage === "undefined") return;
  const list = Array.from(set).slice(-MAX_STORED);
  sessionStorage.setItem(key, JSON.stringify(list));
}

export function summonSignalKey(appointmentId: string, lastSummonAt: string | null | undefined): string {
  return `${appointmentId}:${lastSummonAt || ""}`;
}

export function isSummonDismissed(signalKey: string): boolean {
  return readSet(DISMISS_KEY).has(signalKey);
}

export function isSummonHandled(signalKey: string): boolean {
  return readSet(HANDLED_KEY).has(signalKey);
}

export function dismissSummonSignal(signalKey: string): void {
  const dismissed = readSet(DISMISS_KEY);
  dismissed.add(signalKey);
  writeSet(DISMISS_KEY, dismissed);
}

export function markSummonHandled(signalKey: string): void {
  const handled = readSet(HANDLED_KEY);
  handled.add(signalKey);
  writeSet(HANDLED_KEY, handled);
}

export function shouldShowSummonAlert(
  appointmentId: string,
  lastSummonAt: string | null | undefined,
  opts: { skipAppointmentId?: string; inRoomPath?: boolean } = {},
): boolean {
  if (!lastSummonAt) return false;
  if (opts.inRoomPath || opts.skipAppointmentId === appointmentId) return false;
  const key = summonSignalKey(appointmentId, lastSummonAt);
  if (isSummonDismissed(key) || isSummonHandled(key)) return false;
  return true;
}
