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

import { type RacquetEvent, getPreset } from '@sb/engine';
import { type Ref, computed, onMounted, ref } from 'vue';
import { readTombstones } from '../lib/eventStore';

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
  replayTimeMs: Ref<number>
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
      .from('matches')
      .select('started_at')
      .eq('id', matchId.value)
      .maybeSingle();
    matchStartedAt.value = matchRow?.started_at
      ? Date.parse(matchRow.started_at)
      : null;

    // Undo is a hard delete: useEvents drops the event locally, records the id
    // in `sb:tombstones:{matchId}`, and fires a best-effort remote delete that
    // it retries until a fetch confirms it. If that delete never landed — the
    // scorer went offline, or closed the tab before the retry tick — the row
    // survives, and replaying it here would burn a point the operator had
    // already undone into the video, one ahead for the rest of the recording
    // (and with the serve flipped, since rally scoring follows the winner).
    //
    // Only covers a render on the device that did the undo; the tombstones are
    // device-local. Re-opening /control for the match on that device is what
    // actually repairs the row — reconcile re-issues the delete for anything
    // still present remotely but tombstoned locally.
    const [tombstoned, { data: rows, error }] = await Promise.all([
      // Degrade to no filtering if IndexedDB is unreachable (Safari Lockdown
      // Mode, storage blocked for the origin, a corrupt store). Letting this
      // reject would take the whole load down with it — `load` runs as a
      // floating promise from onMounted, so `loaded` would stay false and the
      // page would sit on the upload step with sync permanently disabled.
      readTombstones(matchId.value).catch((err) => {
        console.warn('[useReplayState] tombstone read failed', err);
        return [] as string[];
      }),
      supabase
        .from('events')
        .select('id, ts, type, payload')
        .eq('match_id', matchId.value)
        .order('ts', { ascending: true }),
    ]);
    if (error) {
      console.warn('[useReplayState] fetch failed', error);
      return;
    }
    const deleted = new Set(tombstoned);
    events.value = (rows ?? [])
      .filter((r) => !deleted.has((r as EventRow).id))
      .map((r) => fromRow(r as EventRow))
      // Sort by id, not by the `ts` the query ordered on — ids are ULIDs, so
      // they're monotonic and break same-millisecond ties deterministically,
      // and it's the order `useEvents` replays live. Ordering by `ts` alone
      // left Postgres free to return tied events either way, which for rally
      // scoring means a different serve chain in the render than on court.
      .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
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
    presetEntry.value.reducer(visibleEvents.value, config.value)
  );

  return {
    state,
    config,
    preset,
    events,
    loaded,
    matchStartedAt,
    reload: load,
  };
}
