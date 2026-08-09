export type ElitedomTheme = "dark" | "light";

const THEME_STORAGE_KEY = "elitedom-theme";

export function readTheme(): ElitedomTheme {
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return stored === "light" ? "light" : "dark";
}

export function applyTheme(theme: ElitedomTheme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
}

export function setTheme(theme: ElitedomTheme) {
  window.localStorage.setItem(THEME_STORAGE_KEY, theme);
  applyTheme(theme);
}
