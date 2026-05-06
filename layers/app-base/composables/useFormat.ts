import { computed, type Ref } from "vue";
import { useStorage } from "@vueuse/core";
import {
  type RacquetConfig,
  type SportPresetId,
  getPreset,
  sportPresets,
} from "@sb/engine";

// Per-match format selection — preset (which points-per-game ruleset) + how
// many games make a match. Backed by useStorage so changes auto-sync across
// same-domain tabs (operator changes format on phone → laptop overlay sees it).
//
// Defaults are plain values — useStorage writes back on init to apply
// mergeDefaults, which errors on readonly computeds. /new pre-writes both
// keys at match creation; the literal fallbacks only fire if the user lands
// on /control without having gone through /new.
export function useFormat(matchId: Ref<string>) {
  const preset = useStorage<SportPresetId>(
    computed(() => `sb:format:preset:${matchId.value}`),
    "badminton-21",
  );
  const gamesToWin = useStorage<number>(
    computed(() => `sb:format:gamesToWin:${matchId.value}`),
    1,
  );

  const config = computed<RacquetConfig>(() => ({
    ...getPreset(preset.value).config,
    gamesToWin: gamesToWin.value,
  }));

  const sport = computed(() => getPreset(preset.value).sport);
  const sportPresetOptions = computed(() =>
    Object.values(sportPresets).filter((p) => p.sport === sport.value),
  );

  const seriesLabel = computed(() =>
    gamesToWin.value === 1 ? "Single" : `BO${gamesToWin.value * 2 - 1}`,
  );

  // Compact preset chip ("BWF 21", "15 (2027)", "T 6", "PB 11", "TT 11") for
  // the format strip. Falls back to "P{N}" for unknown ids.
  const presetLabel = computed(() => {
    switch (preset.value) {
      case "badminton-21":
        return "BWF 21";
      case "badminton-15":
        return "15 (2027)";
      case "tennis-basic":
        return "Tennis · 6";
      case "pickleball-classic":
        return "PB 11";
      case "pickleball-rally":
        return "PB 21";
      case "table-tennis":
        return "TT 11";
      default:
        return `P${config.value.pointsPerGame}`;
    }
  });

  return {
    preset,
    gamesToWin,
    config,
    sport,
    sportPresetOptions,
    seriesLabel,
    presetLabel,
  };
}
