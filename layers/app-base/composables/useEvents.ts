// useEvents — IDB-first + Supabase event store for a single match.
//
// Strategy (E1.11 — offline-first):
//  1. IndexedDB (via idb-keyval) holds the event log. Durable through tab
//     crashes, larger quota than localStorage, async writes that don't block
//     the UI. Read once on mount.
//  2. Supabase `events` table is the canonical source of truth across devices.
//  3. On mount: read IDB → subscribe Realtime + BroadcastChannel → fetch
//     remote → reconcile by diffing IDs (push local-not-in-remote, merge
//     remote-not-in-local). Same reconciliation runs on `online` events and
//     every 10s while events are pending.
//  4. BroadcastChannel handles same-device cross-tab sync (faster than going
//     via Supabase).
//  5. append() writes to IDB + tries Supabase upsert (idempotent retry-safe);
//     replace() truncates IDB + deletes the diff from Supabase. Deleted ids
//     are tombstoned (persisted in IDB) so no later reconcile, realtime echo,
//     or stale device can resurrect an undone point; the remote delete is
//     retried until a fetch confirms the rows are gone.
//  6. Pending count (`localIds - remoteIds`) is reported to the global
//     `useSyncStatus` store so AppHeader can render the offline pill.
//
// Match row creation lives in /new only. If the matches row is missing,
// event pushes fail with an FK violation rather than backfilling a stub —
// keeps the row's ownership intact for legitimate creators.

import type { RacquetEvent } from '@sb/engine';
import type { Json } from '@sb/shared';
import { useOnline } from '@vueuse/core';
import { ulid } from 'ulid';
import { type Ref, onMounted, onUnmounted, ref, watch } from 'vue';
import {
  markScored,
  readEvents,
  readTombstones,
  writeEvents,
  writeTombstones,
} from '../lib/eventStore';
import { setPending } from './useSyncStatus';

type ParsedEvent = RacquetEvent;

// Supabase events row → in-memory RacquetEvent. The DB stores type + payload
// split; ts is timestamptz (ISO 8601) on the wire, but the engine works in ms.
const fromRow = (row: {
  id: string;
  ts: string;
  type: string;
  payload: Json | null;
}): ParsedEvent => {
  return {
    id: row.id,
    ts: Date.parse(row.ts),
    type: row.type,
    ...((row.payload ?? {}) as Record<string, unknown>),
  } as ParsedEvent;
};

// In-memory RacquetEvent → DB columns. Strip `id` + `ts` + `type` from payload.
const toRow = (
  ev: ParsedEvent,
  matchId: string,
  deviceId: string
): {
  id: string;
  match_id: string;
  device_id: string;
  ts: string;
  type: string;
  payload: Json;
} => {
  const { id, ts, type, ...rest } = ev as ParsedEvent & Record<string, unknown>;
  return {
    id,
    match_id: matchId,
    device_id: deviceId,
    ts: new Date(ts).toISOString(),
    type,
    payload: rest as Json,
  };
};

// Stable per-browser device id used for event provenance + dedupe heuristics.
const deviceIdKey = 'sb:device-id';
const getDeviceId = (): string => {
  if (typeof localStorage === 'undefined') return 'ssr';
  let id = localStorage.getItem(deviceIdKey);
  if (!id) {
    id = ulid();
    localStorage.setItem(deviceIdKey, id);
  }
  return id;
};

// Local-only fat-finger guard for point events. Drops same-side `point` taps
// within the window as accidental double-presses. Cross-device dedup is
// separate: active-scorer handoff ensures one writer at a time, and realtime
// echoes are de-duped by id in `upsertLocal`. Only physical double-taps
// (~150–250 ms) need to be caught here — but the window is compared with an
// absolute diff because the events scanned may have been authored on another
// device whose clock runs ahead of ours (see append()).
const POINT_DEDUP_WINDOW_MS = 250;

// Retry cadence for pushing local-only events when Supabase is offline /
// failing. Cheap on a healthy connection (single SELECT + nothing to push).
const SYNC_RETRY_INTERVAL_MS = 10_000;

// Postgres failures carry a SQLSTATE code (e.g. 23503 FK violation, 42501 RLS
// denial) — retrying those can never succeed, so they must not block the rest
// of the push queue. Network failures surface with no code and are retryable.
const isTerminalError = (error: { code?: string }): boolean =>
  typeof error.code === 'string' && /^[0-9A-Z]{5}$/.test(error.code);

type PushResult = 'ok' | 'retryable' | 'terminal';

type UseEventsOptions = {
  // When set, all writes are routed through the SECURITY DEFINER RPCs
  // (`append_event_with_token`, `delete_events_with_token`) instead of the
  // direct PostgREST endpoints. This is the co-scorer path — the writer
  // doesn't own the match, but has a valid invite token. Owner / anon-match
  // writers should leave this null so they use the normal RLS-gated path.
  writeToken?: Ref<string | null>;
};

export function useEvents(matchId: Ref<string>, opts: UseEventsOptions = {}) {
  const supabase = useSupabaseClient();
  const writeToken = opts.writeToken;
  const online = useOnline();

  const events = ref<RacquetEvent[]>([]);
  // Flips true after init() has finished its first reconcile() — i.e. IDB +
  // Supabase have both contributed everything they know. Consumers that need
  // to make an "is this match fresh?" decision (control.vue auto-emitting a
  // match.start) must wait on this; otherwise a co-scorer opening /control
  // in a fresh browser races the async reconcile and stamps a phantom
  // match.start that resets the score before the real events arrive.
  const loaded = ref(false);
  // Set of event IDs we know are in Supabase. Anything in `events` not in
  // here is part of the pending queue.
  const remoteIds = ref<Set<string>>(new Set());
  // Event ids deleted on this device (undo). Persisted per match; reconcile
  // and the realtime INSERT handler must never re-merge these.
  const tombstones = ref<Set<string>>(new Set());
  // Tombstoned ids whose remote delete hasn't been confirmed by a fetch yet —
  // keeps the retry tick alive until the delete lands.
  const pendingDeletes = new Set<string>();

  let channel: BroadcastChannel | null = null;
  let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;
  let retryTimer: ReturnType<typeof setInterval> | null = null;
  // Bumped on matchId change / unmount. In-flight async loops (init,
  // reconcile) capture the value at start and bail once it moves on, so a
  // stale continuation can never push the old match's events under the new
  // matchId.
  let generation = 0;
  // Per-instance unique channel-name suffix — see explanation below in
  // subscribeRealtime().
  const channelSuffix = Math.random().toString(36).slice(2, 10);

  const sortById = (a: RacquetEvent, b: RacquetEvent) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

  const persist = async () => {
    await writeEvents(matchId.value, events.value);
  };

  const persistTombstones = async () => {
    await writeTombstones(matchId.value, [...tombstones.value]);
  };

  const addTombstones = (ids: string[]) => {
    if (!ids.length) return;
    const next = new Set(tombstones.value);
    for (const id of ids) next.add(id);
    tombstones.value = next;
    void persistTombstones();
  };

  const reportPending = () => {
    let n = 0;
    for (const e of events.value) if (!remoteIds.value.has(e.id)) n++;
    setPending(matchId.value, n);
  };

  const markRemote = (id: string) => {
    if (remoteIds.value.has(id)) return;
    const next = new Set(remoteIds.value);
    next.add(id);
    remoteIds.value = next;
    reportPending();
  };

  const unmarkRemote = (id: string) => {
    if (!remoteIds.value.has(id)) return;
    const next = new Set(remoteIds.value);
    next.delete(id);
    remoteIds.value = next;
    reportPending();
  };

  const fetchRemote = async (): Promise<RacquetEvent[]> => {
    const { data, error } = await supabase
      .from('events')
      .select('id, ts, type, payload')
      .eq('match_id', matchId.value)
      .order('ts', { ascending: true });
    if (error) {
      console.warn('[useEvents] fetch remote failed', error);
      return [];
    }
    return (data ?? []).map(fromRow);
  };

  // Push one event to Supabase. Idempotent: uses upsert with `ignoreDuplicates`
  // (direct path) or the RPC which already does `on conflict (id) do nothing`.
  const pushEvent = async (ev: RacquetEvent): Promise<PushResult> => {
    if (writeToken?.value) {
      const { id, ts, type, ...rest } = ev as ParsedEvent &
        Record<string, unknown>;
      const { error } = await supabase.rpc('append_event_with_token', {
        p_match_id: matchId.value,
        p_token: writeToken.value,
        p_event_id: id,
        p_device_id: getDeviceId(),
        p_ts: new Date(ts).toISOString(),
        p_type: type,
        p_payload: rest as Json,
      });
      if (error) {
        console.warn('[useEvents] rpc append failed', error);
        return isTerminalError(error) ? 'terminal' : 'retryable';
      }
      return 'ok';
    }

    const { error } = await supabase
      .from('events')
      .upsert(toRow(ev, matchId.value, getDeviceId()), {
        onConflict: 'id',
        ignoreDuplicates: true,
      });
    if (error) {
      console.warn('[useEvents] event upsert failed', error);
      return isTerminalError(error) ? 'terminal' : 'retryable';
    }
    return 'ok';
  };

  // Delete events remotely. Failures are tolerated — the ids stay tombstoned
  // and reconcile re-issues the delete until a fetch confirms they're gone.
  const deleteRemote = async (ids: string[]) => {
    if (!ids.length) return;
    if (writeToken?.value) {
      const { error } = await supabase.rpc('delete_events_with_token', {
        p_match_id: matchId.value,
        p_token: writeToken.value,
        p_event_ids: ids,
      });
      if (error) console.warn('[useEvents] rpc delete failed', error);
      return;
    }
    const { error } = await supabase.from('events').delete().in('id', ids);
    if (error) console.warn('[useEvents] event delete failed', error);
  };

  // Reconcile local IDB state with Supabase. Pushes local-only events, merges
  // remote-only events, retries unconfirmed deletes, rebuilds remoteIds. Safe
  // to call repeatedly.
  const reconcile = async () => {
    const gen = generation;
    const remote = await fetchRemote();
    if (gen !== generation) return;
    const remoteIdSet = new Set(remote.map((e) => e.id));
    const localIdSet = new Set(events.value.map((e) => e.id));

    // Deletes confirmed gone drop out of the retry set; anything tombstoned
    // but still present remotely (failed delete, or a stale device pushed it
    // back) gets the delete re-issued.
    for (const id of [...pendingDeletes]) {
      if (!remoteIdSet.has(id)) pendingDeletes.delete(id);
    }
    const undeleted = remote
      .filter((e) => tombstones.value.has(e.id))
      .map((e) => e.id);
    if (undeleted.length) {
      for (const id of undeleted) pendingDeletes.add(id);
      void deleteRemote(undeleted);
    }

    // Pull: merge any remote-only events into local — never tombstoned ones,
    // or an undo would silently resurrect on the next reconcile.
    const remoteOnly = remote.filter(
      (e) => !localIdSet.has(e.id) && !tombstones.value.has(e.id)
    );
    if (remoteOnly.length) {
      events.value = [...events.value, ...remoteOnly].sort(sortById);
      await persist();
      if (gen !== generation) return;
    }

    // Update confirmed-remote set from this fetch before pushing, so the
    // pending count is accurate as pushes complete.
    remoteIds.value = remoteIdSet;
    reportPending();

    // Push: send local-only events to Supabase. Done sequentially so a
    // failure early in the queue doesn't fan out a hundred requests.
    const localOnly = events.value.filter((e) => !remoteIdSet.has(e.id));
    for (const ev of localOnly) {
      if (gen !== generation) return;
      const res = await pushEvent(ev);
      if (res === 'ok') markRemote(ev.id);
      else if (res === 'retryable') break; // network's down; back off until next retry tick.
      // 'terminal' (RLS/FK rejection): skip — this event can never land, and
      // it must not block everything queued behind it.
    }
  };

  // Local-only mutation helpers (used by realtime + broadcast handlers).
  const upsertLocal = (incoming: RacquetEvent) => {
    if (tombstones.value.has(incoming.id)) return; // deleted here; don't resurrect
    if (events.value.some((e) => e.id === incoming.id)) return;
    events.value = [...events.value, incoming].sort(sortById);
    void persist();
  };

  const removeLocal = (id: string) => {
    // Tombstone even when the id isn't present locally — a remote DELETE that
    // races an in-flight reconcile() fetch would otherwise re-merge the event
    // from the stale fetch snapshot and push it back to Supabase.
    addTombstones([id]);
    if (!events.value.some((e) => e.id === id)) return;
    events.value = events.value.filter((e) => e.id !== id);
    unmarkRemote(id);
    void persist();
  };

  // ─── Public API ───────────────────────────────────────────────────────────

  const append = (partial: Omit<RacquetEvent, 'id' | 'ts'>): RacquetEvent => {
    // JSON round-trip strips Vue reactive proxies (which `structuredClone`
    // can't clone) — callers can pass reactive state directly without hitting
    // `DataCloneError` on the BroadcastChannel hop below.
    const ev = JSON.parse(
      JSON.stringify({ id: ulid(), ts: Date.now(), ...partial })
    ) as RacquetEvent;

    // Fat-finger dedup for point events. If the same side already scored
    // within the window, treat as duplicate observation. Absolute diff:
    // events from other devices can carry a ts *ahead* of this clock, and a
    // signed comparison would then treat every future tap as a duplicate.
    if (ev.type === 'point') {
      const side = (ev as RacquetEvent & { side?: string }).side;
      const recent = events.value.find((e) => {
        if (e.type !== 'point') return false;
        if ((e as RacquetEvent & { side?: string }).side !== side) return false;
        return Math.abs(ev.ts - (e.ts ?? 0)) < POINT_DEDUP_WINDOW_MS;
      });
      if (recent) {
        console.warn(
          '[useEvents] dropping duplicate point within',
          POINT_DEDUP_WINDOW_MS,
          'ms',
          {
            kept: recent.id,
            dropped: ev.id,
          }
        );
        return recent;
      }
    }

    events.value = [...events.value, ev].sort(sortById);
    void persist();
    // Flag this match as scored on this device — drives the /matches list
    // and claim-on-login. Realtime / broadcast handlers do NOT call this,
    // so passive viewers (venue TV, scoreboard, overlay) stay out of the list.
    void markScored(matchId.value);
    reportPending();
    channel?.postMessage({ type: 'append', event: ev });

    // Fire-and-forget push. On failure the event stays in the pending queue
    // and the retry tick will catch it.
    (async () => {
      if ((await pushEvent(ev)) === 'ok') markRemote(ev.id);
    })();

    return ev;
  };

  const replace = (next: RacquetEvent[]) => {
    const before = new Set(events.value.map((e) => e.id));
    const after = new Set(next.map((e) => e.id));
    const removed = [...before].filter((id) => !after.has(id));

    // JSON round-trip strips Vue reactive proxies — same defense as append().
    const plain = JSON.parse(JSON.stringify(next)) as RacquetEvent[];
    events.value = [...plain].sort(sortById);
    void persist();
    // Tombstone before broadcasting/deleting so nothing can re-merge the
    // removed ids in the meantime; sibling tabs tombstone via the message.
    addTombstones(removed);
    for (const id of removed) pendingDeletes.add(id);
    channel?.postMessage({ type: 'replace', events: plain, removed });

    // Drop removed events from the confirmed-remote set so pending stays
    // accurate even if the Supabase delete races.
    for (const id of removed) unmarkRemote(id);
    reportPending();

    // Propagate deletions to Supabase so cross-device viewers see the undo.
    // On failure the ids stay in pendingDeletes and reconcile retries.
    void deleteRemote(removed);
  };

  const clear = () => replace([]);

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  const subscribeRealtime = () => {
    // Fully remove the prior channel — `unsubscribe()` alone leaves the named
    // channel registered, so `supabase.channel(name)` returns the same
    // already-subscribed instance and `.on()` then errors with "cannot add
    // postgres_changes callbacks after subscribe()".
    if (realtimeChannel) {
      supabase.removeChannel(realtimeChannel);
      realtimeChannel = null;
    }
    realtimeChannel = supabase
      .channel(`match:${matchId.value}:${channelSuffix}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'events',
          filter: `match_id=eq.${matchId.value}`,
        },
        (payload) => {
          const row = payload.new as Parameters<typeof fromRow>[0];
          const ev = fromRow(row);
          upsertLocal(ev);
          markRemote(ev.id);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'events',
          filter: `match_id=eq.${matchId.value}`,
        },
        (payload) => {
          const row = payload.old as { id?: string };
          if (row?.id) removeLocal(row.id);
        }
      )
      .subscribe();
  };

  const subscribeBroadcast = () => {
    channel?.close();
    if (typeof window === 'undefined') return;
    channel = new BroadcastChannel(`sb-match-${matchId.value}`);
    channel.onmessage = (msg) => {
      if (msg.data?.type === 'append') {
        upsertLocal(msg.data.event);
      } else if (msg.data?.type === 'replace') {
        addTombstones((msg.data.removed as string[] | undefined) ?? []);
        events.value = [...(msg.data.events as RacquetEvent[])].sort(sortById);
        void persist();
      }
    };
  };

  const startRetryLoop = () => {
    if (retryTimer) return;
    retryTimer = setInterval(() => {
      // Only reconcile when there's something to push or a delete to confirm.
      // Saves a SELECT every 10s while the user is just spectating.
      const hasPending =
        events.value.some((e) => !remoteIds.value.has(e.id)) ||
        pendingDeletes.size > 0 ||
        !remoteIds.value.size;
      if (hasPending) void reconcile();
    }, SYNC_RETRY_INTERVAL_MS);
  };

  const stopRetryLoop = () => {
    if (retryTimer) {
      clearInterval(retryTimer);
      retryTimer = null;
    }
  };

  const init = async () => {
    if (typeof window === 'undefined') return;
    const gen = ++generation;
    const mid = matchId.value;
    // 1. Hydrate from IDB immediately (await — but cheap, two key reads).
    const [storedEvents, storedTombstones] = await Promise.all([
      readEvents(mid),
      readTombstones(mid),
    ]);
    if (gen !== generation) return;
    tombstones.value = new Set(storedTombstones);
    events.value = storedEvents
      .filter((e) => !tombstones.value.has(e.id))
      .sort(sortById);
    // Don't reportPending here — remoteIds is empty so the count would be
    // misleadingly high until reconcile confirms what's actually in Supabase.
    // 2. Wire same-device cross-tab sync.
    subscribeBroadcast();
    // 3. Subscribe to remote changes.
    subscribeRealtime();
    // 4. Reconcile with Supabase (pull + push).
    await reconcile();
    if (gen !== generation) return;
    // Mark loaded *after* reconcile so consumers gating on "is the match
    // actually fresh?" only run their logic once we've heard from Supabase.
    loaded.value = true;
    // 5. Start periodic retry while pending.
    startRetryLoop();
  };

  onMounted(() => {
    void init();
  });

  // Trigger a reconcile when the network returns.
  watch(online, (isOnline) => {
    if (isOnline) void reconcile();
  });

  onUnmounted(() => {
    generation++;
    channel?.close();
    channel = null;
    if (realtimeChannel) {
      supabase.removeChannel(realtimeChannel);
      realtimeChannel = null;
    }
    stopRetryLoop();
    // Don't clear the pending count on unmount — the events are still in IDB
    // and another mount (different page, same match) will recompute it. But
    // clear *this* match's contribution so a stale count doesn't linger if the
    // user navigates away from a match with no pending writes.
    setPending(matchId.value, 0);
  });

  // Re-init on matchId change.
  watch(matchId, (next, prev) => {
    if (prev) setPending(prev, 0);
    // Clear state synchronously — an in-flight reconcile or retry tick must
    // never see the old match's events paired with the new matchId (it would
    // push them under the wrong match_id). The generation bump in init()
    // cancels those loops at their next await boundary.
    generation++;
    events.value = [];
    tombstones.value = new Set();
    pendingDeletes.clear();
    remoteIds.value = new Set();
    loaded.value = false;
    void init();
  });

  return { events, append, replace, clear, loaded };
}
