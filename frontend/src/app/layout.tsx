import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const THEME_BOOT = `(function(){try{var s=localStorage.getItem("legalos.theme");var dark=s==="dark"||(s!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",dark);var l=document.getElementById("mb-favicon-32")||document.createElement("link");l.id="mb-favicon-32";l.rel="icon";l.type="image/png";l.sizes="32x32";l.href="/brand/favicon-"+(dark?"dark":"light")+"-32.png?v=circ3";if(!l.parentNode)document.head.appendChild(l);}catch(e){}})();`;

export const metadata: Metadata = {
  title: "MeraBakil — Legal guidance for every Indian",
  description: "MeraBakil: India's legal AI platform — cited answers, verified lawyers, and case management grounded in Indian law.",
  applicationName: "MeraBakil",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "MeraBakil",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/brand/favicon-light-32.png?v=circ3", sizes: "32x32", type: "image/png", media: "(prefers-color-scheme: light)" },
      { url: "/brand/favicon-dark-32.png?v=circ3", sizes: "32x32", type: "image/png", media: "(prefers-color-scheme: dark)" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: "#2f3338",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning className={`${geistSans.variable} ${geistMono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
