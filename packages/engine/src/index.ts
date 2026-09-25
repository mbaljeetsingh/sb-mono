// @sb/engine — public API
//
// State is always computed by replaying events through the appropriate
// sport-family reducer. Each sport-family lives under src/sports/<family>/.

export type { BaseEvent, BaseState, SportFamily } from './core/types';

// Racquet family (badminton, tennis, padel, pickleball, table tennis)
export type {
  GameScore,
  RacquetConfig,
  RacquetEvent,
  RacquetState,
  ScoringMode,
  ServeRule,
  SideId,
  TennisGameTier,
  PointRace,
  Tiebreak,
} from './sports/racquet-shared';

// Scoring-mode helpers the UI layer needs to render a score it did not compute.
// `pointLabel` maps a tennis/padel rally tally onto 0/15/30/40/AD; the
// `format*` pair and `unitNoun` describe a format in the operator's language,
// which has to live here because the config fields mean different things per
// scoring mode (see formatHeadline).
export {
  formatDetail,
  formatHeadline,
  effectiveConfig,
  gameTierOf,
  isMatchTiebreakSet,
  isTiebreakScore,
  pointLabel,
  slotInCourt,
  unitNoun,
} from './sports/racquet-shared';

// Badminton
export {
  badminton15,
  badminton21,
  reduce as reduceBadminton,
  applyUndo as applyBadmintonUndo,
} from './sports/badminton';

// The reducer under sports/badminton implements all three scoring modes —
// rally (points-per-game / win-by / cap / games-to-win / interval), pickleball
// side-out, and the tennis point/game/set tiers — and is reused by every
// racquet preset. Re-exported under a generic name so call sites don't lie.
export {
  reduce as reduceRacquet,
  applyUndo as applyRacquetUndo,
} from './sports/badminton';

// Sport-preset registry — single lookup: sport_preset → { config, reducer, sport, displayName }.
export {
  defaultPresetBySport,
  getPreset,
  padelGolden,
  padelOfficial,
  padelStar,
  pickleballClassic,
  pickleballOfficial,
  pickleballOfficial15,
  pickleballRally,
  presetsForSport,
  sportPresets,
  squashClassic,
  squashPar11,
  tableTennis,
  tableTennis21,
  tennisBasic,
  tennisFast4,
  tennisMatchTiebreak,
  tennisOfficial,
  type RacquetPresetEntry,
  type SportPresetId,
} from './registry';
