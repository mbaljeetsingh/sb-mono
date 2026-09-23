// Sport-preset registry. Single source of truth: sport_preset → { config, reducer, sport, displayName }.
//
// Adding a sport in the racquet family = one entry below. The shared reducer
// implements all three scoring modes (`cfg.scoring`) — rally, side-out and the
// tennis point/game/set tiers — so badminton, table tennis, pickleball, tennis
// and padel all run through it.
//
// New sport family = add a sibling reducer + entries here.
//
// PRESET IDS ARE DATA. `matches.sport_preset` stores one of these strings per
// match and `getPreset` replays the whole event log against whatever config the
// id resolves to, so re-pointing an existing id at different rules silently
// rescores every match ever played under it. Add ids; never repurpose them.
//
// Each sport ships an OFFICIAL preset (its governing body's ruleset) and, where
// the sport is commonly played a shorter way, a SIMPLIFIED one.

import { badminton15, badminton21 } from './sports/badminton/config';
import { reduce as reduceRacquet } from './sports/badminton/reducer';
import type {
  RacquetConfig,
  RacquetEvent,
  RacquetState,
} from './sports/racquet-shared';

export type SportPresetId =
  | 'badminton-21'
  | 'badminton-15'
  | 'tennis-official'
  | 'tennis-match-tiebreak'
  | 'tennis-fast4'
  | 'tennis-basic'
  | 'pickleball-official'
  | 'pickleball-official-15'
  | 'pickleball-classic'
  | 'pickleball-rally'
  | 'padel-official'
  | 'padel-star'
  | 'padel-golden'
  | 'table-tennis'
  | 'table-tennis-21';

// Presets shipped on day one. Each preset is a self-contained RacquetConfig.
// Cap = null means "no hard cap" — the win-by margin must be reached.

// ITF scoring in full: rallies win points on the 0/15/30/40 ladder, four points
// (by two) win a game, six games (by two) win a set, and 6–6 goes to a seven-
// point tiebreak. `pointsPerGame` / `winBy` / `cap` describe the SET here — the
// tier shift that `scoring: 'tennis'` implies — so `cap: 7` is the tiebreak set.
const tennisOfficial: RacquetConfig = {
  sport: 'tennis',
  displayName: 'Tennis (official)',
  scoring: 'tennis',
  pointsPerGame: 6,
  winBy: 2,
  cap: 7,
  gamesToWin: 2,
  intervalAt: null,
  serveRule: 'rally-winner',
  gameTier: { pointsToWin: 4, winBy: 2 },
  tiebreak: { atGames: 6, pointsToWin: 7, winBy: 2 },
  partnerRotation: 'fixed',
};

// What pro doubles and most club leagues actually play: no-ad games (40–40 is
// decided by one rally) and, at one set all, a 10-point match tiebreak in place
// of the deciding set.
const tennisMatchTiebreak: RacquetConfig = {
  ...tennisOfficial,
  displayName: 'Tennis (no-ad, match tiebreak)',
  gameTier: { pointsToWin: 4, winBy: 1 },
  matchTiebreak: { pointsToWin: 10, winBy: 2 },
};

// Fast4 (Tennis Australia / LTA): first to 4 games, no-ad, and at 3–3 a
// tiebreak to 5 with sudden death at 4–4. `cap: 4` is the tiebreak set, 4–3.
const tennisFast4: RacquetConfig = {
  ...tennisOfficial,
  displayName: 'Tennis (Fast4)',
  pointsPerGame: 4,
  cap: 4,
  gameTier: { pointsToWin: 4, winBy: 1 },
  tiebreak: { atGames: 3, pointsToWin: 5, winBy: 1 },
};

// The original simplified preset, kept byte-identical because live matches
// carry this id: a "set" is the engine's game and a "game" is the engine's
// point, so a club match is scored 6–4 without the 15/30/40 ladder. First to 6
// with a margin of 2; no tiebreak, so 7–7 just plays on.
const tennisBasic: RacquetConfig = {
  sport: 'tennis',
  displayName: 'Tennis (quick, count games only)',
  scoring: 'rally',
  pointsPerGame: 6,
  winBy: 2,
  cap: null,
  gamesToWin: 2,
  intervalAt: null,
  serveRule: 'rally-winner',
};

// USA Pickleball: side-out scoring — only the serving side can score, doubles
// teams get two servers per turn, and each game opens on "0–0–2". First to 11
// by 2, best of 3.
const pickleballOfficial: RacquetConfig = {
  sport: 'pickleball',
  displayName: 'Pickleball (official, side-out 11)',
  scoring: 'side-out',
  pointsPerGame: 11,
  winBy: 2,
  cap: null,
  gamesToWin: 2,
  intervalAt: null,
  serveRule: 'rally-winner',
  // USAP: ends change in the deciding game when the leader reaches 6.
  endsChangeAt: 6,
};

// Tournament pool play and medal games: a single side-out game to 15, ends
// changing at 8.
const pickleballOfficial15: RacquetConfig = {
  ...pickleballOfficial,
  displayName: 'Pickleball (official, side-out 15)',
  pointsPerGame: 15,
  gamesToWin: 1,
  endsChangeAt: 8,
};

// The badminton-style game many groups play: every rally scores, whoever
// serves. The id predates side-out scoring; it has always meant this.
const pickleballClassic: RacquetConfig = {
  sport: 'pickleball',
  displayName: 'Pickleball (rally 11, every point scores)',
  scoring: 'rally',
  pointsPerGame: 11,
  winBy: 2,
  cap: null,
  gamesToWin: 2,
  intervalAt: null,
  serveRule: 'rally-winner',
  endsChangeAt: 6,
};

const pickleballRally: RacquetConfig = {
  sport: 'pickleball',
  displayName: 'Pickleball (rally 21, every point scores)',
  scoring: 'rally',
  pointsPerGame: 21,
  winBy: 2,
  cap: null,
  gamesToWin: 1,
  intervalAt: null,
  serveRule: 'rally-winner',
  endsChangeAt: 11,
};

// FIP: padel borrows tennis scoring wholesale — 15/30/40, six games by two, a
// seven-point tiebreak at 6–6, best of three sets. Always doubles.
const padelOfficial: RacquetConfig = {
  sport: 'padel',
  displayName: 'Padel (official, advantage)',
  scoring: 'tennis',
  pointsPerGame: 6,
  winBy: 2,
  cap: 7,
  gamesToWin: 2,
  intervalAt: null,
  serveRule: 'rally-winner',
  gameTier: { pointsToWin: 4, winBy: 2 },
  tiebreak: { atGames: 6, pointsToWin: 7, winBy: 2 },
  partnerRotation: 'fixed',
  doublesOnly: true,
};

// STAR POINT (FIP rules from 2026, played on the Premier Padel tour): two
// advantages are played as normal, and a third 40–40 is settled by one rally.
const padelStar: RacquetConfig = {
  ...padelOfficial,
  displayName: 'Padel (star point)',
  gameTier: { pointsToWin: 4, winBy: 2, suddenDeathAtDeuce: 3 },
};

// The GOLDEN POINT: at 40–40 the next rally takes the game, no advantages. It
// is what the professional tour plays and what most clubs use to keep courts
// moving, so it ships as padel's shorter option.
const padelGolden: RacquetConfig = {
  ...padelOfficial,
  displayName: 'Padel (golden point)',
  gameTier: { pointsToWin: 4, winBy: 1 },
};

const tableTennis: RacquetConfig = {
  sport: 'table-tennis',
  displayName: 'Table tennis (official, 11 · BO5)',
  scoring: 'rally',
  pointsPerGame: 11,
  winBy: 2,
  cap: null,
  gamesToWin: 3,
  intervalAt: null,
  // ITTF: serve alternates every 2 points, every 1 from 10–10. Initial server
  // also alternates between games.
  serveRule: 'alternate',
  serveTurnLength: 2,
  // ITTF: in the last possible game, ends change (and in doubles the
  // receiving order reverses) when one side first reaches 5.
  endsChangeAt: 5,
};

// The pre-2001 game, still what most garages and clubs play: 21 points, serve
// every 5, and single points from 20–20.
const tableTennis21: RacquetConfig = {
  sport: 'table-tennis',
  displayName: 'Table tennis (classic, 21)',
  scoring: 'rally',
  pointsPerGame: 21,
  winBy: 2,
  cap: null,
  gamesToWin: 2,
  intervalAt: null,
  serveRule: 'alternate',
  serveTurnLength: 5,
  endsChangeAt: 10,
};

export type RacquetPresetEntry = {
  id: SportPresetId;
  sport: string;
  displayName: string;
  config: RacquetConfig;
  /** Reducer for this preset's family. */
  reducer: (events: RacquetEvent[], cfg: RacquetConfig) => RacquetState;
  /** The governing body's ruleset for this sport, as opposed to a shortened
   *  club variant. Exactly one per sport; drives the "Official" badge and
   *  `defaultPresetBySport`. */
  official?: boolean;
};

const entry = (
  id: SportPresetId,
  config: RacquetConfig,
  official = false
): RacquetPresetEntry => ({
  id,
  sport: config.sport,
  displayName: config.displayName,
  config,
  reducer: reduceRacquet,
  official,
});

export const sportPresets: Record<SportPresetId, RacquetPresetEntry> = {
  'badminton-21': entry('badminton-21', badminton21, true),
  'badminton-15': entry('badminton-15', badminton15),
  'tennis-official': entry('tennis-official', tennisOfficial, true),
  'tennis-match-tiebreak': entry('tennis-match-tiebreak', tennisMatchTiebreak),
  'tennis-fast4': entry('tennis-fast4', tennisFast4),
  'tennis-basic': entry('tennis-basic', tennisBasic),
  'pickleball-official': entry('pickleball-official', pickleballOfficial, true),
  'pickleball-official-15': entry(
    'pickleball-official-15',
    pickleballOfficial15
  ),
  'pickleball-classic': entry('pickleball-classic', pickleballClassic),
  'pickleball-rally': entry('pickleball-rally', pickleballRally),
  'padel-official': entry('padel-official', padelOfficial, true),
  'padel-star': entry('padel-star', padelStar),
  'padel-golden': entry('padel-golden', padelGolden),
  'table-tennis': entry('table-tennis', tableTennis, true),
  'table-tennis-21': entry('table-tennis-21', tableTennis21),
};

/** Default preset per sport — used when a UI just picks a sport without a specific format. */
export const defaultPresetBySport: Record<string, SportPresetId> = {
  badminton: 'badminton-21',
  tennis: 'tennis-official',
  pickleball: 'pickleball-official',
  padel: 'padel-official',
  'table-tennis': 'table-tennis',
};

/** Look up a preset; falls back to badminton-21 if unknown. */
export const getPreset = (id: string | null | undefined): RacquetPresetEntry =>
  sportPresets[id as SportPresetId] ?? sportPresets['badminton-21']!;

/** Presets for one sport, official first. */
export const presetsForSport = (sport: string): RacquetPresetEntry[] =>
  Object.values(sportPresets)
    .filter((p) => p.sport === sport)
    .sort((a, b) => Number(b.official ?? false) - Number(a.official ?? false));

export {
  tennisOfficial,
  tennisMatchTiebreak,
  tennisFast4,
  pickleballOfficial15,
  padelStar,
  tennisBasic,
  pickleballOfficial,
  pickleballClassic,
  pickleballRally,
  padelOfficial,
  padelGolden,
  tableTennis,
  tableTennis21,
};
