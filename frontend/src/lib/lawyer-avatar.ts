/** Bundled professional portrait used when a lawyer has no photo. */
export const DEFAULT_LAWYER_AVATAR = "/marketplace/avatars/default.svg";

/** Deterministic avatar path — prefer slug (`lw-001`) over UUID. */
export function lawyerAvatarSrc(idOrSlug: string): string {
  return `/marketplace/avatars/${idOrSlug}.svg`;
}

export function resolveLawyerPhotoSrc(lawyer: {
  id: string;
  slug?: string | null;
  photo_url?: string | null;
}): string {
  const key = lawyer.slug || lawyer.id;
  if (!key) {
    const remote = lawyer.photo_url?.trim();
    if (remote && isValidAvatarUrl(remote)) return remote;
    return DEFAULT_LAWYER_AVATAR;
  }
  return lawyerAvatarSrc(key);
}

function isValidAvatarUrl(url: string): boolean {
  // Only allow URLs that start with http/https and are not Minio internal URLs
  if (!url.startsWith("http")) return false;
  // Skip Minio/S3 internal URLs that won't be accessible from browser
  if (url.includes("minio") || url.includes("localhost")) return false;
  return true;
}

export function counselAvatarKey(lawyer: { id: string; slug?: string | null }): string {
  return lawyer.slug || lawyer.id;
}

export function lawyerInitials(name: string): string {
  return name
    .replace(/^Adv\.\s*/i, "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0])
    .join("")
    .toUpperCase();
}
