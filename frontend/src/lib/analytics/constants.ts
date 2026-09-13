export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? "";
export const GA_ENABLED = process.env.NEXT_PUBLIC_GA_ENABLED === "true";

export const UTM_STORAGE_KEY = "legalos.utm";

export const UTM_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;
