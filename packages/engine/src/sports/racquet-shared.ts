// Shared types and helpers for the "racquet/court" sport family.
// Used by: badminton, tennis, padel, pickleball, table tennis.
//
// Sports in this family share an event vocabulary (point / undo / game.end /
// match.start / sides.swap / team.rename) but differ in rules and may attach
// sport-specific extensions to MatchState.
//
// THREE SCORING MODES (`RacquetConfig.scoring`), because "who gets a point for
// winning a rally" is the one axis these sports genuinely disagree on:
//
//   'rally'    — every rally scores for its winner. Badminton, table tennis,
//                pickleball's simplified/rally variant.
//   'side-out' — only the SERVING side can score; the receiving side winning a
//                rally wins the serve instead. Official pickleball.
//   'tennis'   — a third tier: rallies win POINTS (0/15/30/40), points win
//                GAMES, games win SETS. Tennis and padel.
//
// Under 'tennis' the existing fields shift one tier up, which keeps every
// downstream consumer (game cells, standings plates, gamesToWin) working
// unchanged: `games[i]` holds the GAME score of set i, `gamesWon` counts SETS,
// `pointsPerGame`/`winBy`/`cap` describe the SET, and the new `points` field
// carries the rally tally inside the current game.

import type { BaseEvent, BaseState } from '../core/types';

export type SideId = 'A' | 'B';

export type RacquetEvent =
  | (BaseEvent & {
      type: 'match.start';
      serverSide: SideId;
      serverCourt: 'right' | 'left';
    })
  | (BaseEvent & { type: 'point'; side: SideId })
  | (BaseEvent & { type: 'undo' })
  | (BaseEvent & { type: 'game.end' })
  | (BaseEvent & { type: 'sides.swap' })
  | (BaseEvent & { type: 'team.rename'; side: SideId; name: string })
  | (BaseEvent & { type: 'walkover'; winner: SideId })
  | (BaseEvent & {
      type: 'retirement';
      retiring: SideId;
      reason?: string;
    })
  | (BaseEvent & {
      type: 'default';
      defaulted: SideId;
      reason?: string;
    })
  | (BaseEvent & {
      type: 'timeout.start';
      side: SideId;
      kind: 'standard' | 'medical' | 'injury';
    })
  | (BaseEvent & { type: 'timeout.end'; side: SideId })
  | (BaseEvent & { type: 'suspension.start'; reason?: string })
  | (BaseEvent & { type: 'suspension.end' })
  | (BaseEvent & {
      type: 'score.correct';
      games: GameScore[];
      gamesWon: { a: number; b: number };
      /** Tennis family only: the rally tally inside the current game. Omitted
       * by non-tennis callers and by older logs, which reset it to 0–0. */
      points?: GameScore;
      reason?: string;
    })
  | (BaseEvent & {
      // BWF Law 16 / ITTF analog. Yellow = warning (no score change),
      // red = fault (point to opponent), black = disqualification (match ends).
      type: 'penalty';
      side: SideId;
      card: 'yellow' | 'red' | 'black';
      reason?: string;
    });

export type GameScore = { a: number; b: number };

export type RacquetState = BaseState & {
  /**
   * Per-game scores, in order. The last entry is the current game (when not
   * betweenGames or matchOver).
   *
   * Under `scoring: 'tennis'` an entry is a SET's game score (6–4), and the
   * rally tally inside the current game lives in `points`.
   */
  games: GameScore[];
  /** Games won — SETS won under `scoring: 'tennis'`. */
  gamesWon: { a: number; b: number };
  /**
   * Tennis family: rally tally inside the current game, as raw counts
   * (0,1,2,3,4…). Display maps these through `pointLabel` — 0/15/30/40/AD in a
   * normal game, plain integers in a tiebreak. Always 0–0 for the other
   * scoring modes, where a rally scores directly into `games`.
   */
  points: GameScore;
  /** Tennis family: the current game is a tiebreak (numeric points, first to
   * `tiebreak.pointsToWin` by `tiebreak.winBy`). */
  inTiebreak: boolean;
  servingSide: SideId;
  /** Initial server of the match (set on match.start). Used by the alternating
   * and per-game serve rules to derive each game's starting server. */
  matchInitialServer: SideId;
  serverCourt: 'right' | 'left';
  /**
   * Side-out doubles (official pickleball): which of the serving team's two
   * players is currently serving — the third number in the "5–3–2" call. It
   * advances 1 → 2 on a fault and only then passes to the opponents.
   *
   * Always 1 for the other scoring modes and for singles, where there is no
   * second server and the score is called with two numbers.
   */
  serverNumber: 1 | 2;
  /**
   * Slot (1 or 2) of the player serving on the serving team.
   *
   * Stored rather than derived because the two families disagree about what
   * determines it. Badminton/pickleball: the server is whoever stands in the
   * court the score parity dictates, so it follows `serverCourt` +
   * `partnerOnRight` and can change every rally. Tennis/padel: one player
   * serves the WHOLE game while `serverCourt` alternates deuce/ad every point,
   * so deriving it from the court would hand the serve to their partner on
   * every second rally.
   */
  serverSlot: 1 | 2;
  betweenGames: boolean;
  winner: SideId | null;
  atInterval: boolean;
  isGamePoint: boolean;
  isMatchPoint: boolean;
  /**
   * Side-attributed game/match point. `isGamePoint`/`isMatchPoint` only say
   * that *someone* is a point away — under rally scoring the receiving side
   * can be at game point, so UI must use these to know *who*. Both sides can
   * be true at once (e.g. 29–29 under the BWF cap).
   *
   * Under `scoring: 'tennis'` `gamePoint` is a point away from the current
   * GAME and `setPoint` a point away from the set; the two nest, so a side at
   * set point is always also at game point.
   */
  gamePoint: { a: boolean; b: boolean };
  matchPoint: { a: boolean; b: boolean };
  /** Tennis family: a point away from taking the current SET. Always false for
   * the other modes, where winning the current game IS `gamePoint`. */
  setPoint: { a: boolean; b: boolean };
  /**
   * Scores level in the win-by-2 extension (20–20 for BWF-21, 14–14 for 15pt,
   * 10–10 for TT, 40–40 for tennis/padel) — the "deuce" every club player
   * calls it. Mutually exclusive with game/match point BY CONSTRUCTION: at the
   * cap tie (29–29) or under golden-point padel the next point wins, so
   * gamePoint carries the display and this stays false. UI can therefore show
   * exactly one of DEUCE / GAME POINT / MATCH POINT.
   */
  isDeuce: boolean;
  names: { a: string; b: string };
  sidesSwapped: boolean;
  /** How the match ended: 'normal' if scored to completion, or one of the
   * terminal events. null while in progress. */
  endReason: 'normal' | 'walkover' | 'retirement' | 'default' | null;
  /** Set when a timeout is currently active. */
  timeout: { side: SideId; kind: 'standard' | 'medical' | 'injury' } | null;
  /** Set while the match is suspended (rain, power, crowd, etc.). */
  suspended: boolean;
  /**
   * Doubles partner tracking (BWF Law 8). Identifies which slot (1 or 2) of each team
   * is currently in their RIGHT service court. The other slot is in the left court.
   *
   * Initial: both teams have slot 1 in the right court (slot 1 of the receiving team
   * is the initial receiver, sitting in the diagonal — which is their right court).
   *
   * Update on point (`partnerRotation: 'serve-swap'` — badminton and pickleball):
   * if the scoring side was the serving side ("won on serve"), the two partners on
   * that team swap courts (toggle the team's flag). Otherwise, no change — the
   * receiving team gains service but doesn't swap. The current server's identity is
   * then derived: in `serverCourt === 'right'`, the slot equal to
   * `partnerOnRight[team]` is serving; in `'left'`, the OTHER slot is serving.
   *
   * Under `partnerRotation: 'fixed'` (tennis, padel) partners hold their halves —
   * each receiver takes the same court all set and the server serves the whole game
   * — so this never toggles and `serverSlot` carries the server's identity instead.
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

/** How a won rally converts into score. See the file header. */
export type ScoringMode = 'rally' | 'side-out' | 'tennis';

/**
 * The game tier inside a tennis/padel set.
 *
 * `winBy: 2` is classic advantage scoring — 40–40 is deuce and a side must win
 * two straight. `winBy: 1` is sudden death at deuce, which padel calls the
 * GOLDEN POINT and tennis calls no-ad; the next rally takes the game.
 */
export type TennisGameTier = {
  /** Rallies needed to win a game. 4 = the 15/30/40/game ladder. */
  pointsToWin: number;
  winBy: 1 | 2;
};

/** Tiebreak played instead of a normal game once a set reaches `atGames`-all. */
export type Tiebreak = {
  atGames: number;
  pointsToWin: number;
  winBy: number;
};

/**
 * How serve passes. Only consulted when `scoring === 'rally'` — the other two
 * modes fully determine service themselves ('side-out' keeps serve until the
 * serving team faults twice; 'tennis' alternates every game).
 *
 * - 'rally-winner': winner of the rally serves next (badminton).
 * - 'alternate': serve alternates every `serveTurnLength` combined points
 *   within a game, then every 1 point once both sides reach
 *   `pointsPerGame - 1` (deuce). Initial server also alternates between games.
 *   ITTF table tennis: 2 (11-point) or 5 (the classic 21-point game).
 */
export type ServeRule = 'rally-winner' | 'alternate';

/** Generic config shape for all racquet-family sports. Sports may extend with their own fields. */
export type RacquetConfig = {
  sport: string;
  displayName: string;
  /** How a won rally converts into score. See ScoringMode. */
  scoring: ScoringMode;
  /** Points required to win a game — GAMES to win a set under 'tennis'. */
  pointsPerGame: number;
  /** Win-by margin (2 for badminton/tennis, 0 for "first to N"). */
  winBy: number;
  /** Hard cap at which the leader wins regardless of margin (30 for BWF 21-pt,
   * 7 for a tiebreak set). null = no cap. */
  cap: number | null;
  /** Games to win the match — SETS to win under 'tennis' (e.g., 2 in best-of-3). */
  gamesToWin: number;
  /** First score at which a BWF-style interval is flagged. null = no interval. */
  intervalAt: number | null;
  /** See ServeRule. Ignored unless `scoring === 'rally'`. */
  serveRule: ServeRule;
  /** Points per service turn under `serveRule: 'alternate'`. Defaults to 2. */
  serveTurnLength?: number;
  /** Required when `scoring === 'tennis'`; ignored otherwise. */
  gameTier?: TennisGameTier;
  /** Tennis family: tiebreak at `atGames`-all. null = play the set out by margin. */
  tiebreak?: Tiebreak | null;
  /**
   * Doubles court rotation. 'serve-swap' (default) is BWF Law 8, also correct
   * for pickleball — partners switch sides each time their team scores on
   * serve. 'fixed' is tennis/padel, where partners hold their halves.
   */
  partnerRotation?: 'serve-swap' | 'fixed';
  /** Sports played only as doubles (padel). The UI hides the singles option. */
  doublesOnly?: boolean;
  /**
   * Whether THIS match is being played as doubles. Unlike everything else here
   * it is a per-match choice rather than a property of the preset, merged in by
   * `useFormat` from the match row.
   *
   * The reducer needs it for exactly one rule: side-out pickleball gives a
   * doubles team two servers per turn and opens each game on "0–0–2", while a
   * singles team has one, so running the doubles rule in singles would hand the
   * server a free fault. Everything else that differs between singles and
   * doubles is presentation, which is why the engine ignored the distinction
   * until now.
   */
  doubles?: boolean;
};

export const initialRacquetState = (): RacquetState => ({
  games: [{ a: 0, b: 0 }],
  gamesWon: { a: 0, b: 0 },
  points: { a: 0, b: 0 },
  inTiebreak: false,
  servingSide: 'A',
  matchInitialServer: 'A',
  serverCourt: 'right',
  serverNumber: 1,
  serverSlot: 1,
  betweenGames: false,
  matchOver: false,
  winner: null,
  atInterval: false,
  isGamePoint: false,
  isMatchPoint: false,
  gamePoint: { a: false, b: false },
  matchPoint: { a: false, b: false },
  setPoint: { a: false, b: false },
  isDeuce: false,
  names: { a: 'Team A', b: 'Team B' },
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

export const other = (side: SideId): SideId => (side === 'A' ? 'B' : 'A');

/** Returns the side that has won the game, or null if neither has yet. */
export const isGameWon = (
  game: GameScore,
  cfg: RacquetConfig
): SideId | null => {
  const { a, b } = game;
  const need = cfg.pointsPerGame;
  const margin = cfg.winBy;
  const cap = cfg.cap ?? Number.POSITIVE_INFINITY;
  if (a >= cap && a > b) return 'A';
  if (b >= cap && b > a) return 'B';
  if (a >= need && a - b >= margin) return 'A';
  if (b >= need && b - a >= margin) return 'B';
  return null;
};

/**
 * Compute the server for the next rally under `serveRule: 'alternate'`
 * (table tennis), given the current game's score AFTER the just-played point.
 *
 * Algorithm:
 * - The initial server of this game is `matchInitialServer` XOR (gameIndex % 2).
 * - If combined score < (pointsPerGame - 1) * 2 (i.e. not at deuce), the server
 *   alternates every `serveTurnLength` combined points: with a turn of 2, 0–0
 *   and 0–1 → initial server, 1–1 and 2–1 → other side, and so on. The classic
 *   21-point game uses a turn of 5.
 * - From deuce onward, the server alternates every single point.
 */
export const computeAlternatingServer = (
  game: GameScore,
  gameIndex: number,
  matchInitialServer: SideId,
  cfg: RacquetConfig
): SideId => {
  const gameInitial: SideId =
    gameIndex % 2 === 0 ? matchInitialServer : other(matchInitialServer);
  const combined = game.a + game.b;
  const deuceCombined = (cfg.pointsPerGame - 1) * 2;
  if (combined >= deuceCombined) {
    return combined % 2 === 0 ? gameInitial : other(gameInitial);
  }
  const turn = Math.max(1, cfg.serveTurnLength ?? 2);
  const pairIdx = Math.floor(combined / turn);
  return pairIdx % 2 === 0 ? gameInitial : other(gameInitial);
};

/** Returns true if the given side scoring one more point would win the current game. */
export const wouldWinGameWithPoint = (
  game: GameScore,
  side: SideId,
  cfg: RacquetConfig
): boolean => {
  const next =
    side === 'A' ? { a: game.a + 1, b: game.b } : { a: game.a, b: game.b + 1 };
  return isGameWon(next, cfg) === side;
};

/**
 * "Deuce": scores level inside the win-by-2 extension — 20–20 for BWF-21,
 * 14–14 for the 15-point variant, 10–10 for table tennis.
 *
 * Callers must treat this as strictly lower priority than game/match point, and
 * it is built so the two can never both apply: if the next point would win the
 * game (29–29 under the BWF cap, or any level score under a `winBy: 0` preset
 * like pickleball rally) `wouldWinGameWithPoint` is true for both sides, so this
 * returns false and the game-point display wins.
 */
export const isDeuceScore = (game: GameScore, cfg: RacquetConfig): boolean => {
  if (game.a !== game.b) return false;
  if (game.a < cfg.pointsPerGame - 1) return false;
  if (isGameWon(game, cfg)) return false;
  return (
    !wouldWinGameWithPoint(game, 'A', cfg) &&
    !wouldWinGameWithPoint(game, 'B', cfg)
  );
};

// ---------------------------------------------------------------------------
// Tennis family (tennis, padel) — the extra point tier inside each game.
// ---------------------------------------------------------------------------

/** Fallback tier if a 'tennis' preset omits `gameTier`: standard advantage scoring. */
const DEFAULT_GAME_TIER: TennisGameTier = { pointsToWin: 4, winBy: 2 };

export const gameTierOf = (cfg: RacquetConfig): TennisGameTier =>
  cfg.gameTier ?? DEFAULT_GAME_TIER;

/** True when the set standing calls for a tiebreak instead of another game. */
export const isTiebreakScore = (
  setScore: GameScore,
  cfg: RacquetConfig
): boolean => {
  const tb = cfg.tiebreak;
  if (!tb) return false;
  return setScore.a === tb.atGames && setScore.b === tb.atGames;
};

/**
 * Winner of a tennis GAME (the point tier), or null while it is still live.
 *
 * A tiebreak is scored numerically by its own thresholds; a normal game uses
 * the 0/15/30/40 ladder, where `winBy: 1` is padel's golden point / tennis's
 * no-ad — deuce is decided by a single rally rather than an advantage.
 */
export const tennisGameWinner = (
  points: GameScore,
  inTiebreak: boolean,
  cfg: RacquetConfig
): SideId | null => {
  const tier = inTiebreak
    ? (cfg.tiebreak ?? { pointsToWin: 7, winBy: 2 })
    : gameTierOf(cfg);
  const { a, b } = points;
  if (a >= tier.pointsToWin && a - b >= tier.winBy) return 'A';
  if (b >= tier.pointsToWin && b - a >= tier.winBy) return 'B';
  return null;
};

/** True if `side` winning the next rally would take the current tennis game. */
export const wouldWinTennisGame = (
  points: GameScore,
  side: SideId,
  inTiebreak: boolean,
  cfg: RacquetConfig
): boolean => {
  const next =
    side === 'A'
      ? { a: points.a + 1, b: points.b }
      : { a: points.a, b: points.b + 1 };
  return tennisGameWinner(next, inTiebreak, cfg) === side;
};

/**
 * Display label for a tennis point tally: 0 / 15 / 30 / 40 / AD, or the raw
 * number inside a tiebreak (where points are counted 1, 2, 3…).
 *
 * Past 40–40 the ladder has no more rungs, so advantage scoring collapses the
 * tail: the side ahead shows AD and the other 40, and a level score shows 40–40
 * however deep the deuce has run. Non-standard tiers (a `pointsToWin` other
 * than 4) fall back to raw counts rather than inventing rung names.
 */
export const pointLabel = (
  points: GameScore,
  side: SideId,
  inTiebreak: boolean,
  cfg: RacquetConfig
): string => {
  const mine = side === 'A' ? points.a : points.b;
  const theirs = side === 'A' ? points.b : points.a;
  if (inTiebreak) return String(mine);
  const tier = gameTierOf(cfg);
  if (tier.pointsToWin !== 4) return String(mine);
  const LADDER = ['0', '15', '30', '40'];
  if (mine < 3 || theirs < 3) return LADDER[Math.min(mine, 3)] ?? String(mine);
  // Both at 40 or beyond — the deuce tail.
  if (mine > theirs) return 'AD';
  return '40';
};

/**
 * Trim the most recent state-changing event so callers can re-reduce for a true undo.
 *
 * Recognized as "the last thing the operator did": point | game.end | score.correct.
 * Undoing a `score.correct` reverts the snapshot — without this, Undo after a
 * correction silently no-ops because the correction keeps stomping the trimmed
 * point's contribution on every replay.
 *
 * Pure: returns a new array.
 */
export const trimLastPointOrGameEnd = (
  events: RacquetEvent[]
): RacquetEvent[] => {
  for (let i = events.length - 1; i >= 0; i--) {
    const t = events[i]!.type;
    if (t === 'point' || t === 'game.end' || t === 'score.correct') {
      return [...events.slice(0, i), ...events.slice(i + 1)];
    }
  }
  return events;
};
