import type { MetadataRoute } from "next";

import { brandAssets, brandThemeColors } from "@/lib/brand-assets";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Mera Bakil",
    short_name: "MeraBakil",
    description: "Legal Help. Made Simple.",
    start_url: "/mera-vakil",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: brandThemeColors.dark,
    theme_color: brandThemeColors.dark,
    icons: [
      {
        src: brandAssets.pwa.icon192,
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: brandAssets.pwa.icon512,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: brandAssets.pwa.maskable512,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
