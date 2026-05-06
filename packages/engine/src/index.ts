// @sb/engine — public API
//
// State is always computed by replaying events through the appropriate
// sport-family reducer. Each sport-family lives under src/sports/<family>/.

export type { BaseEvent, BaseState, SportFamily } from "./core/types";

// Racquet family (badminton, tennis, pickleball, table tennis, squash, volleyball)
export type {
  GameScore,
  RacquetConfig,
  RacquetEvent,
  RacquetState,
  SideId,
} from "./sports/racquet-shared";

// Badminton
export {
  badminton15,
  badminton21,
  reduce as reduceBadminton,
  applyUndo as applyBadmintonUndo,
} from "./sports/badminton";

// The badminton reducer implements generic rally scoring (points-per-game /
// win-by / cap / games-to-win / interval) and is reused by every racquet
// preset. Re-exported under a generic name so call sites don't lie about it.
export {
  reduce as reduceRacquet,
  applyUndo as applyRacquetUndo,
} from "./sports/badminton";

// Sport-preset registry — single lookup: sport_preset → { config, reducer, sport, displayName }.
export {
  defaultPresetBySport,
  getPreset,
  pickleballClassic,
  pickleballRally,
  sportPresets,
  tableTennis,
  tennisBasic,
  type RacquetPresetEntry,
  type SportPresetId,
} from "./registry";
