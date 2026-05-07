// Shared types and helpers for the "racquet/court" sport family.
// Used by: badminton, tennis, pickleball, table tennis, squash, volleyball.
//
// Sports in this family share an event vocabulary (point / undo / game.end /
// match.start / sides.swap / team.rename) but differ in rules and may attach
// sport-specific extensions to MatchState.

import type { BaseEvent, BaseState } from "../core/types";

export type SideId = "A" | "B";

export type RacquetEvent =
  | (BaseEvent & {
      type: "match.start";
      serverSide: SideId;
      serverCourt: "right" | "left";
    })
  | (BaseEvent & { type: "point"; side: SideId })
  | (BaseEvent & { type: "undo" })
  | (BaseEvent & { type: "game.end" })
  | (BaseEvent & { type: "sides.swap" })
  | (BaseEvent & { type: "team.rename"; side: SideId; name: string })
  | (BaseEvent & { type: "walkover"; winner: SideId })
  | (BaseEvent & {
      type: "retirement";
      retiring: SideId;
      reason?: string;
    })
  | (BaseEvent & {
      type: "default";
      defaulted: SideId;
      reason?: string;
    })
  | (BaseEvent & {
      type: "timeout.start";
      side: SideId;
      kind: "standard" | "medical" | "injury";
    })
  | (BaseEvent & { type: "timeout.end"; side: SideId })
  | (BaseEvent & { type: "suspension.start"; reason?: string })
  | (BaseEvent & { type: "suspension.end" })
  | (BaseEvent & {
      type: "score.correct";
      games: GameScore[];
      gamesWon: { a: number; b: number };
      reason?: string;
    })
  | (BaseEvent & {
      // BWF Law 16 / ITTF analog. Yellow = warning (no score change),
      // red = fault (point to opponent), black = disqualification (match ends).
      type: "penalty";
      side: SideId;
      card: "yellow" | "red" | "black";
      reason?: string;
    });

export type GameScore = { a: number; b: number };

export type RacquetState = BaseState & {
  /** Per-game scores, in order. The last entry is the current game (when not betweenGames or matchOver). */
  games: GameScore[];
  gamesWon: { a: number; b: number };
  servingSide: SideId;
  serverCourt: "right" | "left";
  betweenGames: boolean;
  winner: SideId | null;
  atInterval: boolean;
  isGamePoint: boolean;
  isMatchPoint: boolean;
  names: { a: string; b: string };
  sidesSwapped: boolean;
  /** How the match ended: 'normal' if scored to completion, or one of the
   * terminal events. null while in progress. */
  endReason: "normal" | "walkover" | "retirement" | "default" | null;
  /** Set when a timeout is currently active. */
  timeout: { side: SideId; kind: "standard" | "medical" | "injury" } | null;
  /** Set while the match is suspended (rain, power, crowd, etc.). */
  suspended: boolean;
  /**
   * Doubles partner tracking (BWF Law 8). Identifies which slot (1 or 2) of each team
   * is currently in their RIGHT service court. The other slot is in the left court.
   *
   * Initial: both teams have slot 1 in the right court (slot 1 of the receiving team
   * is the initial receiver, sitting in the diagonal — which is their right court).
   *
   * Update on point: if the scoring side was the serving side ("won on serve"), the
   * two partners on that team swap courts (toggle the team's flag). Otherwise, no
   * change — the receiving team gains service but doesn't swap. The current server's
   * identity is then derived: in `serverCourt === 'right'`, the slot equal to
   * `partnerOnRight[team]` is serving; in `'left'`, the OTHER slot is serving.
   *
   * Reset to `{ a: 1, b: 1 }` at the start of each new game.
   *
   * Singles: this field is set but ignored — the only player on each side is always
   * "in" both courts conceptually.
   */
  partnerOnRight: { a: 1 | 2; b: 1 | 2 };
  /** Penalty card counts per side. Themes/UI surface non-zero counts. */
  cards: {
    a: { yellow: number; red: number; black: number };
    b: { yellow: number; red: number; black: number };
  };
};

/** Generic config shape for all racquet-family sports. Sports may extend with their own fields. */
export type RacquetConfig = {
  sport: string;
  displayName: string;
  /** Points required to win a game in normal play. */
  pointsPerGame: number;
  /** Win-by margin (2 for badminton/tennis, 0 for "first to N"). */
  winBy: number;
  /** Hard cap at which the leader wins regardless of margin (30 for BWF 21-pt). null = no cap. */
  cap: number | null;
  /** Games to win the match (e.g., 2 in best-of-3, 3 in best-of-5). */
  gamesToWin: number;
  /** First score at which a BWF-style interval is flagged. null = no interval. */
  intervalAt: number | null;
};

export const initialRacquetState = (): RacquetState => ({
  games: [{ a: 0, b: 0 }],
  gamesWon: { a: 0, b: 0 },
  servingSide: "A",
  serverCourt: "right",
  betweenGames: false,
  matchOver: false,
  winner: null,
  atInterval: false,
  isGamePoint: false,
  isMatchPoint: false,
  names: { a: "Team A", b: "Team B" },
  sidesSwapped: false,
  endReason: null,
  timeout: null,
  suspended: false,
  partnerOnRight: { a: 1, b: 1 },
  cards: {
    a: { yellow: 0, red: 0, black: 0 },
    b: { yellow: 0, red: 0, black: 0 },
  },
});

/** Returns the side that has won the game, or null if neither has yet. */
export const isGameWon = (
  game: GameScore,
  cfg: RacquetConfig,
): SideId | null => {
  const { a, b } = game;
  const need = cfg.pointsPerGame;
  const margin = cfg.winBy;
  const cap = cfg.cap ?? Number.POSITIVE_INFINITY;
  if (a >= cap && a > b) return "A";
  if (b >= cap && b > a) return "B";
  if (a >= need && a - b >= margin) return "A";
  if (b >= need && b - a >= margin) return "B";
  return null;
};

/** Returns true if the given side scoring one more point would win the current game. */
export const wouldWinGameWithPoint = (
  game: GameScore,
  side: SideId,
  cfg: RacquetConfig,
): boolean => {
  const next =
    side === "A" ? { a: game.a + 1, b: game.b } : { a: game.a, b: game.b + 1 };
  return isGameWon(next, cfg) === side;
};

/**
 * Trim the most recent point or game.end event so callers can re-reduce for a true undo.
 * Pure: returns a new array.
 */
export const trimLastPointOrGameEnd = (
  events: RacquetEvent[],
): RacquetEvent[] => {
  for (let i = events.length - 1; i >= 0; i--) {
    const t = events[i]!.type;
    if (t === "point" || t === "game.end") {
      return [...events.slice(0, i), ...events.slice(i + 1)];
    }
  }
  return events;
};
