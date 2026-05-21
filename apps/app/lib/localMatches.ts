// Local-match utilities: enumerate matchIds present in this browser's
// localStorage, and claim any whose Supabase row is still owner_id IS NULL
// once the user signs in. RLS already permits the NULL → auth.uid()
// transition via the matches_update_anon_authed policy.

import type { SupabaseClient } from "@supabase/supabase-js";

export type LocalMatchRow = {
  id: string;
  sport_preset: string;
  config: { gamesToWin?: number } | null;
  team_name_a: string | null;
  team_name_b: string | null;
  event_name: string | null;
  court_label: string | null;
  updated_at: string;
};

const META_PREFIX = "sb:meta:";
const EVENTS_PREFIX = "sb:events:";
const FORMAT_PRESET_PREFIX = "sb:format:preset:";
const FORMAT_GAMES_PREFIX = "sb:format:gamesToWin:";

// ULID first 10 chars = Crockford-base32 millisecond timestamp. Used as the
// display date for local rows that have no remote row yet (no point appended).
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
const ulidToISO = (id: string): string => {
  try {
    const ts = id.slice(0, 10).toUpperCase();
    let ms = 0;
    for (const c of ts) {
      const v = CROCKFORD.indexOf(c);
      if (v < 0) return new Date().toISOString();
      ms = ms * 32 + v;
    }
    return new Date(ms).toISOString();
  } catch {
    return new Date().toISOString();
  }
};

const readJSON = <T>(key: string): T | null => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
};

export const collectLocalMatchIds = (): string[] => {
  if (typeof localStorage === "undefined") return [];
  const ids = new Set<string>();
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k) continue;
    if (k.startsWith(EVENTS_PREFIX)) ids.add(k.slice(EVENTS_PREFIX.length));
    else if (k.startsWith(META_PREFIX)) ids.add(k.slice(META_PREFIX.length));
  }
  return [...ids];
};

type LocalMeta = {
  sportPreset?: string;
  teamNames?: { a?: string; b?: string };
  eventName?: string;
  courtLabel?: string;
};

export const readLocalMatches = (): LocalMatchRow[] => {
  const ids = collectLocalMatchIds();
  const rows: LocalMatchRow[] = [];
  for (const id of ids) {
    const meta = readJSON<LocalMeta>(`${META_PREFIX}${id}`) ?? {};
    const sportPreset =
      readJSON<string>(`${FORMAT_PRESET_PREFIX}${id}`) ??
      meta.sportPreset ??
      "badminton-21";
    const gamesToWin = readJSON<number>(`${FORMAT_GAMES_PREFIX}${id}`);
    rows.push({
      id,
      sport_preset: sportPreset,
      config: typeof gamesToWin === "number" ? { gamesToWin } : null,
      team_name_a: meta.teamNames?.a ?? null,
      team_name_b: meta.teamNames?.b ?? null,
      event_name: meta.eventName ?? null,
      court_label: meta.courtLabel ?? null,
      updated_at: ulidToISO(id),
    });
  }
  // ULIDs are time-sortable; newest first.
  rows.sort((a, b) => (a.id < b.id ? 1 : -1));
  return rows;
};

// Claim local anonymous matches for the just-signed-in user. Updates only
// rows whose owner_id is still NULL — RLS will silently filter the rest.
// Returns the count of rows actually claimed.
export const claimAnonymousMatches = async (
  supabase: SupabaseClient,
  uid: string,
): Promise<number> => {
  const ids = collectLocalMatchIds();
  if (ids.length === 0) return 0;
  const { data, error } = await supabase
    .from("matches")
    .update({ owner_id: uid })
    .in("id", ids)
    .is("owner_id", null)
    .select("id");
  if (error) {
    console.warn("[claimAnonymousMatches] failed", error);
    return 0;
  }
  return data?.length ?? 0;
};
