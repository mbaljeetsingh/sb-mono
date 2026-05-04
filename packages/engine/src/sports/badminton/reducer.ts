// Badminton scoring engine — BWF rules.
//
// - Rally scoring: every rally awards a point.
// - Game won at pointsPerGame with margin of winBy, capped at cap (21 / 2 / 30).
// - Server is whoever won the last rally.
// - Server court: right when server's score is even, left when odd.
// - Interval flagged the first time `intervalAt` is reached in a game (BWF: 11).
// - Match: first to gamesToWin games (BWF: 2 of 3).
// - When a point arrives between games, the next game auto-starts.

import type {
  GameScore,
  RacquetConfig,
  RacquetEvent,
  RacquetState,
  SideId,
} from "../racquet-shared";
import {
  initialRacquetState,
  isGameWon,
  trimLastPointOrGameEnd,
  wouldWinGameWithPoint,
} from "../racquet-shared";

export function reduce(
  events: RacquetEvent[],
  cfg: RacquetConfig,
): RacquetState {
  let state = initialRacquetState();
  const intervalSeen = new Set<number>();

  for (const ev of events) {
    state = applyEvent(state, ev, cfg, intervalSeen);
  }
  return state;
}

function applyEvent(
  state: RacquetState,
  ev: RacquetEvent,
  cfg: RacquetConfig,
  intervalSeen: Set<number>,
): RacquetState {
  switch (ev.type) {
    case "match.start":
      return {
        ...initialRacquetState(),
        servingSide: ev.serverSide,
        serverCourt: ev.serverCourt,
        names: state.names,
      };

    case "team.rename":
      return {
        ...state,
        names: { ...state.names, [ev.side === "A" ? "a" : "b"]: ev.name },
      };

    case "sides.swap":
      return { ...state, sidesSwapped: !state.sidesSwapped };

    case "point":
      return applyPoint(state, ev.side, cfg, intervalSeen);

    case "game.end":
      // Manual game-end (walkover etc). Forces a new empty game.
      if (state.matchOver) return state;
      return {
        ...state,
        games: [...state.games, { a: 0, b: 0 }],
        betweenGames: false,
      };

    case "undo":
      // No-op here; undo is handled at the event-list level via applyUndo().
      return state;

    default:
      return state;
  }
}

function applyPoint(
  state: RacquetState,
  side: SideId,
  cfg: RacquetConfig,
  intervalSeen: Set<number>,
): RacquetState {
  if (state.matchOver) return state;

  // Auto-start a new game if the previous one just ended.
  let working = state;
  if (state.betweenGames) {
    working = {
      ...state,
      games: [...state.games, { a: 0, b: 0 }],
      betweenGames: false,
    };
  }

  const gameIdx = working.games.length - 1;
  const cur = working.games[gameIdx]!;
  const next: GameScore =
    side === "A" ? { a: cur.a + 1, b: cur.b } : { a: cur.a, b: cur.b + 1 };
  const newGames = [...working.games.slice(0, gameIdx), next];
  const winner = isGameWon(next, cfg);

  // Server = whoever won the rally. Court = right if server's own score is even.
  const servingSide: SideId = side;
  const serverScore = side === "A" ? next.a : next.b;
  const serverCourt: "right" | "left" =
    serverScore % 2 === 0 ? "right" : "left";

  // Interval flag fires once per game, the first time intervalAt is reached.
  const reachedInterval =
    cfg.intervalAt !== null &&
    !intervalSeen.has(gameIdx) &&
    (next.a === cfg.intervalAt || next.b === cfg.intervalAt);
  if (reachedInterval) intervalSeen.add(gameIdx);

  if (winner) {
    const gamesWon = {
      a: working.gamesWon.a + (winner === "A" ? 1 : 0),
      b: working.gamesWon.b + (winner === "B" ? 1 : 0),
    };
    const matchOver =
      gamesWon.a >= cfg.gamesToWin || gamesWon.b >= cfg.gamesToWin;
    return {
      ...working,
      games: newGames,
      gamesWon,
      servingSide,
      serverCourt,
      betweenGames: !matchOver,
      matchOver,
      winner: matchOver ? (gamesWon.a > gamesWon.b ? "A" : "B") : null,
      atInterval: false,
      isGamePoint: false,
      isMatchPoint: false,
    };
  }

  const aWouldWinGame = wouldWinGameWithPoint(next, "A", cfg);
  const bWouldWinGame = wouldWinGameWithPoint(next, "B", cfg);
  const isGamePoint = aWouldWinGame || bWouldWinGame;
  const aWouldWinMatch =
    aWouldWinGame && working.gamesWon.a + 1 >= cfg.gamesToWin;
  const bWouldWinMatch =
    bWouldWinGame && working.gamesWon.b + 1 >= cfg.gamesToWin;

  return {
    ...working,
    games: newGames,
    servingSide,
    serverCourt,
    atInterval: reachedInterval,
    isGamePoint,
    isMatchPoint: aWouldWinMatch || bWouldWinMatch,
  };
}

/** Returns the event list with the most recent point/game.end removed (true undo). */
export const applyUndo = trimLastPointOrGameEnd;
