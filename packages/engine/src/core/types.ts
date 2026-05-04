// @scoreboard/engine — core types shared across sport families.
//
// Sport families:
//   - racquet  : badminton, tennis, pickleball, table tennis, squash, volleyball
//   - cricket  : ball-by-ball, innings-based (T20, ODI, Test, custom)
//   - (future) : chess (turn+time), golf (per-hole), free-form
//
// Each sport family defines its own MatchEvent union and MatchState shape.
// All families conform to the BaseEvent / BaseState shape so storage and sync
// can be uniform.

export type SportFamily = "racquet" | "cricket";

/** Every event ever stored has at minimum these fields. */
export type BaseEvent = {
  /** ULID — sortable, globally unique, conflict-free across devices. */
  id: string;
  /** Date.now() at write time. Powers replay-by-timestamp and v2 video burn-in. */
  ts: number;
  /** Discriminator. Each sport family defines its own union. */
  type: string;
};

/** Every state shape includes at minimum these fields. */
export type BaseState = {
  matchOver: boolean;
  /** Sport-family-specific winner identifier (SideId for racquet, team for cricket, etc.). */
  winner: string | null;
};
