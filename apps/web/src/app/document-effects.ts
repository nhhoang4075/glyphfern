import type { Lang } from "@glyphfern/core";
import type { Preferences } from "./api";
import { DEFAULT_SIZE } from "./defaults";

export const NIGHT_PAPER = "#1B2420";

export function applyPreferencesToDocument(root: HTMLElement, preferences: Preferences) {
  if (preferences.paper === NIGHT_PAPER) {
    root.setAttribute("data-night", "");
  } else {
    root.removeAttribute("data-night");
  }
  root.classList.toggle("calm", preferences.turn === "still");
  root.setAttribute("data-font", preferences.font);
  root.style.setProperty("--fs", `${preferences.size}px`);
  root.style.setProperty("--lh", String(preferences.lh));
}

export function applyLanguageToDocument(root: HTMLElement, lang: Lang) {
  root.setAttribute("data-lang", lang);
}
