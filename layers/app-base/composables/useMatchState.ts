// useMatchState — wraps useEvents + engine reducer, returns ready-to-render state.
// Used by overlay/scoreboard themes and the control surface.
//
// Format (preset + gamesToWin) is read via useFormat, which hits the matches
// row in Supabase — same source on every device.

import { getPreset } from '@sb/engine';
import { type Ref, computed } from 'vue';

export function useMatchState(
  matchId: Ref<string>,
  opts: {
    /**
     * Whether this match is doubles. Forwarded to `useFormat`, which folds it
     * into the config the reducer sees.
     *
     * Every surface showing the same match MUST pass the same value: side-out
     * pickleball scores differently in singles and doubles, so an overlay
     * reducing with `doubles: false` against a control reducing with `true`
     * would put two different scores on screen for one event log.
     */
    isDoubles?: Ref<boolean | undefined>;
  } = {}
) {
  const { events, append, replace, loaded } = useEvents(matchId);
  const { preset, config } = useFormat(matchId, opts);

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
    presetEntry.value.reducer(events.value, config.value)
  );

  // `loaded` is passed through from useEvents — true once the event log for
  // this matchId has been reconciled. The dynamic-URL overlay gates its
  // crossfade on it so a swapped-in match never paints at 0–0 first.
  return {
    events,
    append,
    replace,
    config,
    state,
    preset: presetEntry,
    loaded,
  };
}
