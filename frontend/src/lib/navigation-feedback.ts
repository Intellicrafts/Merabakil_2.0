export const NAV_START_EVENT = "mb:nav-start";

export function markNavigationStart(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(NAV_START_EVENT));
}
