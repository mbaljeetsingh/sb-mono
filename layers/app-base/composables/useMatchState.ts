// useMatchState — wraps useEvents + engine reducer, returns ready-to-render state.
// Used by overlay/scoreboard themes and the control surface.
//
// Format (preset + gamesToWin) is read via useFormat, which hits the matches
// row in Supabase — same source on every device.

import { computed, type Ref } from "vue";
import { getPreset } from "@sb/engine";

export function useMatchState(matchId: Ref<string>) {
  const { events, append, replace } = useEvents(matchId);
  const { preset, config } = useFormat(matchId);

  const presetEntry = computed(() => getPreset(preset.value));

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
    presetEntry.value.reducer(events.value, config.value),
  );

  return { events, append, replace, config, state, preset: presetEntry };
}
