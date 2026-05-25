// Per-match event store backed by IndexedDB (via idb-keyval).
//
// Each match is one IDB key (`sb:events:{matchId}`) holding the events array.
// We use the raw functional API (not VueUse's `useIDBKeyval`) because
// `useEvents` needs imperative read/write coordinated with Supabase + the
// BroadcastChannel, plus `keys()` for enumeration in `localMatches.ts`.

import type { RacquetEvent } from "@sb/engine";
import { del, entries, get, keys, set } from "idb-keyval";

const PREFIX = "sb:events:";
// Distinct from sb:events:* — set only when THIS device authored at least one
// event for the match (via `useEvents.append`). Read-only / passive surfaces
// (venue TV, scoreboard, overlay) still populate sb:events via realtime, but
// never set this flag. The /matches list and claim-on-login both read this
// scoped view, so viewing-only devices don't pollute their match list.
const SCORED_PREFIX = "sb:scored:";

export const eventKey = (matchId: string): string => `${PREFIX}${matchId}`;
export const scoredKey = (matchId: string): string =>
  `${SCORED_PREFIX}${matchId}`;

export const readEvents = async (matchId: string): Promise<RacquetEvent[]> => {
  return (await get<RacquetEvent[]>(eventKey(matchId))) ?? [];
};

export const writeEvents = async (
  matchId: string,
  events: RacquetEvent[],
): Promise<void> => {
  // JSON round-trip strips Vue reactive proxies — IDB's structured clone
  // algorithm can't serialize them.
  await set(eventKey(matchId), JSON.parse(JSON.stringify(events)));
};

export const deleteEvents = async (matchId: string): Promise<void> => {
  await del(eventKey(matchId));
  await del(scoredKey(matchId));
};

// Mark this match as scored on this device. Called from `useEvents.append`
// (the user-tap path) only; realtime / broadcast handlers don't call it.
export const markScored = async (matchId: string): Promise<void> => {
  await set(scoredKey(matchId), Date.now());
};

// Enumerate match IDs that have an event store on this device — includes
// matches received via realtime / broadcast only. Kept for debug + migration.
export const listLocalMatchIds = async (): Promise<string[]> => {
  const ks = await keys();
  const ids: string[] = [];
  for (const k of ks) {
    if (typeof k === "string" && k.startsWith(PREFIX)) {
      ids.push(k.slice(PREFIX.length));
    }
  }
  return ids;
};

// Enumerate match IDs THIS device actually scored at least once. The right
// source for the anon /matches list and the claim-on-login flow — viewers
// (venue TV, scoreboard, overlay) don't appear here.
export const listScoredMatchIds = async (): Promise<string[]> => {
  const ks = await keys();
  const ids: string[] = [];
  for (const k of ks) {
    if (typeof k === "string" && k.startsWith(SCORED_PREFIX)) {
      ids.push(k.slice(SCORED_PREFIX.length));
    }
  }
  return ids;
};

// Debug helper — returns all event entries keyed by matchId. Not used by app
// code; handy in the console when verifying IDB state.
export const debugAllEvents = async (): Promise<
  Record<string, RacquetEvent[]>
> => {
  const all = await entries<string, RacquetEvent[]>();
  const out: Record<string, RacquetEvent[]> = {};
  for (const [k, v] of all) {
    if (typeof k === "string" && k.startsWith(PREFIX)) {
      out[k.slice(PREFIX.length)] = v;
    }
  }
  return out;
};
