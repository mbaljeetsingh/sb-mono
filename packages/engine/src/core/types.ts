// @sb/engine — core types shared across sport families.
//
// Sport families:
//   - racquet  : badminton, tennis, pickleball, table tennis, squash, volleyball
//
// Scoreboard is racquet-only by design. The BaseEvent / BaseState shape is kept
// generic so storage and sync stay uniform if a sibling family is added later.

export type SportFamily = "racquet";

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
  /** Sport-family-specific winner identifier (SideId for racquet, etc.). */
  winner: string | null;
};
