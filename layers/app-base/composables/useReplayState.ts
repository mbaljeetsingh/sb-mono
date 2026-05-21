// useReplayState — read-only, time-driven engine state for video post-sync.
//
// Unlike useMatchState (live, subscribes to Realtime + BroadcastChannel),
// this loads the event log once and exposes a reactive `state` computed
// from a caller-provided `replayTimeMs` (absolute, ms since epoch).
// Reducer filters events whose `ts <= replayTimeMs` and runs them through
// the engine; bumping the time forward re-derives state.
//
// No writes. No subscriptions. Safe to use on read-only surfaces like the
// post-game render page where the operator scrubs an uploaded video.

import { ref, computed, onMounted, type Ref } from "vue";
import { getPreset, type RacquetEvent } from "@sb/engine";

type EventRow = {
  id: string;
  ts: string;
  type: string;
  payload: Record<string, unknown> | null;
};

const fromRow = (row: EventRow): RacquetEvent =>
  ({
    id: row.id,
    ts: Date.parse(row.ts),
    type: row.type,
    ...(row.payload ?? {}),
  }) as RacquetEvent;

export function useReplayState(
  matchId: Ref<string>,
  replayTimeMs: Ref<number>,
) {
  const supabase = useSupabaseClient();
  const { preset, config } = useFormat(matchId);
  const presetEntry = computed(() => getPreset(preset.value));

  const events = ref<RacquetEvent[]>([]);
  const loaded = ref(false);
  const matchStartedAt = ref<number | null>(null);

  const load = async () => {
    if (!matchId.value) return;
    // Match row → started_at anchor. Used by the caller to compute video
    // offsets; the consuming page wires "Mark match start here" against it.
    const { data: matchRow } = await supabase
      .from("matches")
      .select("started_at")
      .eq("id", matchId.value)
      .maybeSingle();
    matchStartedAt.value = matchRow?.started_at
      ? Date.parse(matchRow.started_at)
      : null;

    const { data: rows, error } = await supabase
      .from("events")
      .select("id, ts, type, payload")
      .eq("match_id", matchId.value)
      .order("ts", { ascending: true });
    if (error) {
      console.warn("[useReplayState] fetch failed", error);
      return;
    }
    events.value = (rows ?? []).map((r) => fromRow(r as EventRow));
    loaded.value = true;
  };

  onMounted(load);

  // Events visible at the current replay time. `match.start` is always
  // included (the reducer needs an anchor) so the theme doesn't render a
  // garbage initial frame before replayTime reaches the first point.
  const visibleEvents = computed(() => {
    const t = replayTimeMs.value;
    return events.value.filter((e, i) => i === 0 || e.ts <= t);
  });

  const state = computed(() =>
    presetEntry.value.reducer(visibleEvents.value, config.value),
  );

  return {
    state,
    config,
    events,
    loaded,
    matchStartedAt,
    reload: load,
  };
}
