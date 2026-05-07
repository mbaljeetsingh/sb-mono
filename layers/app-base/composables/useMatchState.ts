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

import { computed, type Ref } from "vue";
import { useStorage } from "@vueuse/core";
import { type SportPresetId, getPreset, sportPresets } from "@sb/engine";

export function useMatchState(matchId: Ref<string>) {
  const { events, append, replace } = useEvents(matchId);
  const { meta } = useMatchMeta(matchId);

  // Per-match format overrides — split into two storage keys so each side of
  // the control format sheet (preset toggle, BO stepper) can write
  // independently. /new and control.vue use these same keys, so all surfaces
  // stay in sync.
  const presetStorage = useStorage<SportPresetId | null>(
    computed(() => `sb:format:preset:${matchId.value}`),
    null,
  );
  const gamesToWinStorage = useStorage<number | null>(
    computed(() => `sb:format:gamesToWin:${matchId.value}`),
    null,
  );

  // Resolution order for the active preset:
  //   1. explicit format override — operator's mid-match choice.
  //   2. match metadata (`sb:meta.sportPreset`) — what /new wrote at creation.
  //   3. badminton-21 fallback.
  const presetId = computed<string>(() => {
    const fromFormat = presetStorage.value;
    if (typeof fromFormat === "string" && fromFormat in sportPresets)
      return fromFormat;
    const fromMeta = meta.value.sportPreset;
    if (typeof fromMeta === "string" && fromMeta in sportPresets)
      return fromMeta;
    return "badminton-21";
  });
  const preset = computed(() => getPreset(presetId.value));

  // Match length override — falls back to the preset's natural gamesToWin
  // (table tennis = 3, badminton = 2, etc.) only when the user hasn't picked.
  const config = computed(() => {
    const base = preset.value.config;
    const override = gamesToWinStorage.value;
    if (typeof override === "number" && override >= 1) {
      return { ...base, gamesToWin: override };
    }
    return base;
  });

  // No auto-bootstrap here. Earlier this composable would `append` a
  // match.start whenever events.value.length === 0 on mount, but that
  // ran on overlay/scoreboard mounts too — and because useEvents only
  // loads Supabase events asynchronously, the empty check could fire
  // BEFORE the real events arrived. Each empty-check open of overlay or
  // scoreboard then wrote a fresh match.start, and the reducer treats
  // every match.start as a hard reset → prior games wiped. (See
  // /m/{id}/control.vue for the bootstrap on the operator surface; the
  // read-only surfaces should never write events.)

  const state = computed(() =>
    preset.value.reducer(events.value, config.value),
  );

  return { events, append, replace, config, state, preset };
}
