import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Mera Bakil",
    short_name: "MeraBakil",
    description: "Legal Help. Made Simple.",
    start_url: "/mera-vakil",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#2f3338",
    theme_color: "#2f3338",
    icons: [
      {
        src: "/brand/app-icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/brand/app-icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/brand/app-icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
