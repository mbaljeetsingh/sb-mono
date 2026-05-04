// useEvents — local-first event store for a single match.
//
// v1 implementation: localStorage + BroadcastChannel for same-device cross-tab sync.
// v2: layer Dexie (offline-tolerant queue) + Supabase Realtime (cross-device sync).

import type { RacquetEvent } from "@scoreboard/engine";
import { ulid } from "ulid";

const STORAGE_PREFIX = "sb:events:";

export function useEvents(matchId: Ref<string>) {
  const events = ref<RacquetEvent[]>([]);
  let channel: BroadcastChannel | null = null;

  const storageKey = computed(() => `${STORAGE_PREFIX}${matchId.value}`);

  const load = () => {
    if (!import.meta.client) return;
    try {
      const raw = localStorage.getItem(storageKey.value);
      events.value = raw ? (JSON.parse(raw) as RacquetEvent[]) : [];
    } catch {
      events.value = [];
    }
  };

  const persist = () => {
    if (!import.meta.client) return;
    localStorage.setItem(storageKey.value, JSON.stringify(events.value));
  };

  const append = (partial: Omit<RacquetEvent, "id" | "ts">): RacquetEvent => {
    const ev = { id: ulid(), ts: Date.now(), ...partial } as RacquetEvent;
    events.value = [...events.value, ev];
    persist();
    channel?.postMessage({ type: "append", event: ev });
    return ev;
  };

  const replace = (next: RacquetEvent[]) => {
    events.value = next;
    persist();
    channel?.postMessage({ type: "replace", events: next });
  };

  const clear = () => replace([]);

  onMounted(() => {
    load();
    channel = new BroadcastChannel(`sb-match-${matchId.value}`);
    channel.onmessage = (msg) => {
      if (msg.data?.type === "append") {
        events.value = [...events.value, msg.data.event];
      } else if (msg.data?.type === "replace") {
        events.value = msg.data.events;
      }
    };
    // Re-sync if another tab updates localStorage directly (page refresh in another tab).
    window.addEventListener("storage", (e) => {
      if (e.key === storageKey.value) load();
    });
  });

  onUnmounted(() => {
    channel?.close();
    channel = null;
  });

  watch(matchId, () => {
    load();
  });

  return { events, append, replace, clear };
}
