export const GA_MEASUREMENT_ID = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? "";
export const GA_ENABLED = process.env.NEXT_PUBLIC_GA_ENABLED === "true";

/**
 * Google Ads conversion/linker ID (AW-XXXXXXXXX). When set, it's added as a
 * second destination on the same gtag so the Ads conversion linker writes the
 * _gcl_aw click cookie. Empty = Ads tag disabled (GA4 still works).
 */
export const GOOGLE_ADS_ID = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID ?? "";

export const UTM_STORAGE_KEY = "legalos.utm";

export const UTM_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
] as const;
