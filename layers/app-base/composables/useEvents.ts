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
import { ref, computed, onMounted, onUnmounted, watch } from "vue";

const STORAGE_PREFIX = "sb:events:";

type ParsedEvent = RacquetEvent;

// Supabase events row → in-memory RacquetEvent. The DB stores type + payload split.
const fromRow = (row: {
  id: string;
  ts: number | string;
  type: string;
  payload: Record<string, unknown> | null;
}): ParsedEvent => {
  return {
    id: row.id,
    ts: typeof row.ts === "string" ? Number(row.ts) : row.ts,
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
  ts: number;
  type: string;
  payload: Record<string, unknown>;
} => {
  const { id, ts, type, ...rest } = ev as ParsedEvent & Record<string, unknown>;
  return {
    id,
    match_id: matchId,
    device_id: deviceId,
    ts,
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

export function useEvents(matchId: Ref<string>) {
  const supabase = useSupabaseClient();
  const supabaseUser = useSupabaseUser();

  const events = ref<RacquetEvent[]>([]);
  const storageKey = computed(() => `${STORAGE_PREFIX}${matchId.value}`);

  let channel: BroadcastChannel | null = null;
  let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;

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

    const ownerId = supabaseUser.value?.id ?? null;
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
    const ev = { id: ulid(), ts: Date.now(), ...partial } as RacquetEvent;
    events.value = [...events.value, ev].sort(sortById);
    persist();
    channel?.postMessage({ type: "append", event: ev });

    // Fire-and-forget: ensure match exists, then insert the event.
    (async () => {
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

    events.value = [...next].sort(sortById);
    persist();
    channel?.postMessage({ type: "replace", events: next });

    // Propagate deletions to Supabase so cross-device viewers see the undo.
    if (removed.length) {
      (async () => {
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
    realtimeChannel?.unsubscribe();
    realtimeChannel = supabase
      .channel(`match:${matchId.value}`)
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
    realtimeChannel?.unsubscribe();
    realtimeChannel = null;
  });

  // Re-init on matchId change.
  watch(matchId, () => {
    init();
  });

  return { events, append, replace, clear };
}
