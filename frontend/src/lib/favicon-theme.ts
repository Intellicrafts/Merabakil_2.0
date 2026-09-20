import { brandAssets, brandUrl } from "@/lib/brand-assets";

function isDark(): boolean {
  return document.documentElement.classList.contains("dark");
}

function upsertIcon(id: string, href: string, sizes = "32x32") {
  let link = document.getElementById(id) as HTMLLinkElement | null;
  if (!link) {
    link = document.createElement("link");
    link.id = id;
    link.rel = "icon";
    document.head.appendChild(link);
  }
  link.type = "image/png";
  link.sizes = sizes;
  link.href = href;
}

export function applyThemedFavicon() {
  if (typeof document === "undefined") return;
  const tone = isDark() ? "dark" : "light";
  const path = tone === "dark" ? brandAssets.favicon.dark : brandAssets.favicon.light;
  upsertIcon("mb-favicon-32", brandUrl(path), "32x32");
  upsertIcon(
    "mb-favicon-16",
    brandUrl(tone === "dark" ? brandAssets.favicon.dark16 : brandAssets.favicon.light16),
    "16x16",
  );
  upsertIcon(
    "mb-favicon-48",
    brandUrl(tone === "dark" ? brandAssets.favicon.dark48 : brandAssets.favicon.light48),
    "48x48",
  );
}
