// useSyncStatus — global pending-event counter for the AppHeader offline pill.
//
// `useEvents` reports its per-match pending count (events in IDB not yet
// confirmed in Supabase) by calling `setPending(matchId, count)`. The header
// reads `total.value` reactively. Module-scoped state means a single source
// of truth across pages — no prop-drilling, no provide/inject.
//
// State lives in memory only. Pending state itself is *derived* from
// `localEvents - remoteConfirmed` inside each `useEvents` instance, so a
// reload reconstructs it from IDB + Supabase on the next mount.

import { computed, ref } from "vue";

const pendingByMatch = ref<Map<string, number>>(new Map());

export const setPending = (matchId: string, count: number) => {
  const next = new Map(pendingByMatch.value);
  if (count <= 0) next.delete(matchId);
  else next.set(matchId, count);
  pendingByMatch.value = next;
};

export const clearPending = (matchId: string) => setPending(matchId, 0);

export const useSyncStatus = () => {
  const total = computed(() => {
    let n = 0;
    for (const v of pendingByMatch.value.values()) n += v;
    return n;
  });
  const hasPending = computed(() => total.value > 0);
  return { total, hasPending };
};
