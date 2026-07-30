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
} from '../racquet-shared';
import {
  computeAlternatingServer,
  initialRacquetState,
  isGameWon,
  trimLastPointOrGameEnd,
  wouldWinGameWithPoint,
} from '../racquet-shared';

export function reduce(
  events: RacquetEvent[],
  cfg: RacquetConfig
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
  intervalSeen: Set<number>
): RacquetState {
  switch (ev.type) {
    case 'match.start':
      return {
        ...initialRacquetState(),
        servingSide: ev.serverSide,
        matchInitialServer: ev.serverSide,
        serverCourt: ev.serverCourt,
        names: state.names,
        // Both teams' slot-1 starts in their right service court (BWF default).
        partnerOnRight: { a: 1, b: 1 },
      };

    case 'team.rename':
      return {
        ...state,
        names: { ...state.names, [ev.side === 'A' ? 'a' : 'b']: ev.name },
      };

    case 'sides.swap':
      return { ...state, sidesSwapped: !state.sidesSwapped };

    case 'point':
      return applyPoint(state, ev.side, cfg, intervalSeen);

    case 'game.end':
      // Manual game-end (walkover etc). Forces a new empty game.
      if (state.matchOver) return state;
      return {
        ...state,
        games: [...state.games, { a: 0, b: 0 }],
        betweenGames: false,
      };

    case 'undo':
      // No-op here; undo is handled at the event-list level via applyUndo().
      return state;

    case 'walkover':
      return {
        ...state,
        matchOver: true,
        winner: ev.winner,
        endReason: 'walkover',
        betweenGames: false,
        isGamePoint: false,
        isMatchPoint: false,
        gamePoint: { a: false, b: false },
        matchPoint: { a: false, b: false },
      };

    case 'retirement': {
      // Retiring side loses; opponent wins.
      if (state.matchOver) return state;
      const winner: SideId = ev.retiring === 'A' ? 'B' : 'A';
      return {
        ...state,
        matchOver: true,
        winner,
        endReason: 'retirement',
        betweenGames: false,
        isGamePoint: false,
        isMatchPoint: false,
        gamePoint: { a: false, b: false },
        matchPoint: { a: false, b: false },
      };
    }

    case 'default': {
      if (state.matchOver) return state;
      const winner: SideId = ev.defaulted === 'A' ? 'B' : 'A';
      return {
        ...state,
        matchOver: true,
        winner,
        endReason: 'default',
        betweenGames: false,
        isGamePoint: false,
        isMatchPoint: false,
        gamePoint: { a: false, b: false },
        matchPoint: { a: false, b: false },
      };
    }

    case 'timeout.start':
      if (state.matchOver) return state;
      return { ...state, timeout: { side: ev.side, kind: ev.kind } };

    case 'timeout.end':
      return { ...state, timeout: null };

    case 'suspension.start':
      if (state.matchOver) return state;
      return { ...state, suspended: true };

    case 'suspension.end':
      return { ...state, suspended: false };

    case 'penalty': {
      if (state.matchOver) return state;
      const teamKey: 'a' | 'b' = ev.side === 'A' ? 'a' : 'b';
      const cards = {
        ...state.cards,
        [teamKey]: {
          ...state.cards[teamKey],
          [ev.card]: state.cards[teamKey][ev.card] + 1,
        },
      };
      if (ev.card === 'yellow') {
        return { ...state, cards };
      }
      if (ev.card === 'red') {
        // Award a point to the opponent — reuse applyPoint so game/match-win
        // logic, server changes, and partner rotation all stay correct.
        const opponent: SideId = ev.side === 'A' ? 'B' : 'A';
        const next = applyPoint(state, opponent, cfg, intervalSeen);
        return { ...next, cards };
      }
      // Black: disqualification — opponent wins immediately.
      const winner: SideId = ev.side === 'A' ? 'B' : 'A';
      return {
        ...state,
        cards,
        matchOver: true,
        winner,
        endReason: 'default',
        betweenGames: false,
        isGamePoint: false,
        isMatchPoint: false,
        gamePoint: { a: false, b: false },
        matchPoint: { a: false, b: false },
      };
    }

    case 'score.correct': {
      // Authoritative reset of scores. Recompute winner/over flags. A tied
      // gamesWon can never end a match (winner would be arbitrary) — treat a
      // fat-fingered tie at/above gamesToWin as an in-progress match so the
      // operator can correct it, rather than declaring the wrong winner.
      const matchOver =
        (ev.gamesWon.a >= cfg.gamesToWin || ev.gamesWon.b >= cfg.gamesToWin) &&
        ev.gamesWon.a !== ev.gamesWon.b;
      const nextGames = ev.games.length > 0 ? [...ev.games] : [{ a: 0, b: 0 }];
      // Recompute serverCourt from BWF parity: server's own score even → right,
      // odd → left. `applyPoint` keeps this in sync rally-by-rally; without
      // mirroring it here, a mid-game "reset to 0–0" leaves the server stuck on
      // the left court if the last rally happened to make their score odd.
      // partnerOnRight resets to {1,1} when the current game is back to 0–0
      // (start-of-game state) so doubles partner placement matches a fresh game.
      const cur = nextGames[nextGames.length - 1] ?? { a: 0, b: 0 };
      // For alternate-every-2 rules, the server is fully determined by the
      // score + per-game initial server, so a score correction must also
      // recompute it. For rally-winner rules, the operator's last known server
      // is the best we can do.
      const servingSide: SideId =
        cfg.serveRule === 'alternate-every-2'
          ? computeAlternatingServer(
              cur,
              nextGames.length - 1,
              state.matchInitialServer,
              cfg
            )
          : state.servingSide;
      const serverScore = servingSide === 'A' ? cur.a : cur.b;
      const serverCourt: 'right' | 'left' =
        serverScore % 2 === 0 ? 'right' : 'left';
      const atGameStart = cur.a === 0 && cur.b === 0;
      return {
        ...state,
        games: nextGames,
        gamesWon: { ...ev.gamesWon },
        servingSide,
        serverCourt,
        partnerOnRight: atGameStart ? { a: 1, b: 1 } : state.partnerOnRight,
        matchOver,
        winner: matchOver ? (ev.gamesWon.a > ev.gamesWon.b ? 'A' : 'B') : null,
        endReason: matchOver ? 'normal' : null,
        betweenGames: false,
        isGamePoint: false,
        isMatchPoint: false,
        gamePoint: { a: false, b: false },
        matchPoint: { a: false, b: false },
        atInterval: false,
      };
    }

    default:
      return state;
  }
}

function applyPoint(
  state: RacquetState,
  side: SideId,
  cfg: RacquetConfig,
  intervalSeen: Set<number>
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
    side === 'A' ? { a: cur.a + 1, b: cur.b } : { a: cur.a, b: cur.b + 1 };
  const newGames = [...working.games.slice(0, gameIdx), next];
  const winner = isGameWon(next, cfg);

  // Server depends on the configured rule. 'rally-winner' (badminton, pickleball,
  // tennis): the side that just scored serves next. 'alternate-every-2' (TT):
  // computed from combined score and the per-game initial server.
  const servingSide: SideId =
    cfg.serveRule === 'alternate-every-2'
      ? computeAlternatingServer(next, gameIdx, working.matchInitialServer, cfg)
      : side;
  const serverScore = servingSide === 'A' ? next.a : next.b;
  const serverCourt: 'right' | 'left' =
    serverScore % 2 === 0 ? 'right' : 'left';

  // BWF doubles partner tracking. If the rally was "won on serve" (the team that
  // was already serving scored), that team's two partners swap courts. Otherwise
  // the service shifts to the receiving team and nobody swaps — the partner who
  // happens to be in the appropriate score-parity court becomes the new server.
  const wonOnServe = working.servingSide === side;
  const teamKey: 'a' | 'b' = side === 'A' ? 'a' : 'b';
  const nextPartnerOnRight: RacquetState['partnerOnRight'] = wonOnServe
    ? {
        ...working.partnerOnRight,
        [teamKey]: working.partnerOnRight[teamKey] === 1 ? 2 : 1,
      }
    : working.partnerOnRight;

  // Interval flag fires once per game, the first time intervalAt is reached.
  const reachedInterval =
    cfg.intervalAt !== null &&
    !intervalSeen.has(gameIdx) &&
    (next.a === cfg.intervalAt || next.b === cfg.intervalAt);
  if (reachedInterval) intervalSeen.add(gameIdx);

  if (winner) {
    const gamesWon = {
      a: working.gamesWon.a + (winner === 'A' ? 1 : 0),
      b: working.gamesWon.b + (winner === 'B' ? 1 : 0),
    };
    const matchOver =
      gamesWon.a >= cfg.gamesToWin || gamesWon.b >= cfg.gamesToWin;
    // For 'alternate-every-2' and a non-final game, surface the next game's
    // initial server immediately so the between-games display is correct.
    const nextGameIdx = newGames.length; // the upcoming, not-yet-created game
    const servingSideAfterGame: SideId =
      cfg.serveRule === 'alternate-every-2' && !matchOver
        ? computeAlternatingServer(
            { a: 0, b: 0 },
            nextGameIdx,
            working.matchInitialServer,
            cfg
          )
        : servingSide;
    return {
      ...working,
      games: newGames,
      gamesWon,
      servingSide: servingSideAfterGame,
      serverCourt,
      // BWF: each new game starts with both teams' slot-1 in the right court.
      // (Match-over keeps last positions for the audience-facing surfaces.)
      partnerOnRight: matchOver ? nextPartnerOnRight : { a: 1, b: 1 },
      betweenGames: !matchOver,
      matchOver,
      winner: matchOver ? (gamesWon.a > gamesWon.b ? 'A' : 'B') : null,
      atInterval: false,
      isGamePoint: false,
      isMatchPoint: false,
      gamePoint: { a: false, b: false },
      matchPoint: { a: false, b: false },
    };
  }

  const aWouldWinGame = wouldWinGameWithPoint(next, 'A', cfg);
  const bWouldWinGame = wouldWinGameWithPoint(next, 'B', cfg);
  const aWouldWinMatch =
    aWouldWinGame && working.gamesWon.a + 1 >= cfg.gamesToWin;
  const bWouldWinMatch =
    bWouldWinGame && working.gamesWon.b + 1 >= cfg.gamesToWin;

  return {
    ...working,
    games: newGames,
    servingSide,
    serverCourt,
    partnerOnRight: nextPartnerOnRight,
    atInterval: reachedInterval,
    isGamePoint: aWouldWinGame || bWouldWinGame,
    isMatchPoint: aWouldWinMatch || bWouldWinMatch,
    gamePoint: { a: aWouldWinGame, b: bWouldWinGame },
    matchPoint: { a: aWouldWinMatch, b: bWouldWinMatch },
  };
}

/** Returns the event list with the most recent point/game.end removed (true undo). */
export const applyUndo = trimLastPointOrGameEnd;
