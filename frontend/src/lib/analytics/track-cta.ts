import { AnalyticsEvents, track } from "@/lib/analytics";

export function trackMarketingCta(
  ctaLocation: string,
  ctaType: string,
  destination: string,
): void {
  track(AnalyticsEvents.MARKETING_CTA_CLICKED, {
    cta_location: ctaLocation,
    cta_type: ctaType,
    destination,
  });
}
