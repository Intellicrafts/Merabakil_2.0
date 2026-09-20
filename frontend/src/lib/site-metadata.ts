import type { Metadata } from "next";

export const SITE = {
  name: "MeraBakil",
  url: process.env.NEXT_PUBLIC_SITE_URL ?? "https://merabakil.in",
  description:
    "India's legal AI platform — cited answers, verified lawyers, and case management grounded in Indian law.",
  ogImage: "/brand/og-default.png",
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
    default: `${SITE.name} — Legal guidance for every Indian`,
    template: `%s | ${SITE.name}`,
  },
  description: SITE.description,
  applicationName: SITE.name,
  manifest: "/manifest.webmanifest",
  robots: { index: true, follow: true },
  alternates: { canonical: "/" },
  openGraph: {
    title: `${SITE.name} — Legal guidance for every Indian`,
    description: SITE.description,
    url: "/",
    siteName: SITE.name,
    locale: SITE.locale,
    type: "website",
    images: [{ url: SITE.ogImage, width: 1200, height: 630, alt: SITE.name }],
  },
  twitter: {
    card: "summary_large_image",
    title: `${SITE.name} — Legal guidance for every Indian`,
    description: SITE.description,
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
        url: "/brand/logo-optimized-normal.svg?v=circ3",
        type: "image/svg+xml",
        media: "(prefers-color-scheme: light)",
      },
      {
        url: "/brand/logo-optimized-dark.svg?v=circ3",
        type: "image/svg+xml",
        media: "(prefers-color-scheme: dark)",
      },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
};
