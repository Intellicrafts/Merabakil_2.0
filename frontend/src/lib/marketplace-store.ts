import { CITIES, MOCK_LAWYERS } from "@/lib/mock/lawyers";
import type { ConsultationBooking, LawyerProfile } from "@/lib/types";

const APPOINTMENTS_KEY = "legalos.appointments";
const MATCH_PREFS_KEY = "legalos.match_preferences";

export type LocationMode = "auto" | "manual" | "current";

export interface MatchPreferences {
  practiceAreas: string[];
  locationMode: LocationMode;
  city: string;
  experienceAuto: boolean;
  minExperience: number;
  verifiedOnly: boolean;
  budgetAuto: boolean;
  maxRateInr: number | null;
}

export const DEFAULT_MATCH_PREFERENCES: MatchPreferences = {
  practiceAreas: ["Criminal"],
  locationMode: "auto",
  city: "Delhi",
  experienceAuto: true,
  minExperience: 5,
  verifiedOnly: true,
  budgetAuto: true,
  maxRateInr: null,
};

export interface RankedLawyer extends LawyerProfile {
  match_score: number;
  ai_recommended: boolean;
}

/** Approximate city centroids for nearest-city geolocation. */
const CITY_COORDS: Record<string, { lat: number; lng: number }> = {
  Delhi: { lat: 28.6139, lng: 77.209 },
  Mumbai: { lat: 19.076, lng: 72.8777 },
  Bengaluru: { lat: 12.9716, lng: 77.5946 },
  Chennai: { lat: 13.0827, lng: 80.2707 },
  Hyderabad: { lat: 17.385, lng: 78.4867 },
  Kolkata: { lat: 22.5726, lng: 88.3639 },
  Pune: { lat: 18.5204, lng: 73.8567 },
  Ahmedabad: { lat: 23.0225, lng: 72.5714 },
};

export function resolveAutoCity(): string {
  return "Delhi";
}

export function resolveEffectiveCity(prefs: MatchPreferences): string {
  if (prefs.locationMode === "auto") return resolveAutoCity();
  return prefs.city || resolveAutoCity();
}

export function nearestCityFromCoords(lat: number, lng: number): string {
  let best = CITIES[0] as string;
  let bestDist = Number.POSITIVE_INFINITY;
  for (const city of CITIES) {
    const c = CITY_COORDS[city];
    if (!c) continue;
    const d = (c.lat - lat) ** 2 + (c.lng - lng) ** 2;
    if (d < bestDist) {
      bestDist = d;
      best = city;
    }
  }
  return best;
}

export function loadMatchPreferences(): MatchPreferences {
  if (typeof window === "undefined") return { ...DEFAULT_MATCH_PREFERENCES };
  try {
    const raw = window.localStorage.getItem(MATCH_PREFS_KEY);
    if (!raw) return { ...DEFAULT_MATCH_PREFERENCES };
    return { ...DEFAULT_MATCH_PREFERENCES, ...(JSON.parse(raw) as MatchPreferences) };
  } catch {
    return { ...DEFAULT_MATCH_PREFERENCES };
  }
}

export function saveMatchPreferences(prefs: MatchPreferences): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MATCH_PREFS_KEY, JSON.stringify(prefs));
}

export function scoreLawyerForPreferences(
  lawyer: LawyerProfile,
  prefs: MatchPreferences,
): number {
  const city = resolveEffectiveCity(prefs);
  let score = 50;
  score += (lawyer.rating - 4) * 16;
  score += Math.min(lawyer.review_count, 150) / 20;
  score += Math.min(lawyer.years_experience, 25) * 0.5;

  const areaHits = prefs.practiceAreas.filter((a) => lawyer.practice_areas.includes(a)).length;
  if (prefs.practiceAreas.length > 0) {
    score += (areaHits / prefs.practiceAreas.length) * 22;
  }
  if (lawyer.city === city) score += 12;
  else if (lawyer.jurisdictions.some((j) => j.toLowerCase().includes(city.toLowerCase()))) {
    score += 6;
  }

  if (!prefs.experienceAuto) {
    if (lawyer.years_experience >= prefs.minExperience) score += 10;
    else score -= (prefs.minExperience - lawyer.years_experience) * 1.5;
  } else {
    score += Math.min(lawyer.years_experience, 18) * 0.4;
  }

  if (prefs.verifiedOnly) {
    if (lawyer.verified) score += 10;
    else score -= 20;
  } else if (lawyer.verified) {
    score += 4;
  }

  if (!prefs.budgetAuto && prefs.maxRateInr != null) {
    if (lawyer.hourly_rate_inr == null) score += 2;
    else if (lawyer.hourly_rate_inr <= prefs.maxRateInr) score += 8;
    else score -= 12;
  }

  return Math.max(35, Math.min(99, Math.round(score)));
}

export function buildTrustReasons(
  lawyer: LawyerProfile,
  prefs: MatchPreferences,
): string[] {
  const city = resolveEffectiveCity(prefs);
  const reasons: string[] = [];
  const areaHits = prefs.practiceAreas.filter((a) => lawyer.practice_areas.includes(a));
  if (areaHits.length > 0) {
    reasons.push(`Practice area fit · ${areaHits.join(", ")}`);
  }
  if (lawyer.verified) reasons.push("Bar-verified credentials");
  if (lawyer.city === city) reasons.push(`Location match · ${lawyer.city}`);
  else if (lawyer.jurisdictions.length) {
    reasons.push(`Jurisdiction coverage · ${lawyer.jurisdictions.slice(0, 2).join(", ")}`);
  }
  if (prefs.experienceAuto || lawyer.years_experience >= prefs.minExperience) {
    reasons.push(`${lawyer.years_experience}+ years of practice`);
  }
  if (lawyer.rating >= 4.5) {
    reasons.push(`High client rating · ${lawyer.rating.toFixed(1)}`);
  }
  reasons.push("Selected by AI as best fit for your preferences");
  return reasons.slice(0, 5);
}

export interface MatchResult {
  lawyer: RankedLawyer;
  runnersUp: RankedLawyer[];
  reasons: string[];
  preferences: MatchPreferences;
  effectiveCity: string;
  matched_at?: string;
}

const MATCH_HISTORY_KEY = "legalos.match_history";
const MAX_MATCH_HISTORY = 8;

export function loadMatchHistory(): MatchResult[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(MATCH_HISTORY_KEY);
    return raw ? (JSON.parse(raw) as MatchResult[]) : [];
  } catch {
    return [];
  }
}

export function getLastMatch(): MatchResult | null {
  return loadMatchHistory()[0] ?? null;
}

export function saveMatchToHistory(result: MatchResult): MatchResult[] {
  if (typeof window === "undefined") return [];
  const entry: MatchResult = {
    ...result,
    matched_at: result.matched_at ?? new Date().toISOString(),
  };
  const prev = loadMatchHistory().filter((m) => m.lawyer.id !== entry.lawyer.id);
  const next = [entry, ...prev].slice(0, MAX_MATCH_HISTORY);
  window.localStorage.setItem(MATCH_HISTORY_KEY, JSON.stringify(next));
  return next;
}

export function findBestMatch(prefs: MatchPreferences): MatchResult | null {
  let pool = [...MOCK_LAWYERS];
  if (prefs.verifiedOnly) pool = pool.filter((l) => l.verified);
  if (!prefs.experienceAuto) {
    pool = pool.filter((l) => l.years_experience >= prefs.minExperience);
  }
  if (!prefs.budgetAuto && prefs.maxRateInr != null) {
    pool = pool.filter(
      (l) => l.hourly_rate_inr == null || l.hourly_rate_inr <= prefs.maxRateInr!,
    );
  }
  if (pool.length === 0) pool = [...MOCK_LAWYERS];

  const ranked: RankedLawyer[] = pool
    .map((l) => ({
      ...l,
      match_score: scoreLawyerForPreferences(l, prefs),
      ai_recommended: true,
    }))
    .sort((a, b) => b.match_score - a.match_score || b.rating - a.rating);

  const best = ranked[0];
  if (!best) return null;

  return {
    lawyer: best,
    runnersUp: ranked.slice(1, 6),
    reasons: buildTrustReasons(best, prefs),
    preferences: prefs,
    effectiveCity: resolveEffectiveCity(prefs),
  };
}

export type LawyerSort = "rating" | "experience" | "rate" | "match";

export interface LawyerFilters {
  query?: string;
  practiceArea?: string;
  city?: string;
  verifiedOnly?: boolean;
  sort?: LawyerSort;
}

function readAppointments(): ConsultationBooking[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(APPOINTMENTS_KEY);
    return raw ? (JSON.parse(raw) as ConsultationBooking[]) : [];
  } catch {
    return [];
  }
}

function writeAppointments(items: ConsultationBooking[]): void {
  window.localStorage.setItem(APPOINTMENTS_KEY, JSON.stringify(items));
}

/** Heuristic AI match score (0–100) from active filters + profile strength. */
export function computeMatchScore(
  lawyer: LawyerProfile,
  filters: LawyerFilters = {},
): number {
  let score = 58;
  score += (lawyer.rating - 4) * 18;
  score += Math.min(lawyer.review_count, 150) / 25;
  score += Math.min(lawyer.years_experience, 20) * 0.6;
  if (lawyer.verified) score += 8;
  if (filters.practiceArea && lawyer.practice_areas.includes(filters.practiceArea)) {
    score += 14;
  }
  if (filters.city && lawyer.city === filters.city) score += 10;
  const q = filters.query?.trim().toLowerCase() ?? "";
  if (q) {
    if (lawyer.full_name.toLowerCase().includes(q)) score += 6;
    if (lawyer.practice_areas.some((a) => a.toLowerCase().includes(q))) score += 5;
    if (lawyer.city.toLowerCase().includes(q)) score += 4;
  }
  return Math.max(42, Math.min(99, Math.round(score)));
}

export function listLawyers(filters: LawyerFilters = {}): RankedLawyer[] {
  const q = filters.query?.trim().toLowerCase() ?? "";
  let list = [...MOCK_LAWYERS];

  if (q) {
    list = list.filter(
      (l) =>
        l.full_name.toLowerCase().includes(q) ||
        l.city.toLowerCase().includes(q) ||
        l.practice_areas.some((a) => a.toLowerCase().includes(q)) ||
        l.bio.toLowerCase().includes(q),
    );
  }
  if (filters.practiceArea) {
    list = list.filter((l) => l.practice_areas.includes(filters.practiceArea!));
  }
  if (filters.city) {
    list = list.filter((l) => l.city === filters.city);
  }
  if (filters.verifiedOnly) {
    list = list.filter((l) => l.verified);
  }

  const ranked: RankedLawyer[] = list.map((l) => ({
    ...l,
    match_score: computeMatchScore(l, filters),
    ai_recommended: false,
  }));

  const sort = filters.sort ?? "rating";
  ranked.sort((a, b) => {
    if (sort === "experience") return b.years_experience - a.years_experience;
    if (sort === "rate") {
      const ar = a.hourly_rate_inr ?? Number.MAX_SAFE_INTEGER;
      const br = b.hourly_rate_inr ?? Number.MAX_SAFE_INTEGER;
      return ar - br;
    }
    if (sort === "match") return b.match_score - a.match_score;
    return b.rating - a.rating || b.review_count - a.review_count;
  });

  const topIds = new Set(
    [...ranked]
      .sort((a, b) => b.match_score - a.match_score)
      .slice(0, 3)
      .map((l) => l.id),
  );
  for (const lawyer of ranked) {
    lawyer.ai_recommended = topIds.has(lawyer.id) && lawyer.match_score >= 78;
  }

  return ranked;
}

export function getFeaturedLawyers(limit = 3): RankedLawyer[] {
  return listLawyers({ sort: "rating", verifiedOnly: true }).slice(0, limit);
}

export function getLawyer(id: string): LawyerProfile | null {
  return MOCK_LAWYERS.find((l) => l.id === id) ?? null;
}

export function listMyAppointments(): ConsultationBooking[] {
  return readAppointments().sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

export function bookConsultation(input: {
  lawyer_id: string;
  date: string;
  time_slot: string;
  matter_summary: string;
}): ConsultationBooking {
  const lawyer = getLawyer(input.lawyer_id);
  if (!lawyer) throw new Error("Lawyer not found");

  const booking: ConsultationBooking = {
    id: `apt-${crypto.randomUUID()}`,
    lawyer_id: lawyer.id,
    lawyer_name: lawyer.full_name,
    date: input.date,
    time_slot: input.time_slot,
    matter_summary: input.matter_summary.trim(),
    status: "requested",
    created_at: new Date().toISOString(),
  };

  const all = readAppointments();
  all.unshift(booking);
  writeAppointments(all);
  return booking;
}
