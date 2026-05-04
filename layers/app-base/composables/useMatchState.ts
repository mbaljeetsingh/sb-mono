// useMatchState — wraps useEvents + engine reducer, returns ready-to-render state.
// Used by overlay/scoreboard themes and the control surface.

import { type RacquetEvent, badminton21, reduceBadminton } from "@sb/engine";

export function useMatchState(matchId: Ref<string>) {
  const { events, append, replace } = useEvents(matchId);

  // Auto-bootstrap: if no events yet, emit a match.start so the overlay/
  // scoreboard surfaces have meaningful state to render.
  onMounted(() => {
    if (events.value.length === 0) {
      append({
        type: "match.start",
        serverSide: "A",
        serverCourt: "right",
      } as Omit<RacquetEvent, "id" | "ts">);
    }
  });

  // v1: hardcoded to badminton 21pt. v1.x reads sport_preset from the match
  // record once the matches table is wired through Supabase.
  const config = badminton21;
  const state = computed(() => reduceBadminton(events.value, config));

  return { events, append, replace, config, state };
}
