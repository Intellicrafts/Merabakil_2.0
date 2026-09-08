const AVATAR_KEY = "legalos.avatar_url";

export function storeAvatarUrl(url?: string | null): void {
  if (typeof window === "undefined") return;
  const trimmed = url?.trim();
  if (!trimmed) return;
  window.localStorage.setItem(AVATAR_KEY, trimmed);
}

export function readAvatarUrl(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(AVATAR_KEY);
}

export function clearAvatarUrl(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(AVATAR_KEY);
}
