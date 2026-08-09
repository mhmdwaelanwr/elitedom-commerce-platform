export type ElitedomTheme = "dark" | "light";

const THEME_STORAGE_KEY = "elitedom-theme";
export const THEME_CHANGED_EVENT = "elitedom:theme-changed";

export function readTheme(): ElitedomTheme {
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  if (stored === "light" || stored === "dark") return stored;
  return window.matchMedia?.("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

export function applyTheme(theme: ElitedomTheme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export function setTheme(theme: ElitedomTheme) {
  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  applyTheme(theme);
  window.dispatchEvent(new CustomEvent<ElitedomTheme>(THEME_CHANGED_EVENT, { detail: theme }));
}
