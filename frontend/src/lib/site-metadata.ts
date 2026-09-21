import type { Metadata } from "next";

import { BRAND_ASSET_VERSION, brandAssets, brandUrl } from "@/lib/brand-assets";

export const SITE = {
  name: "MeraBakil",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://merabakil.in",
  description:
    "India's legal AI platform — cited answers, verified lawyers, and case management grounded in Indian law.",
  ogImage: brandAssets.og,
  locale: "en_IN",
  twitterHandle: "@merabakil",
} as const;

export const LEGAL_VERSIONS = {
  terms: "1.0",
  privacy: "1.0",
} as const;

export const NOINDEX: Metadata["robots"] = { index: false, follow: false };

export function pageMetadata({
  title,
  description,
  path,
  noIndex = false,
}: {
  title: string;
  description: string;
  path: string;
  noIndex?: boolean;
}): Metadata {
  const fullTitle = title === SITE.name ? title : `${title} | ${SITE.name}`;

  return {
    title: fullTitle,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: fullTitle,
      description,
      url: path,
      siteName: SITE.name,
      locale: SITE.locale,
      type: "website",
      images: [{ url: SITE.ogImage, width: 1200, height: 630, alt: SITE.name }],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [SITE.ogImage],
    },
    ...(noIndex ? { robots: NOINDEX } : {}),
  };
}

export const rootMetadata: Metadata = {
  metadataBase: new URL(SITE.url),
  title: {
    default: `${SITE.name} — AI Legal Assistant, India`,
    template: `%s | ${SITE.name}`,
  },
  description: "MeraBakil (Mera Bakil) — India's AI legal platform. Ask Saarthi AI legal questions, find verified advocates, get legal guidance grounded in Indian law. Free consultation.",
  keywords: [
    "MeraBakil",
    "Mera Bakil",
    "Mera Vakil",
    "merabakil",
    "online lawyer India",
    "AI legal assistant India",
    "find advocate India",
    "legal advice India",
    "Saarthi AI",
  ],
  applicationName: SITE.name,
  manifest: "/manifest.webmanifest",
  robots: { index: true, follow: true },
  alternates: { canonical: "/" },
  openGraph: {
    title: `${SITE.name} — AI Legal Assistant & Advocate Marketplace`,
    description: "MeraBakil (Mera Bakil): instant legal guidance from Saarthi AI, verified advocates, and expert help grounded in Indian law.",
    url: "/",
    siteName: SITE.name,
    locale: SITE.locale,
    type: "website",
    images: [{ url: SITE.ogImage, width: 1200, height: 630, alt: "MeraBakil (Mera Bakil) - India's Legal AI Platform" }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE.name} — AI Legal Assistant & Advocate Marketplace`,
    description: "MeraBakil (Mera Bakil): instant legal guidance from Saarthi AI, verified advocates, and expert help grounded in Indian law.",
    images: [SITE.ogImage],
  },
  appleWebApp: {
    capable: true,
    title: SITE.name,
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      {
        url: brandUrl(brandAssets.favicon.light16),
        sizes: "16x16",
        type: "image/png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: brandUrl(brandAssets.favicon.light),
        sizes: "32x32",
        type: "image/png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: brandUrl(brandAssets.favicon.light48),
        sizes: "48x48",
        type: "image/png",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: brandUrl(brandAssets.favicon.dark16),
        sizes: "16x16",
        type: "image/png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: brandUrl(brandAssets.favicon.dark),
        sizes: "32x32",
        type: "image/png",
        media: "(prefers-color-scheme: dark)",
      },
      {
        url: brandUrl(brandAssets.favicon.dark48),
        sizes: "48x48",
        type: "image/png",
        media: "(prefers-color-scheme: dark)",
      },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export { BRAND_ASSET_VERSION };
