// Sport identity for the app layer — the union, the display metadata, and the
// preset → sport mapping. The engine registry types `sport` as a plain string
// (it doesn't care which sports the UI ships), so the closed union lives here.
//
// Single source of truth for anything that needs to *show* a sport: SportPicker,
// SportGlyph, MatchListItem, the match hub.

import { getPreset } from '@sb/engine';

export type SportId = 'badminton' | 'tennis' | 'pickleball' | 'table-tennis';

export type SportMeta = {
  id: SportId;
  label: string;
  /** Short format hint shown under the label in the picker. */
  preset: string;
  /** Public sports. Tennis + pickleball ship engine configs but their themes
   *  and control surfaces haven't had a polish pass, so they stay disabled. */
  enabled: boolean;
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
    enabled: false,
  },
  { id: 'tennis', label: 'Tennis', preset: 'Coming soon', enabled: false },
  {
    id: 'pickleball',
    label: 'Pickleball',
    preset: 'Coming soon',
    enabled: false,
  },
];

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
