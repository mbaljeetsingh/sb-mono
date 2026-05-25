// Sport-preset registry. Single source of truth: sport_preset → { config, reducer, sport, displayName }.
//
// Adding a sport in the racquet family = one entry below. The badminton reducer
// implements generic rally scoring (points per game, win-by, cap, games-to-win,
// interval) and is reused for tennis/pickleball/table-tennis. Doubles partner
// rotation in `state.partnerOnRight` is BWF-specific; non-badminton themes
// should ignore it.
//
// New sport family = add a sibling reducer + entries here.

import { badminton15, badminton21 } from "./sports/badminton/config";
import { reduce as reduceRacquet } from "./sports/badminton/reducer";
import type {
  RacquetConfig,
  RacquetEvent,
  RacquetState,
} from "./sports/racquet-shared";

export type SportPresetId =
  | "badminton-21"
  | "badminton-15"
  | "tennis-basic"
  | "pickleball-classic"
  | "pickleball-rally"
  | "table-tennis";

// Presets shipped on day one. Each preset is a self-contained RacquetConfig.
// Cap = null means "no hard cap" — the win-by margin must be reached.

const tennisBasic: RacquetConfig = {
  sport: "tennis",
  displayName: "Tennis (basic, no tiebreak)",
  // We treat a "set" as the engine's game and a "game" as the engine's point.
  // First to 6 with margin of 2 wins a set; first to 2 sets wins. v1 ships no
  // tiebreak (deferred to v1.x); 7-7 sets just keep going until margin of 2.
  pointsPerGame: 6,
  winBy: 2,
  cap: null,
  gamesToWin: 2,
  intervalAt: null,
  serveRule: "rally-winner",
};

const pickleballClassic: RacquetConfig = {
  sport: "pickleball",
  displayName: "Pickleball (classic, 11)",
  pointsPerGame: 11,
  winBy: 2,
  cap: null,
  gamesToWin: 2,
  intervalAt: null,
  serveRule: "rally-winner",
};

const pickleballRally: RacquetConfig = {
  sport: "pickleball",
  displayName: "Pickleball (rally, 21)",
  pointsPerGame: 21,
  winBy: 2,
  cap: null,
  gamesToWin: 1,
  intervalAt: null,
  serveRule: "rally-winner",
};

const tableTennis: RacquetConfig = {
  sport: "table-tennis",
  displayName: "Table tennis (11, BO5)",
  pointsPerGame: 11,
  winBy: 2,
  cap: null,
  gamesToWin: 3,
  intervalAt: null,
  // ITTF: serve alternates every 2 points, every 1 from 10–10. Initial server
  // also alternates between games.
  serveRule: "alternate-every-2",
};

export type RacquetPresetEntry = {
  id: SportPresetId;
  sport: string;
  displayName: string;
  config: RacquetConfig;
  /** Reducer for this preset's family. */
  reducer: (events: RacquetEvent[], cfg: RacquetConfig) => RacquetState;
};

export const sportPresets: Record<SportPresetId, RacquetPresetEntry> = {
  "badminton-21": {
    id: "badminton-21",
    sport: "badminton",
    displayName: badminton21.displayName,
    config: badminton21,
    reducer: reduceRacquet,
  },
  "badminton-15": {
    id: "badminton-15",
    sport: "badminton",
    displayName: badminton15.displayName,
    config: badminton15,
    reducer: reduceRacquet,
  },
  "tennis-basic": {
    id: "tennis-basic",
    sport: "tennis",
    displayName: tennisBasic.displayName,
    config: tennisBasic,
    reducer: reduceRacquet,
  },
  "pickleball-classic": {
    id: "pickleball-classic",
    sport: "pickleball",
    displayName: pickleballClassic.displayName,
    config: pickleballClassic,
    reducer: reduceRacquet,
  },
  "pickleball-rally": {
    id: "pickleball-rally",
    sport: "pickleball",
    displayName: pickleballRally.displayName,
    config: pickleballRally,
    reducer: reduceRacquet,
  },
  "table-tennis": {
    id: "table-tennis",
    sport: "table-tennis",
    displayName: tableTennis.displayName,
    config: tableTennis,
    reducer: reduceRacquet,
  },
};

/** Default preset per sport — used when a UI just picks a sport without a specific format. */
export const defaultPresetBySport: Record<string, SportPresetId> = {
  badminton: "badminton-21",
  tennis: "tennis-basic",
  pickleball: "pickleball-classic",
  "table-tennis": "table-tennis",
};

/** Look up a preset; falls back to badminton-21 if unknown. */
export const getPreset = (id: string | null | undefined): RacquetPresetEntry =>
  sportPresets[id as SportPresetId] ?? sportPresets["badminton-21"]!;

export { tennisBasic, pickleballClassic, pickleballRally, tableTennis };
