import { computed, type Ref } from "vue";
import { useStorage } from "@vueuse/core";

// useMatchMeta — loads per-match metadata (team names, sport, doubles flag)
// from `localStorage:sb:meta:{matchId}` (written by /new). Used by every surface
// that shows team names so we have one place to read it, and one fallback ladder:
//   user-entered name → "Team A" / "Team B" placeholder.
//
// Backed by VueUse `useStorage` so the ref auto-syncs across same-domain tabs
// (laptop overlay updates when phone control edits names) and survives reloads.
//
// v1.x: this will hydrate from Supabase once the matches row carries the same
// fields. The composable shape stays the same.

export type MatchMeta = {
  sport?: string;
  sportPreset?: string;
  isDoubles?: boolean;
  teamNames?: { a: string; b: string };
  players?: { a1: string; a2: string; b1: string; b2: string };
  /** Tournament metadata surfaced by themes (e.g. "Quarterfinal", "Mixed Doubles", "Court 1"). */
  eventName?: string;
  round?: string;
  category?: string;
  courtLabel?: string;
};

const EMPTY: MatchMeta = {};

export function useMatchMeta(matchId: Ref<string>) {
  // Reactive key — when matchId changes, useStorage swaps which row it reads.
  const key = computed(() => `sb:meta:${matchId.value}`);
  const meta = useStorage<MatchMeta>(key, EMPTY, undefined, {
    mergeDefaults: true,
  });

  // Display names with placeholder fallback. Empty user input is treated as
  // "no name given" — themes show "Team A" / "Team B" rather than literal blanks.
  const teamNames = computed(() => ({
    a: meta.value.teamNames?.a?.trim() || "Team A",
    b: meta.value.teamNames?.b?.trim() || "Team B",
  }));

  return { meta, teamNames };
}
