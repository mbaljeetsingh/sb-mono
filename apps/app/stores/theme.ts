// Theme store — thin Pinia wrapper around @nuxtjs/color-mode that exposes the
// three-state preference (light / dark / system) plus a transition-suppressing
// setter, so toggling doesn't trigger the full Tailwind color-transition cascade.

import { defineStore } from "pinia";
import { computed } from "vue";

export const useThemeStore = defineStore("theme", () => {
  const THEME_OPTIONS = {
    LIGHT: "light",
    DARK: "dark",
    SYSTEM: "system",
  } as const;

  type ThemeOption = (typeof THEME_OPTIONS)[keyof typeof THEME_OPTIONS];

  const colorMode = useColorMode();

  const theme = computed<ThemeOption>({
    get() {
      return (colorMode.preference as ThemeOption) || THEME_OPTIONS.SYSTEM;
    },
    set(val) {
      colorMode.preference = val;
    },
  });

  const isDarkMode = computed<boolean>(() => colorMode.value === "dark");

  // Wrap toggles in a one-frame transition block so the swap is instant
  // rather than smearing through Tailwind's color transitions.
  const suppressTransitions = () => {
    if (typeof document === "undefined") return;
    const style = document.createElement("style");
    style.appendChild(
      document.createTextNode(
        "*,*::before,*::after{transition:none!important}",
      ),
    );
    document.head.appendChild(style);
    // Force a style recalc so the rule is applied before we drop it.
    getComputedStyle(document.documentElement).getPropertyValue("color");
    requestAnimationFrame(() => {
      document.head.removeChild(style);
    });
  };

  const setTheme = (next: ThemeOption) => {
    if (Object.values(THEME_OPTIONS).includes(next)) {
      suppressTransitions();
      colorMode.preference = next;
    }
  };

  const toggleTheme = () => {
    suppressTransitions();
    if (colorMode.preference === THEME_OPTIONS.DARK) {
      colorMode.preference = THEME_OPTIONS.LIGHT;
    } else if (colorMode.preference === THEME_OPTIONS.LIGHT) {
      colorMode.preference = THEME_OPTIONS.DARK;
    } else {
      colorMode.preference =
        colorMode.value === "dark" ? THEME_OPTIONS.LIGHT : THEME_OPTIONS.DARK;
    }
  };

  return {
    theme,
    isDarkMode,
    THEME_OPTIONS,
    setTheme,
    toggleTheme,
  };
});
