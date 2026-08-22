/** Deterministic avatar path — prefer slug (`lw-001`) over UUID. */
export function lawyerAvatarSrc(idOrSlug: string): string {
  return `/marketplace/avatars/${idOrSlug}.svg`;
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
