// Recent player names — the local MRU list behind the suggestion chips on
// /new.
//
// Storage binding lives in `useRecentPlayers`; everything here is pure so the
// list semantics (cap, ordering, dedupe, filtering) are testable without a
// browser.
//
// Case handling is deliberately asymmetric. On INSERT we collapse
// case-insensitive duplicates so typing "baljeet" when "Baljeet" is already
// stored refreshes that entry's recency instead of growing a second
// near-identical chip. We do NOT merge variants that already coexist, and we
// never rewrite the spelling the operator typed — showing a name twice is a
// smaller annoyance than silently renaming someone.

export const RECENT_PLAYERS_CAP = 20;

/**
 * Pointer travel, in px, past which a press on a chip is a pan rather than a
 * tap or a hold.
 *
 * Lives here rather than in either chip component because BOTH must agree on
 * it and PlayerChips already imports this module (importing a constant out of
 * PlayerChip.vue instead would need a second <script> block, and the reverse
 * direction is a cycle). When they disagreed there was a dead band: the row
 * armed its click-swallow at 4px while onLongPress kept VueUse's 10px default,
 * so a 5-9px drag held past the delay both swallowed the tap *and* fired the
 * removal — the user nudged the row sideways and lost a name.
 */
export const POINTER_SLOP_PX = 5;

/**
 * The names a match actually has, given its mode — the one rule both writers
 * of this list must agree on.
 *
 * Partner slots count only in doubles, and each writer gets that wrong in its
 * own way if left to itself: `/new` hides the partner inputs when you flip to
 * Singles but never clears their refs, and SettingsSheet edits `teamNames` in
 * singles while leaving `players` at whatever creation put there. Either one
 * alone would file names into the list for people who never played.
 *
 * Note the singles pair can hold a genuine team name ("Indonesia") rather than
 * a person. That's the same thing an operator could type into /new's Player 1
 * field, so it belongs in the list on the same terms — not worth detecting.
 */
export const namesInPlay = (
  isDoubles: boolean,
  doubles: [string, string, string, string],
  singles: [string, string]
): string[] => (isDoubles ? [...doubles] : [...singles]);

/** Storage shape is a bare string[]. Anything else on disk is discarded. */
export const isNameList = (v: unknown): v is string[] =>
  Array.isArray(v) && v.every((n) => typeof n === 'string');

const fold = (s: string) => s.trim().toLowerCase();

/**
 * Trim, drop blanks, collapse case-insensitive duplicates (first occurrence
 * wins, so the most recent spelling survives), cap to `RECENT_PLAYERS_CAP`.
 * Applied on read as well as write — a key written by an older build, or
 * hand-edited in devtools, shouldn't be able to render a 500-chip row.
 */
export const normalizeNames = (names: string[]): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of names) {
    const name = raw.trim();
    if (!name) continue;
    const key = fold(name);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
    if (out.length >= RECENT_PLAYERS_CAP) break;
  }
  return out;
};

/**
 * Push names onto the front of the list, most-recent-first. `incoming` is
 * given in field order (a1, a2, b1, b2) — they all came from the same match,
 * so their relative order is arbitrary; what matters is that the whole batch
 * outranks everything already stored.
 */
export const addRecentNames = (list: string[], incoming: string[]): string[] =>
  normalizeNames([...incoming, ...list]);

/**
 * Drop a name from the list. Case-insensitive, so removing the chip you can
 * see also removes the spelling variant behind it if one slipped in.
 *
 * Removal is what makes the list self-correcting: a mistyped name is
 * effectively permanent otherwise. With a stable pool of ~8 regulars and a cap
 * of 20, a typo sits at position 9 forever — it takes 12 further *distinct*
 * names to evict, which a club scorer never generates.
 */
export const removeName = (list: string[], name: string): string[] => {
  const target = fold(name);
  return list.filter((n) => fold(n) !== target);
};

/**
 * Chips to offer for one name field.
 *
 * `query` is the field's current text — matching is prefix-based on the full
 * name *or* on any word within it, so "si" surfaces "Baljeet Singh" without
 * the loose substring matching that makes "an" hit half the list.
 *
 * `exclude` is the other name fields of the match in progress: nobody plays
 * against themselves, and dropping them means the last doubles field offers a
 * short row instead of the same ten names for the fourth time.
 */
export const suggestNames = (
  list: string[],
  query: string,
  exclude: string[]
): string[] => {
  const blocked = new Set(exclude.map(fold).filter(Boolean));
  const q = fold(query);
  return list.filter((name) => {
    if (blocked.has(fold(name))) return false;
    if (!q) return true;
    return fold(name)
      .split(/\s+/)
      .some((word) => word.startsWith(q));
  });
};
