// Sport identity for the app layer — the union, the display metadata, and the
// preset → sport mapping. The engine registry types `sport` as a plain string
// (it doesn't care which sports the UI ships), so the closed union lives here.
//
// Single source of truth for anything that needs to *show* a sport: SportPicker,
// SportGlyph, MatchListItem, the match hub.

import { type SportPresetId, getPreset } from '@sb/engine';

export type SportId =
  'badminton' | 'tennis' | 'padel' | 'pickleball' | 'table-tennis' | 'squash';

export type SportMeta = {
  id: SportId;
  label: string;
  /** Short format hint shown under the label in the picker. */
  preset: string;
  /** Public sports. Every sport in the list ships an engine preset, a court
   *  and a themed control surface; the flag stays so a sport can be held back
   *  mid-development without deleting its entry. */
  enabled: boolean;
  /** Played only as doubles (padel) — /new hides the singles option. */
  doublesOnly?: boolean;
  /** Played only as singles here (squash) — /new hides the doubles option. */
  singlesOnly?: boolean;
};

export const SPORTS: SportMeta[] = [
  {
    id: 'badminton',
    label: 'Badminton',
    preset: '21pt BWF',
    enabled: true,
  },
  {
    id: 'table-tennis',
    label: 'Table tennis',
    preset: '11pt, BO5',
    enabled: true,
  },
  { id: 'tennis', label: 'Tennis', preset: 'Sets + tiebreak', enabled: true },
  {
    id: 'pickleball',
    label: 'Pickleball',
    preset: 'Side-out to 11',
    enabled: true,
  },
  {
    id: 'padel',
    label: 'Padel',
    preset: 'Sets · doubles',
    enabled: true,
    doublesOnly: true,
  },
  {
    id: 'squash',
    label: 'Squash',
    preset: 'PAR to 11, BO5',
    enabled: true,
    singlesOnly: true,
  },
];

/** Sports that have no singles format. */
export const isDoublesOnly = (sport: SportId): boolean =>
  SPORTS.find((s) => s.id === sport)?.doublesOnly ?? false;

/** Sports offered only as singles. Squash doubles exists, but on a wider
 * court with its own rules that nothing here models. */
export const isSinglesOnly = (sport: SportId): boolean =>
  SPORTS.find((s) => s.id === sport)?.singlesOnly ?? false;

/**
 * Width ÷ length of the real playing surface, as the Tailwind class /control
 * gives its court frame from `sm` up. These sports are not the same shape —
 * badminton is long and narrow, padel is exactly twice as long as it is wide,
 * a table tennis table is narrower still — so drawing them all at badminton's
 * ratio made four of the five courts a lie.
 *
 * Written out as whole literal class strings rather than composed at runtime:
 * Tailwind scans source text for class names and never sees an interpolated
 * one, so `sm:aspect-[${w}/${l}]` would generate no CSS at all.
 */
export const courtAspectClass: Record<SportId, string> = {
  // BWF 6.1m × 13.4m.
  badminton: 'sm:aspect-[61/134]',
  // ITF doubles 10.97m × 23.77m.
  tennis: 'sm:aspect-[1097/2377]',
  // FIP 10m × 20m — the one court that is a clean 1:2.
  padel: 'sm:aspect-[1/2]',
  // USAP 6.1m × 13.41m (20ft × 44ft).
  pickleball: 'sm:aspect-[610/1341]',
  // ITTF table 1.525m × 2.74m.
  'table-tennis': 'sm:aspect-[305/548]',
  // WSF singles court 6.4m × 9.75m, seen from above with the front wall at
  // the top — one shared court, not two halves.
  squash: 'sm:aspect-[640/975]',
};

const SPORT_IDS = new Set<string>(SPORTS.map((s) => s.id));

/**
 * Resolve a `matches.sport_preset` value (e.g. "badminton-21") to its SportId.
 * Falls back to badminton — the default preset — for unknown values so a row
 * with stale data still renders an icon instead of a hole.
 */
export const sportIdFromPreset = (
  preset: string | null | undefined
): SportId => {
  const { sport } = getPreset(preset);
  return SPORT_IDS.has(sport) ? (sport as SportId) : 'badminton';
};

/**
 * Human-readable preset name from the engine registry ("Badminton 21"), rather
 * than de-slugging the raw id — `sport_preset.replace(/-/g, ' ')` surfaced
 * internal ids like "badminton 21" / "table tennis" to users.
 */
export const presetDisplayName = (preset: string | null | undefined): string =>
  preset ? getPreset(preset).displayName : '';

/**
 * How /new names and explains each format: a short label for the scoring
 * toggle, and one plain sentence of how it plays.
 *
 * App copy, not engine copy — the engine's `formatHeadline`/`formatDetail`
 * stay for compact contexts. Typed by preset id so a new preset can't ship
 * without an entry. Sentences describe the GAME's rules only, never match
 * length: the Best-of control overrides a preset's length, so "one game to 21"
 * would be wrong the moment someone picks best of 3.
 */
export const presetCopy: Record<
  SportPresetId,
  { label: string; blurb: string }
> = {
  'badminton-21': {
    label: 'Official · 21',
    blurb: 'Every rally scores. Games to 21, win by 2, capped at 30.',
  },
  'badminton-15': {
    label: '15-point',
    blurb:
      'Every rally scores. Games to 15, win by 2, capped at 21 — the BWF 2027 proposal.',
  },
  'tennis-official': {
    label: 'Official',
    blurb: '15, 30, 40, advantage. Sets to 6 with a tiebreak at 6–6.',
  },
  'tennis-match-tiebreak': {
    label: 'No-ad · match TB',
    blurb:
      'No advantage — 40–40 is one deciding point. A 10-point match tiebreak replaces the deciding set.',
  },
  'tennis-fast4': {
    label: 'Fast4',
    blurb: 'Sets to 4, no advantage, tiebreak to 5 at 3–3.',
  },
  'tennis-basic': {
    label: 'Games only',
    blurb: 'One tap per game — no points. Sets to 6, win by 2.',
  },
  'pickleball-official': {
    label: 'Official · 11',
    blurb:
      'Only the serving side scores. Games to 11, win by 2; doubles opens each game at 0‑0‑2.',
  },
  'pickleball-official-15': {
    label: 'Official · 15',
    blurb: 'Only the serving side scores. Games to 15, win by 2.',
  },
  'pickleball-classic': {
    label: 'Rally · 11',
    blurb: 'Every rally scores, like badminton. Games to 11, win by 2.',
  },
  'pickleball-rally': {
    label: 'Rally · 21',
    blurb: 'Every rally scores, like badminton. Games to 21, win by 2.',
  },
  'padel-official': {
    label: 'Advantage',
    blurb: '15, 30, 40, advantage. Sets to 6 with a tiebreak at 6–6.',
  },
  'padel-star': {
    label: 'Star point',
    blurb:
      'Two advantages, then a third deuce is one deciding point (FIP 2026). Tiebreak at 6–6.',
  },
  'padel-golden': {
    label: 'Golden point',
    blurb: '40–40 is decided by one rally. Sets to 6, tiebreak at 6–6.',
  },
  'table-tennis': {
    label: 'Official · 11',
    blurb:
      'Every rally scores. Games to 11, win by 2; serve changes every 2 points.',
  },
  'table-tennis-21': {
    label: 'Classic · 21',
    blurb: 'Every rally scores. Games to 21, win by 2; serve changes every 5.',
  },
  'squash-par11': {
    label: 'Official · PAR 11',
    blurb: 'Every rally scores. Games to 11, win by 2.',
  },
  'squash-classic': {
    label: 'Classic · 9',
    blurb:
      'Only the server scores. Games to 9 — at 8–all the receiver picks 9 or 10.',
  },
};
