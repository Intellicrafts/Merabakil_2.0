import { SERVER_FIELD, type FieldErrors, type ListingField } from "./listing-form";

/** DOM ids of each field's control (or chip group) in the listing sections. */
export const FIELD_IDS: Record<ListingField, string> = {
  fullName: "listing-name",
  enrolment: "listing-enrolment",
  pincode: "listing-pincode",
  city: "listing-city",
  state: "listing-state",
  years: "listing-years",
  practiceAreas: "listing-areas",
  courts: "listing-courts",
  languages: "listing-languages",
  fee: "listing-fee",
  bio: "listing-bio",
};

/** Field order on screen — the first error in this order gets focus. */
const ORDER: ListingField[] = [
  "fullName", "enrolment", "pincode", "city", "state", "courts", "practiceAreas", "years", "languages", "fee", "bio",
];

export function firstErrorField(errors: FieldErrors): ListingField | null {
  return ORDER.find((f) => errors[f]) ?? null;
}

/** Move keyboard focus to a field (the first chip for a chip group) and bring it into view. */
export function focusField(field: ListingField): void {
  const el = document.getElementById(FIELD_IDS[field]);
  if (!el) return;
  const target = el.getAttribute("role") === "group" ? el.querySelector<HTMLElement>("button") : el;
  target?.focus({ preventScroll: true });
  el.scrollIntoView({ block: "center", behavior: "smooth" });
}

/** Server field errors (API names) → form field errors. */
export function mapServerFields(fields: Record<string, string>): FieldErrors {
  const errors: FieldErrors = {};
  for (const [key, message] of Object.entries(fields)) {
    const field = SERVER_FIELD[key];
    if (field) errors[field] = message;
  }
  return errors;
}
