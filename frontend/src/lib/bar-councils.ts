/**
 * State Bar Councils whose enrolments Satyapan can verify. `value` is what the
 * API expects and must stay in step with Satyapan's BAR_COUNCILS table.
 * Punjab, Haryana and Chandigarh share one council.
 */
export const BAR_COUNCILS = [
  { value: "Uttar Pradesh", label: "Uttar Pradesh" },
  { value: "Delhi", label: "Delhi" },
  { value: "Andhra Pradesh", label: "Andhra Pradesh" },
  { value: "Rajasthan", label: "Rajasthan" },
  { value: "Punjab & Haryana", label: "Punjab, Haryana & Chandigarh" },
] as const;

/** The council an enrolment number belongs to, from its prefix ("" if unknown). */
export function detectBarCouncil(enrollment: string): string {
  const en = enrollment.toUpperCase().trim();
  if (en.startsWith("UP")) return "Uttar Pradesh";
  if (en.startsWith("D/")) return "Delhi";
  if (en.startsWith("AP/")) return "Andhra Pradesh";
  if (en.startsWith("R/")) return "Rajasthan";
  if (/^PH?[/-]/.test(en)) return "Punjab & Haryana";
  return "";
}

/**
 * The council for a state ("" if Satyapan can't check it). An advocate's office
 * state decides which council checks their enrolment — mirrors lawyer-marketplace
 * app/application/bar_councils.py.
 */
export function barCouncilForState(state: string): string {
  const s = state.toLowerCase();
  if (s.includes("uttar pradesh")) return "Uttar Pradesh";
  if (s.includes("delhi")) return "Delhi";
  if (s.includes("andhra pradesh")) return "Andhra Pradesh";
  if (s.includes("rajasthan")) return "Rajasthan";
  if (s.includes("punjab") || s.includes("haryana") || s.includes("chandigarh")) return "Punjab & Haryana";
  return "";
}

/** "Bar Council of Punjab, Haryana & Chandigarh" for a council value. */
export function barCouncilName(council: string): string {
  return `Bar Council of ${BAR_COUNCILS.find((c) => c.value === council)?.label ?? council}`;
}
