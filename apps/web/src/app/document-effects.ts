import type { Lang } from "@glyphfern/core";
import type { Preferences } from "./api";

export interface LayoutPreferences {
  size: number;
  lh: Preferences["lh"];
  font: Preferences["font"];
}

export const NIGHT_PAPER = "#1B2420";

export function applyPreferencesToDocument(root: HTMLElement, preferences: Preferences) {
  if (preferences.paper === NIGHT_PAPER) {
    root.setAttribute("data-night", "");
  } else {
    root.removeAttribute("data-night");
  }
  root.classList.toggle("calm", preferences.turn === "still");
}

export function layoutPreferencesOf(preferences: Preferences): LayoutPreferences {
  return { size: preferences.size, lh: preferences.lh, font: preferences.font };
}

export function layoutKeyOf(layout: LayoutPreferences): string {
  return `${layout.size}|${layout.lh}|${layout.font}`;
}

export function applyLayoutToDocument(root: HTMLElement, layout: LayoutPreferences) {
  root.setAttribute("data-font", layout.font);
  root.style.setProperty("--fs", `${layout.size}px`);
  root.style.setProperty("--lh", String(layout.lh));
}

export function applyLanguageToDocument(root: HTMLElement, lang: Lang) {
  root.setAttribute("data-lang", lang);
}
