// @scoreboard/engine — public API
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
