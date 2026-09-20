export const BRAND_ASSET_VERSION = "2026-09-20j";

export const brandAssets = {
  mark: {
    light: "/brand/mark-light.webp",
    dark: "/brand/mark-dark.webp",
  },
  favicon: {
    light: "/brand/favicon-light-32.png",
    dark: "/brand/favicon-dark-32.png",
    light16: "/brand/favicon-light-16.png",
    dark16: "/brand/favicon-dark-16.png",
    light48: "/brand/favicon-light-48.png",
    dark48: "/brand/favicon-dark-48.png",
    lightSvg: "/brand/favicon-light.svg",
    darkSvg: "/brand/favicon-dark.svg",
  },
  pwa: {
    icon192: "/brand/app-icon-192.png",
    icon512: "/brand/app-icon-512.png",
    maskable512: "/brand/app-icon-maskable-512.png",
  },
  og: "/brand/og-default.png",
} as const;

export const brandThemeColors = {
  light: "#fbfaf8",
  dark: "#161311",
} as const;

export function brandUrl(path: string): string {
  return `${path}?v=${BRAND_ASSET_VERSION}`;
}
