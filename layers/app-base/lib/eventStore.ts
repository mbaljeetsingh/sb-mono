// Per-match event store backed by IndexedDB (via idb-keyval).
//
// Each match is one IDB key (`sb:events:{matchId}`) holding the events array.
// We use the raw functional API (not VueUse's `useIDBKeyval`) because
// `useEvents` needs imperative read/write coordinated with Supabase + the
// BroadcastChannel, plus `keys()` for enumeration in `localMatches.ts`.

import type { RacquetEvent } from "@sb/engine";
import { del, entries, get, keys, set } from "idb-keyval";

const PREFIX = "sb:events:";

export const eventKey = (matchId: string): string => `${PREFIX}${matchId}`;

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
};

// Enumerate match IDs that have an event store on this device. Used by the
// anonymous-matches list and the claim-on-login flow.
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
