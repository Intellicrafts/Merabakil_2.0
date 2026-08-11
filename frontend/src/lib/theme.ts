export const THEME_KEY = "legalos.theme";

export function loadTheme(): "light" | "dark" {
  if (typeof window === "undefined") return "light";
  return localStorage.getItem(THEME_KEY) === "dark" ? "dark" : "light";
}

export function applyTheme(dark: boolean): void {
  if (typeof document === "undefined") return;
  document.documentElement.classList.toggle("dark", dark);
  localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
}

export function toggleTheme(): boolean {
  const next = !document.documentElement.classList.contains("dark");
  applyTheme(next);
  return next;
}

export function initTheme(): boolean {
  const dark = loadTheme() === "dark";
  applyTheme(dark);
  return dark;
}
