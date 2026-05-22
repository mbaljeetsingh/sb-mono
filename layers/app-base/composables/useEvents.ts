// useEvents — local-first + Supabase event store for a single match.
//
// Strategy:
//  1. localStorage is the immediate read source (fast UI, survives offline / cold start).
//  2. On mount, fetch existing events from Supabase and merge with localStorage (dedupe by id).
//  3. Subscribe to Supabase Realtime INSERT + DELETE for cross-device sync.
//  4. BroadcastChannel handles same-device cross-tab sync (faster than going via Supabase).
//  5. append() writes locally + inserts to Supabase. replace() truncates locally + deletes
//     the diff from Supabase so undo on phone propagates to the OBS overlay on a laptop.
//
// Match row creation is lazy — the first append() call that finds no match row creates one
// (owner_id = auth.uid() if signed in, null otherwise). This way the URL works whether the
// user came from /new or pasted a shared URL.

import type { RacquetEvent } from "@sb/engine";
import { ulid } from "ulid";
import { ref, computed, onMounted, onUnmounted, watch, type Ref } from "vue";

const STORAGE_PREFIX = "sb:events:";

type ParsedEvent = RacquetEvent;

// Supabase events row → in-memory RacquetEvent. The DB stores type + payload
// split; ts is timestamptz (ISO 8601) on the wire, but the engine works in ms.
const fromRow = (row: {
  id: string;
  ts: string;
  type: string;
  payload: Record<string, unknown> | null;
}): ParsedEvent => {
  return {
    id: row.id,
    ts: Date.parse(row.ts),
    type: row.type,
    ...(row.payload ?? {}),
  } as ParsedEvent;
};

// In-memory RacquetEvent → DB columns. Strip `id` + `ts` + `type` from payload.
const toRow = (
  ev: ParsedEvent,
  matchId: string,
  deviceId: string,
): {
  id: string;
  match_id: string;
  device_id: string;
  ts: string;
  type: string;
  payload: Record<string, unknown>;
} => {
  const { id, ts, type, ...rest } = ev as ParsedEvent & Record<string, unknown>;
  return {
    id,
    match_id: matchId,
    device_id: deviceId,
    ts: new Date(ts).toISOString(),
    type,
    payload: rest as Record<string, unknown>,
  };
};

// Stable per-browser device id used for event provenance + dedupe heuristics.
const deviceIdKey = "sb:device-id";
const getDeviceId = (): string => {
  if (typeof localStorage === "undefined") return "ssr";
  let id = localStorage.getItem(deviceIdKey);
  if (!id) {
    id = ulid();
    localStorage.setItem(deviceIdKey, id);
  }
  return id;
};

// Local-only fat-finger guard for point events. If the user has registered a
// same-side `point` within the window, drop this tap as an accidental
// double-press. Cross-device dedup is handled separately: the active-scorer
// handoff (`useScorerActive`) ensures only one device writes at a time, and
// realtime echoes are dropped by id in `upsertLocal`. So this window only
// needs to cover physical double-taps on a touchscreen (~150–250 ms); anything
// longer starts blocking legitimate fast scoring during quick rallies or
// testing.
const POINT_DEDUP_WINDOW_MS = 250;

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
  const supabaseUser = useSupabaseUser();
  const writeToken = opts.writeToken;

  const events = ref<RacquetEvent[]>([]);
  const storageKey = computed(() => `${STORAGE_PREFIX}${matchId.value}`);

  let channel: BroadcastChannel | null = null;
  let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;
  // Per-instance unique channel-name suffix. Without this, when the user
  // navigates between two pages that both call this composable with the
  // same matchId (e.g., /control → /m/[id]), the source page hasn't
  // unmounted yet, supabase.channel(sameName) returns the existing
  // already-subscribed instance, and `.on()` errors.
  const channelSuffix = Math.random().toString(36).slice(2, 10);

  const sortById = (a: RacquetEvent, b: RacquetEvent) =>
    a.id < b.id ? -1 : a.id > b.id ? 1 : 0;

  const persist = () => {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(storageKey.value, JSON.stringify(events.value));
  };

  const loadLocal = (): RacquetEvent[] => {
    if (typeof localStorage === "undefined") return [];
    try {
      const raw = localStorage.getItem(storageKey.value);
      return raw ? (JSON.parse(raw) as RacquetEvent[]) : [];
    } catch {
      return [];
    }
  };

  const fetchRemote = async (): Promise<RacquetEvent[]> => {
    const { data, error } = await supabase
      .from("events")
      .select("id, ts, type, payload")
      .eq("match_id", matchId.value)
      .order("ts", { ascending: true });
    if (error) {
      console.warn("[useEvents] fetch remote failed", error);
      return [];
    }
    return (data ?? []).map(fromRow);
  };

  // Idempotent. Inserts the match row if it doesn't exist. owner_id reflects the
  // current auth state at the moment the row is created — anonymous → null.
  const ensureMatchRow = async (): Promise<void> => {
    const id = matchId.value;
    if (!id) return;
    const { data: existing, error: lookupError } = await supabase
      .from("matches")
      .select("id")
      .eq("id", id)
      .maybeSingle();
    if (lookupError) {
      console.warn("[useEvents] match lookup failed", lookupError);
      return;
    }
    if (existing) return;

    // Read from getSession() rather than the reactive `useSupabaseUser()` —
    // on first paint the ref can still be null even when the cookie session
    // is valid, which would orphan the row with owner_id=null.
    const { data: sessionData } = await supabase.auth.getSession();
    const ownerId =
      sessionData.session?.user?.id ?? supabaseUser.value?.id ?? null;
    const { error: insertError } = await supabase.from("matches").insert({
      id,
      owner_id: ownerId,
      sport_family: "racquet",
      sport_preset: "badminton-21",
    });
    if (insertError) {
      // Conflict (someone else inserted it first) is fine.
      if (insertError.code !== "23505") {
        console.warn("[useEvents] match insert failed", insertError);
      }
    }
  };

  // Local-only mutation helpers (used by realtime + broadcast handlers).
  const upsertLocal = (incoming: RacquetEvent) => {
    if (events.value.some((e) => e.id === incoming.id)) return;
    events.value = [...events.value, incoming].sort(sortById);
    persist();
  };

  const removeLocal = (id: string) => {
    if (!events.value.some((e) => e.id === id)) return;
    events.value = events.value.filter((e) => e.id !== id);
    persist();
  };

  // ─── Public API ───────────────────────────────────────────────────────────

  const append = (partial: Omit<RacquetEvent, "id" | "ts">): RacquetEvent => {
    // JSON round-trip strips Vue reactive proxies (which `structuredClone`
    // can't clone) — callers can pass reactive state directly without
    // hitting `DataCloneError` on the BroadcastChannel hop below.
    const ev = JSON.parse(
      JSON.stringify({ id: ulid(), ts: Date.now(), ...partial }),
    ) as RacquetEvent;

    // Cross-device + fat-finger dedup for point events. If the same side
    // already scored within the window, treat this as a duplicate observation
    // and drop it. The engine sees one point, the UI updates once, the
    // network never carries the dupe.
    if (ev.type === "point") {
      const side = (ev as RacquetEvent & { side?: string }).side;
      const recent = events.value.find((e) => {
        if (e.type !== "point") return false;
        if ((e as RacquetEvent & { side?: string }).side !== side) return false;
        return ev.ts - (e.ts ?? 0) < POINT_DEDUP_WINDOW_MS;
      });
      if (recent) {
        console.warn(
          "[useEvents] dropping duplicate point within",
          POINT_DEDUP_WINDOW_MS,
          "ms",
          { kept: recent.id, dropped: ev.id },
        );
        return recent;
      }
    }

    events.value = [...events.value, ev].sort(sortById);
    persist();
    channel?.postMessage({ type: "append", event: ev });

    // Fire-and-forget: ensure match exists, then insert the event.
    (async () => {
      if (writeToken?.value) {
        // Co-scorer path: the match row is guaranteed to exist (the owner
        // already created it before minting a token), so skip ensureMatchRow
        // and route through the RPC that validates the token server-side.
        const { id, ts, type, ...rest } = ev as ParsedEvent &
          Record<string, unknown>;
        const { error } = await supabase.rpc("append_event_with_token", {
          p_match_id: matchId.value,
          p_token: writeToken.value,
          p_event_id: id,
          p_device_id: getDeviceId(),
          p_ts: new Date(ts).toISOString(),
          p_type: type,
          p_payload: rest as Record<string, unknown>,
        });
        if (error) console.warn("[useEvents] rpc append failed", error);
        return;
      }

      await ensureMatchRow();
      const { error } = await supabase
        .from("events")
        .insert(toRow(ev, matchId.value, getDeviceId()));
      if (error) {
        console.warn("[useEvents] event insert failed", error);
        // localStorage retains the event so the UI still works offline; future
        // E1.x adds a Dexie-backed retry queue for true offline tolerance.
      }
    })();

    return ev;
  };

  const replace = (next: RacquetEvent[]) => {
    const before = new Set(events.value.map((e) => e.id));
    const after = new Set(next.map((e) => e.id));
    const removed = [...before].filter((id) => !after.has(id));

    // JSON round-trip strips Vue reactive proxies — same defense as
    // `append()`. Callers can pass the existing reactive `events.value`
    // (or a slice of it) without `BroadcastChannel.postMessage` failing.
    const plain = JSON.parse(JSON.stringify(next)) as RacquetEvent[];
    events.value = [...plain].sort(sortById);
    persist();
    channel?.postMessage({ type: "replace", events: plain });

    // Propagate deletions to Supabase so cross-device viewers see the undo.
    if (removed.length) {
      (async () => {
        if (writeToken?.value) {
          const { error } = await supabase.rpc("delete_events_with_token", {
            p_match_id: matchId.value,
            p_token: writeToken.value,
            p_event_ids: removed,
          });
          if (error) console.warn("[useEvents] rpc delete failed", error);
          return;
        }
        const { error } = await supabase
          .from("events")
          .delete()
          .in("id", removed);
        if (error) console.warn("[useEvents] event delete failed", error);
      })();
    }
  };

  const clear = () => replace([]);

  // ─── Lifecycle ────────────────────────────────────────────────────────────

  const subscribeRealtime = () => {
    // Fully remove the prior channel — `unsubscribe()` alone leaves the named
    // channel registered, so `supabase.channel(name)` returns the same already-
    // subscribed instance and `.on()` then errors with "cannot add
    // postgres_changes callbacks after subscribe()".
    if (realtimeChannel) {
      supabase.removeChannel(realtimeChannel);
      realtimeChannel = null;
    }
    realtimeChannel = supabase
      .channel(`match:${matchId.value}:${channelSuffix}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "events",
          filter: `match_id=eq.${matchId.value}`,
        },
        (payload) => {
          const row = payload.new as Parameters<typeof fromRow>[0];
          upsertLocal(fromRow(row));
        },
      )
      .on(
        "postgres_changes",
        {
          event: "DELETE",
          schema: "public",
          table: "events",
          filter: `match_id=eq.${matchId.value}`,
        },
        (payload) => {
          const row = payload.old as { id?: string };
          if (row?.id) removeLocal(row.id);
        },
      )
      .subscribe();
  };

  const subscribeBroadcast = () => {
    channel?.close();
    if (typeof window === "undefined") return;
    channel = new BroadcastChannel(`sb-match-${matchId.value}`);
    channel.onmessage = (msg) => {
      if (msg.data?.type === "append") {
        upsertLocal(msg.data.event);
      } else if (msg.data?.type === "replace") {
        events.value = [...(msg.data.events as RacquetEvent[])].sort(sortById);
        persist();
      }
    };
  };

  const init = async () => {
    if (typeof window === "undefined") return;
    // 1. Hydrate from localStorage immediately for fast paint.
    events.value = loadLocal().sort(sortById);
    // 2. Wire same-device cross-tab sync.
    subscribeBroadcast();
    // 3. Subscribe to remote changes.
    subscribeRealtime();
    // 4. Pull any remote events we don't have yet.
    const remote = await fetchRemote();
    const seen = new Set(events.value.map((e) => e.id));
    const merged = [
      ...events.value,
      ...remote.filter((e) => !seen.has(e.id)),
    ].sort(sortById);
    events.value = merged;
    persist();
  };

  onMounted(() => {
    init();
    window.addEventListener("storage", (e) => {
      if (e.key === storageKey.value) {
        events.value = loadLocal().sort(sortById);
      }
    });
  });

  onUnmounted(() => {
    channel?.close();
    channel = null;
    if (realtimeChannel) {
      supabase.removeChannel(realtimeChannel);
      realtimeChannel = null;
    }
  });

  // Re-init on matchId change.
  watch(matchId, () => {
    init();
  });

  return { events, append, replace, clear };
}
