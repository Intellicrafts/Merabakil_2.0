import type { Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { brandThemeColors } from "@/lib/brand-assets";
import { getOrganizationSchema } from "@/lib/schema-markup";
import { BRAND_ASSET_VERSION, rootMetadata } from "@/lib/site-metadata";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const THEME_BOOT = `(function(){try{var s=localStorage.getItem("legalos.theme");var dark=s==="dark"||(s!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",dark);var v="${BRAND_ASSET_VERSION}";function setIcon(id,sizes,href){var l=document.getElementById(id)||document.createElement("link");l.id=id;l.rel="icon";l.type="image/png";l.sizes=sizes;l.href=href;if(!l.parentNode)document.head.appendChild(l);}var base=dark?"/brand/favicon-dark-":"/brand/favicon-light-";setIcon("mb-favicon-32","32x32",base+"32.png?v="+v);setIcon("mb-favicon-16","16x16",base+"16.png?v="+v);setIcon("mb-favicon-48","48x48",base+"48.png?v="+v);}catch(e){}})();`;

export const metadata = rootMetadata;

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: brandThemeColors.light },
    { media: "(prefers-color-scheme: dark)", color: brandThemeColors.dark },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(getOrganizationSchema()),
          }}
        />
      </head>
      <body>
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-lg focus:bg-background focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:shadow-lg focus:ring-2 focus:ring-primary"
        >
          Skip to main content
        </a>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
