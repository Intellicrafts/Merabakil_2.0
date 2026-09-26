import { ChatStreamError, GuestLimitError, type ChatErrorCode } from "@/lib/api";

const KEY_BY_CODE: Record<ChatErrorCode, string> = {
  network: "chat.errorNetwork",
  offline: "chat.errorOffline",
  timeout: "chat.errorTimeout",
  rate_limited: "chat.errorRateLimited",
  insufficient_balance: "chat.errorBalance",
  ai_unavailable: "chat.errorAiUnavailable",
  interrupted: "chat.errorInterrupted",
  rejected: "chat.errorRejected",
  auth: "chat.errorAuth",
  server_error: "chat.errorServer",
};

/** Normalise anything thrown by a Saarthi stream into a ChatErrorCode. */
export function chatErrorCode(err: unknown): ChatErrorCode {
  if (err instanceof ChatStreamError) return err.code;
  if (err instanceof GuestLimitError) return "rate_limited";
  if (typeof navigator !== "undefined" && navigator.onLine === false) return "offline";
  return "server_error";
}

/** Friendly, translated copy for a failed answer — never raw server text. */
export function chatErrorMessage(t: (key: string) => string, code: ChatErrorCode): string {
  return t(KEY_BY_CODE[code] ?? KEY_BY_CODE.server_error);
}
