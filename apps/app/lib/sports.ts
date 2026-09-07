// Sport identity for the app layer — the union, the display metadata, and the
// preset → sport mapping. The engine registry types `sport` as a plain string
// (it doesn't care which sports the UI ships), so the closed union lives here.
//
// Single source of truth for anything that needs to *show* a sport: SportPicker,
// SportGlyph, MatchListItem, the match hub.

import { getPreset } from '@sb/engine';

export type SportId =
  'badminton' | 'tennis' | 'padel' | 'pickleball' | 'table-tennis';

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
];

/** Sports that have no singles format. */
export const isDoublesOnly = (sport: SportId): boolean =>
  SPORTS.find((s) => s.id === sport)?.doublesOnly ?? false;

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
