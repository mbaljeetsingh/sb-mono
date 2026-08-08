import { useStorage } from '@vueuse/core';
import { computed } from 'vue';
import {
  addRecentNames,
  isNameList,
  normalizeNames,
  removeName,
} from '~/lib/recent-players';

// Player names the operator has used before on THIS browser, most-recent
// first. Device-local by design: it never syncs, never reaches Supabase, and
// holds nothing but names the operator typed themselves.
//
// Sibling of `sb:last-format` and justified the same way — a scorer running a
// club evening plays ten matches over the same pool of eight people, and
// retyping four names per match is the single biggest cost in /new. The v1
// decision not to remember names was right for a one-off match and wrong for
// that.
//
// Not IndexedDB: IDB is reserved for data that must survive (the event log,
// tombstones). Losing this list costs the operator some typing, nothing more.
const STORAGE_KEY = 'sb:recent-players';

export function useRecentPlayers() {
  // Fresh array literal, not a shared module-level default — useStorage writes
  // the default back to apply mergeDefaults and would otherwise mutate a value
  // captured by every other caller.
  const stored = useStorage<string[]>(STORAGE_KEY, []);

  // The `?? []` is load-bearing despite the non-null type, for the same reason
  // /new guards `sb:last-format`: useStorage only falls back to its default
  // when the key is absent or the JSON fails to parse, so a stored literal
  // `null` parses cleanly and arrives here as null. `isNameList` then rejects
  // any other stale shape (a devtools edit, a future object form) instead of
  // letting it reach the template, and normalizeNames re-applies the cap.
  const names = computed(() => {
    const raw = stored.value ?? [];
    return isNameList(raw) ? normalizeNames(raw) : [];
  });

  /** Promote `incoming` to the front of the list. Call after a match is created. */
  const remember = (incoming: string[]) => {
    stored.value = addRecentNames(names.value, incoming);
  };

  // Long-press to remove is invisible until you know it exists, so the first
  // chip row carries a one-line caption. Dismissed permanently on the first
  // successful removal — at that point the gesture is learned and the caption
  // is just clutter on a surface built for speed.
  const hintDismissed = useStorage('sb:recent-players-hint', false);

  /**
   * Drop a name and return everything the removal changed, so the caller can
   * offer a true Undo. Returning a snapshot rather than exposing setters keeps
   * the restore exact — ordering included — without callers reaching into
   * storage.
   *
   * The hint flag is part of the snapshot, not just the names: a first-time
   * user whose finger rested too long removes a name by accident and taps
   * Undo, and if the flag didn't roll back they'd silently lose the caption
   * explaining the gesture they hadn't meant to use yet.
   */
  type RecentPlayersSnapshot = { names: string[]; hintDismissed: boolean };

  const remove = (name: string): RecentPlayersSnapshot => {
    const snapshot = { names: names.value, hintDismissed: hintDismissed.value };
    stored.value = removeName(snapshot.names, name);
    hintDismissed.value = true;
    return snapshot;
  };

  const restore = (snapshot: RecentPlayersSnapshot) => {
    stored.value = normalizeNames(snapshot.names);
    hintDismissed.value = snapshot.hintDismissed;
  };

  return { names, remember, remove, restore, hintDismissed };
}
