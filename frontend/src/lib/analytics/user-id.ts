/** SHA-256 hash of user_id UUID for GA4 user_id — never send raw email/name. */
export async function hashUserId(userId: string): Promise<string> {
  if (typeof window === "undefined" || !window.crypto?.subtle) {
    return userId;
  }
  const data = new TextEncoder().encode(userId);
  const hash = await window.crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
