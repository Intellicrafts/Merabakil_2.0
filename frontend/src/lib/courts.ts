/** The High Court(s) for a state, as named in the courts list (lib/mock/lawyers JURISDICTIONS). */
export function highCourtsForState(state: string): string[] {
  const s = state.toLowerCase();
  if (s.includes("uttar pradesh")) return ["Allahabad High Court"];
  if (s.includes("uttarakhand")) return ["Uttarakhand High Court"];
  if (s.includes("delhi")) return ["Delhi High Court"];
  if (s.includes("andhra pradesh") || s.includes("telangana")) return ["Hyderabad High Court"];
  if (s.includes("rajasthan")) return ["Rajasthan High Court"];
  if (s.includes("maharashtra") || s.includes("goa")) return ["Bombay High Court"];
  if (s.includes("karnataka")) return ["Karnataka High Court"];
  if (s.includes("tamil nadu") || s.includes("puducherry")) return ["Madras High Court"];
  if (s.includes("west bengal") || s.includes("andaman")) return ["Calcutta High Court"];
  if (s.includes("kerala") || s.includes("lakshadweep")) return ["Kerala High Court"];
  if (s.includes("gujarat") || s.includes("dadra")) return ["Gujarat High Court"];
  if (s.includes("punjab") || s.includes("haryana") || s.includes("chandigarh")) return ["Punjab and Haryana High Court"];
  if (s.includes("himachal")) return ["Himachal Pradesh High Court"];
  if (s.includes("bihar") || s.includes("jharkhand")) return ["Patna High Court"];
  if (s.includes("madhya pradesh") || s.includes("chhattisgarh")) return ["Madhya Pradesh High Court"];
  if (s.includes("odisha") || s.includes("orissa")) return ["Orissa High Court"];
  if (
    ["assam", "manipur", "meghalaya", "nagaland", "mizoram", "arunachal", "tripura", "sikkim"].some((n) =>
      s.includes(n),
    )
  )
    return ["Gauhati High Court"];
  if (s.includes("jammu") || s.includes("kashmir") || s.includes("ladakh")) return ["Jammu & Kashmir and Ladakh High Court"];
  return [];
}
