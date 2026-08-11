/** Deterministic avatar path for mock lawyer profiles. */
export function lawyerAvatarSrc(lawyerId: string): string {
  return `/marketplace/avatars/${lawyerId}.svg`;
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
