import { computed, type Ref } from "vue";
import { useStorage } from "@vueuse/core";
import { themes as themeRegistry } from "@sb/themes";

// Per-match theme pair (overlay + scoreboard). Single owner of the
// `sb:theme:{matchId}` storage key — used by /new, the match hub, and
// ThemePickerDialog. mergeDefaults: true keeps older entries (just
// { overlay }) compatible.
export function useThemeChoice(matchId: Ref<string>) {
  const choice = useStorage(
    computed(() => `sb:theme:${matchId.value}`),
    { overlay: "broadcast-classic", scoreboard: "filmable" },
    undefined,
    { mergeDefaults: true },
  );
  const overlay = computed({
    get: () => choice.value.overlay,
    set: (v) => {
      choice.value = { ...choice.value, overlay: v };
    },
  });
  const scoreboard = computed({
    get: () => choice.value.scoreboard,
    set: (v) => {
      choice.value = { ...choice.value, scoreboard: v };
    },
  });
  const overlayName = computed(
    () => themeRegistry[overlay.value]?.manifest.name ?? "—",
  );
  const scoreboardName = computed(
    () => themeRegistry[scoreboard.value]?.manifest.name ?? "—",
  );
  return { overlay, scoreboard, overlayName, scoreboardName };
}
