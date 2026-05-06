// useMatchState — wraps useEvents + engine reducer, returns ready-to-render state.
// Used by overlay/scoreboard themes and the control surface.
//
// Sport selection: read `sportPreset` from localStorage `sb:meta:{matchId}`
// (written by /new) and look up the corresponding config + reducer in the
// engine registry. Operator can override mid-match via `sb:format:{matchId}`.
// v1.x reads from Supabase once the matches table is wired.
//
// All localStorage I/O goes through VueUse `useStorage` so refs auto-sync to
// disk and across same-domain tabs.

import { computed, onMounted, type Ref } from "vue";
import { useStorage } from "@vueuse/core";
import { type RacquetEvent, getPreset, sportPresets } from "@sb/engine";

type FormatRecord = { preset?: string; gamesToWin?: number };

export function useMatchState(matchId: Ref<string>) {
  const { events, append, replace } = useEvents(matchId);
  const { meta } = useMatchMeta(matchId);

  // Per-match format overrides (written by control surface format sheet).
  // Empty by default; preset/gamesToWin fall through to meta + preset defaults.
  const formatKey = computed(() => `sb:format:${matchId.value}`);
  const format = useStorage<FormatRecord>(formatKey, {} as FormatRecord);

  // Resolution order for the active preset:
  //   1. format override (`sb:format.preset`) — operator's mid-match choice.
  //   2. match metadata (`sb:meta.sportPreset`) — what /new wrote at creation.
  //   3. badminton-21 fallback.
  const presetId = computed<string>(() => {
    const fromFormat = format.value.preset;
    if (typeof fromFormat === "string" && fromFormat in sportPresets)
      return fromFormat;
    const fromMeta = meta.value.sportPreset;
    if (typeof fromMeta === "string" && fromMeta in sportPresets)
      return fromMeta;
    return "badminton-21";
  });
  const preset = computed(() => getPreset(presetId.value));

  // Match length override — falls back to the preset's natural gamesToWin
  // (table tennis = 3, badminton = 2, etc.) if not explicitly set.
  const config = computed(() => {
    const base = preset.value.config;
    const override = format.value.gamesToWin;
    if (typeof override === "number" && override >= 1) {
      return { ...base, gamesToWin: override };
    }
    return base;
  });

  onMounted(() => {
    // Auto-bootstrap: if no events yet, emit a match.start so the overlay/
    // scoreboard surfaces have meaningful state to render.
    if (events.value.length === 0) {
      append({
        type: "match.start",
        serverSide: "A",
        serverCourt: "right",
      } as Omit<RacquetEvent, "id" | "ts">);
    }
  });

  const state = computed(() =>
    preset.value.reducer(events.value, config.value),
  );

  return { events, append, replace, config, state, preset };
}
