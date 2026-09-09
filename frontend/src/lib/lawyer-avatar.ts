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
  const remote = lawyer.photo_url?.trim();
  if (remote) return remote;
  const key = lawyer.slug || lawyer.id;
  if (!key) return DEFAULT_LAWYER_AVATAR;
  return lawyerAvatarSrc(key);
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
