/**
 * The advocate listing form — state, rules and mapping, with no React.
 *
 * The required details mirror the server (lawyer-marketplace
 * app/application/listing_rules.py): a listing with a consultation fee must
 * have name, enrolment number, pincode, city, state, experience, at least one
 * practice area and one court. Bio and languages are optional.
 *
 * The office pincode comes first: its state decides which Bar Council checks
 * the enrolment number.
 */
import type { LawyerListingInput } from "@/lib/api";
import type { RankedMarketplaceLawyer } from "@/lib/appointment-types";

export type ListingStep = "identity" | "practice" | "fee";

export const SETUP_STEPS: { id: ListingStep; label: string; title: string; intro: string }[] = [
  {
    id: "identity",
    label: "Verify",
    title: "Verify your enrolment",
    intro: "Office pincode chooses the Bar Council we check. Clients only see confirmed advocates.",
  },
  {
    id: "practice",
    label: "Practice",
    title: "Your practice",
    intro: "Courts and matters you take — this is how clients find you.",
  },
  {
    id: "fee",
    label: "Fee & about",
    title: "Fee and about you",
    intro: "Your consultation fee, then a few lines about your practice.",
  },
];

export interface ListingForm {
  fullName: string;
  enrolment: string;
  pincode: string;
  city: string;
  state: string;
  years: string;
  practiceAreas: string[];
  courts: string[];
  languages: string;
  fee: string;
  bio: string;
}

export type ListingField = keyof ListingForm;
export type FieldErrors = Partial<Record<ListingField, string>>;

export const STEP_FIELDS: Record<ListingStep, ListingField[]> = {
  identity: ["pincode", "city", "state", "fullName", "enrolment"],
  practice: ["courts", "practiceAreas", "years", "languages"],
  fee: ["fee", "bio"],
};

/** API field names (422 `fields`, `missing_required`) → form fields. */
export const SERVER_FIELD: Record<string, ListingField> = {
  full_name: "fullName",
  bar_council_id: "enrolment",
  pincode: "pincode",
  city: "city",
  location_state: "state",
  years_experience: "years",
  practice_areas: "practiceAreas",
  jurisdictions: "courts",
  languages: "languages",
  hourly_rate: "fee",
  bio: "bio",
};

export const PINCODE_RE = /^[1-9][0-9]{5}$/;
export const BIO_MIN_FOR_MATCHING = 50;
export const BIO_MAX = 3000;
const IDENTITY_KEYS = ["full_name", "bar_council_id", "pincode", "city", "location_state"];
const PRACTICE_KEYS = ["years_experience", "practice_areas", "jurisdictions"];

const MESSAGES: Partial<Record<ListingField, string>> = {
  fullName: "Enter the name clients should see.",
  enrolment: "Enter your Bar Council enrolment number.",
  pincode: "Enter a valid 6-digit pincode.",
  city: "Enter your city.",
  state: "Choose your state.",
  years: "Enter your years of experience (0 to 70).",
  practiceAreas: "Choose at least one practice area.",
  courts: "Choose at least one court.",
  fee: "Enter your consultation fee in whole rupees.",
};

export function fromListing(row: RankedMarketplaceLawyer | null | undefined, fallbackName: string): ListingForm {
  const name = (row?.full_name ?? "").trim();
  const experienceKnown = Boolean(row && (row.practising_since != null || (row.years_experience ?? 0) > 0));
  return {
    fullName: name && name.toLowerCase() !== "advocate" ? name : fallbackName,
    enrolment: row?.bar_council_id ?? "",
    pincode: row?.pincode ?? "",
    city: row?.city ?? "",
    state: row?.location_state ?? "",
    years: experienceKnown ? String(row?.years_experience ?? 0) : "",
    practiceAreas: row?.practice_areas ?? [],
    courts: row?.jurisdictions ?? [],
    languages: (row?.languages ?? []).join(", ") || "English, Hindi",
    fee: row?.hourly_rate ? String(Math.round(Number(row.hourly_rate))) : "",
    bio: row?.bio ?? "",
  };
}

export function validate(form: ListingForm, step: ListingStep | "all"): FieldErrors {
  const fields = step === "all" ? Object.values(STEP_FIELDS).flat() : STEP_FIELDS[step];
  const errors: FieldErrors = {};
  const check = (field: ListingField, ok: boolean) => {
    if (fields.includes(field) && !ok) errors[field] = MESSAGES[field];
  };
  const name = form.fullName.trim();
  check("fullName", name.length > 0 && name.toLowerCase() !== "advocate" && name.length <= 255);
  check("enrolment", form.enrolment.trim().length > 0);
  check("pincode", PINCODE_RE.test(form.pincode));
  check("city", form.city.trim().length > 0);
  check("state", form.state.trim().length > 0);
  check("years", /^\d{1,2}$/.test(form.years.trim()) && Number(form.years) <= 70);
  check("practiceAreas", form.practiceAreas.length > 0);
  check("courts", form.courts.length > 0);
  check("fee", /^\d{1,7}$/.test(form.fee.trim()) && Number(form.fee) > 0);
  if (fields.includes("bio") && form.bio.length > BIO_MAX) errors.bio = "Keep it under 3,000 characters.";
  return errors;
}

/** The request body for one step, or for the whole listing. */
export function toPayload(form: ListingForm, step: ListingStep | "all"): LawyerListingInput {
  const has = (s: ListingStep) => step === "all" || step === s;
  const payload: LawyerListingInput = {};
  if (has("identity")) {
    payload.pincode = form.pincode;
    payload.city = form.city.trim();
    payload.location_state = form.state.trim();
    payload.full_name = form.fullName.trim();
    payload.bar_council_id = form.enrolment.trim();
  }
  if (has("practice")) {
    payload.years_experience = Number(form.years);
    payload.practice_areas = form.practiceAreas;
    payload.jurisdictions = form.courts;
    payload.languages = form.languages.split(",").map((l) => l.trim()).filter(Boolean);
  }
  if (has("fee")) {
    payload.hourly_rate = Number(form.fee);
    payload.bio = form.bio.trim();
  }
  return payload;
}

/** Year of enrolment from the number's last part: P/1417/2012, UP1234/25, R/176A/1978. */
export function enrolmentYear(enrolment: string, now = new Date()): number | null {
  const match = enrolment.trim().match(/[/\-\s](\d{4}|\d{2})\s*$/);
  if (!match) return null;
  const current = now.getFullYear();
  let year = Number(match[1]);
  if (match[1].length === 2) year += year <= current % 100 ? 2000 : 1900;
  return year >= 1940 && year <= current ? year : null;
}

export function yearsSinceEnrolment(enrolment: string, now = new Date()): number | null {
  const year = enrolmentYear(enrolment, now);
  return year == null ? null : now.getFullYear() - year;
}

/** "₹1,50,000" — Indian digit grouping. */
export function formatInr(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}

/** "NAVEEN SHEOKHAND" → "Naveen Sheokhand" (Bar Council records are in capitals). */
export function titleCaseName(name: string): string {
  return name.toLowerCase().replace(/(^|[\s.'-])([a-z])/g, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}

export function fieldsChanged(a: ListingForm, b: ListingForm): number {
  return (Object.keys(a) as ListingField[]).filter((k) => JSON.stringify(a[k]) !== JSON.stringify(b[k])).length;
}

export type VerificationView = {
  state: "verified" | "review" | "failed" | "none";
  reason: string | null;
  recordName: string | null;
  message: string | null;
  /** The Bar Council that was asked (null for older checks, or one we can't check automatically). */
  council: string | null;
};

export const NO_VERIFICATION: VerificationView = {
  state: "none",
  reason: null,
  recordName: null,
  message: null,
  council: null,
};

export function verificationOf(row: RankedMarketplaceLawyer | null | undefined): VerificationView {
  const data = (row?.verification_data ?? {}) as Record<string, unknown>;
  const outcome = typeof data.outcome === "string" ? data.outcome : null;
  const record = (data.data ?? {}) as Record<string, unknown>;
  const recordName =
    (typeof data.record_name === "string" && data.record_name) ||
    (typeof record.name === "string" && record.name) ||
    null;
  const reason = typeof data.review_reason === "string" ? data.review_reason : null;
  const message = typeof data.message === "string" ? data.message : null;
  const council = typeof data.council === "string" ? data.council : null;
  if (row?.is_verified || row?.verified) return { state: "verified", reason, recordName, message, council };
  if (outcome === "needs_review") return { state: "review", reason, recordName, message, council };
  if (outcome && outcome !== "verified") return { state: "failed", reason, recordName, message, council };
  return { ...NO_VERIFICATION, recordName };
}

/**
 * The enrolment number differs from the verified one on file, so it must be
 * checked again. Mirrors the server (marketplace_api._recheck_after_profile_edit):
 * the office address no longer affects verification.
 */
export function enrolmentChanged(row: RankedMarketplaceLawyer | null | undefined, enrolment: string): boolean {
  if (!row) return false;
  return enrolment.trim() !== (row.bar_council_id ?? "").trim();
}

const REQUIRED_LABELS: Record<string, string> = {
  full_name: "name",
  bar_council_id: "enrolment number",
  pincode: "pincode",
  city: "city",
  location_state: "state",
  years_experience: "years of experience",
  practice_areas: "practice areas",
  jurisdictions: "courts",
  hourly_rate: "consultation fee",
};

/** `missing_required` in words: "pincode, city and years of experience". */
export function describeRequired(keys: string[] | undefined): string {
  const labels = [...new Set((keys ?? []).map((k) => REQUIRED_LABELS[k] ?? k.replace(/_/g, " ")))];
  if (labels.length <= 1) return labels.join("");
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

export type ListingState =
  /** Live and nothing required is missing. */
  | "live"
  /** Live (listed before the rules) but required details are missing. */
  | "live_incomplete"
  /** Complete, waiting for our team to confirm the enrolment. */
  | "under_review"
  /** The enrolment couldn't be confirmed. */
  | "not_verified"
  /** Setup not finished. */
  | "incomplete";

export function listingState(row: RankedMarketplaceLawyer | null | undefined): ListingState {
  if (!row) return "incomplete";
  const missing = row.missing_required ?? [];
  if (row.listed) return missing.length ? "live_incomplete" : "live";
  if (missing.length) return "incomplete";
  return verificationOf(row).state === "review" ? "under_review" : "not_verified";
}

/** Dashboard / tour prompt: complete remaining details, or wait on enrolment review. */
export type ActivationPromptKind = "complete" | "review" | null;

export function activationPromptKind(
  row: RankedMarketplaceLawyer | null | undefined,
): ActivationPromptKind {
  const state = listingState(row);
  if (state === "live") return null;
  if (state === "under_review") return "review";
  return "complete";
}

export function needsProfessionalActivation(
  row: RankedMarketplaceLawyer | null | undefined,
): boolean {
  return activationPromptKind(row) !== null;
}

export function remainingRequiredCount(
  row: RankedMarketplaceLawyer | null | undefined,
): number {
  if (!row) return 9;
  return row.missing_required?.length ?? 0;
}

/** The setup step to resume at, worked out from the saved listing. */
export function firstIncompleteStep(row: RankedMarketplaceLawyer | null | undefined): ListingStep | null {
  const missing = new Set(row?.missing_required ?? []);
  const verification = verificationOf(row).state;
  if (IDENTITY_KEYS.some((k) => missing.has(k)) || verification === "none" || verification === "failed")
    return "identity";
  if (PRACTICE_KEYS.some((k) => missing.has(k))) return "practice";
  if (missing.has("hourly_rate")) return "fee";
  return null;
}

/** New advocates get the guided setup; live listings and admins get the edit page. */
export function usesSetup(row: RankedMarketplaceLawyer | null | undefined, adminMode: boolean): boolean {
  if (adminMode) return false;
  if (!row) return true;
  return !row.listed && (row.missing_required?.length ?? 1) > 0;
}

/** Props shared by the three form sections. */
export interface SectionProps {
  form: ListingForm;
  errors: FieldErrors;
  onChange: <K extends ListingField>(field: K, value: ListingForm[K]) => void;
  disabled?: boolean;
}
