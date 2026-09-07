// Racquet-family scoring engine. Named for badminton because that is the
// ruleset it started as and still the default, but it now drives every preset
// in the registry through `cfg.scoring`:
//
//   'rally'    — badminton (BWF) and table tennis, plus pickleball's rally
//                variant. Every rally awards a point to its winner.
//   'side-out' — official pickleball. Only the serving side scores; the
//                receiving side winning a rally wins the SERVE instead.
//   'tennis'   — tennis and padel. Rallies win points (0/15/30/40), points win
//                games, games win sets, with a tiebreak at 6-all.
//
// Shared across all three:
// - Game won at pointsPerGame with margin of winBy, capped at cap (21 / 2 / 30).
//   Under 'tennis' those describe the SET and the point tier lives in `gameTier`.
// - Interval flagged the first time `intervalAt` is reached in a game (BWF: 11).
// - Match: first to gamesToWin games — sets under 'tennis' (BWF: 2 of 3).
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
  gameTierOf,
  initialRacquetState,
  isDeuceScore,
  isGameWon,
  isTiebreakScore,
  other,
  tennisGameWinner,
  trimLastPointOrGameEnd,
  wouldWinGameWithPoint,
  wouldWinTennisGame,
} from '../racquet-shared';

export function reduce(
  events: RacquetEvent[],
  cfg: RacquetConfig
): RacquetState {
  let state = openingState(cfg);
  const intervalSeen = new Set<number>();

  for (const ev of events) {
    state = applyEvent(state, ev, cfg, intervalSeen);
  }
  return state;
}

const key = (side: SideId): 'a' | 'b' => (side === 'A' ? 'a' : 'b');

/** Slot standing in `court` for `team`, from the BWF position flag. */
const slotInCourt = (
  partnerOnRight: RacquetState['partnerOnRight'],
  team: SideId,
  court: 'left' | 'right'
): 1 | 2 => {
  const onRight = partnerOnRight[key(team)];
  return court === 'right' ? onRight : onRight === 1 ? 2 : 1;
};

/**
 * Fresh state at 0–0, before any event. Side-out doubles opens on "0–0–2": the
 * team serving first gets a single server, so one fault ends their turn. That
 * is a call-out convention, not a position — the player on the right still
 * serves — so `serverCourt`/`serverSlot` stay at the first server's spot.
 */
const openingState = (cfg: RacquetConfig): RacquetState => {
  const base = initialRacquetState();
  if (cfg.scoring !== 'side-out' || !cfg.doubles) return base;
  return { ...base, serverNumber: 2 };
};

function applyEvent(
  state: RacquetState,
  ev: RacquetEvent,
  cfg: RacquetConfig,
  intervalSeen: Set<number>
): RacquetState {
  switch (ev.type) {
    case 'match.start':
      return {
        ...openingState(cfg),
        servingSide: ev.serverSide,
        matchInitialServer: ev.serverSide,
        serverCourt: ev.serverCourt,
        names: state.names,
        // Both teams' slot-1 starts in their right service court (BWF default).
        partnerOnRight: { a: 1, b: 1 },
        serverSlot: 1,
      };

    case 'team.rename':
      return {
        ...state,
        names: { ...state.names, [key(ev.side)]: ev.name },
      };

    case 'sides.swap':
      return { ...state, sidesSwapped: !state.sidesSwapped };

    case 'point':
      return applyPoint(state, ev.side, cfg, intervalSeen);

    case 'game.end': {
      // Manual game-end (walkover etc). Forces a new empty game.
      if (state.matchOver) return state;
      const opening = openingState(cfg);
      return {
        ...state,
        games: [...state.games, { a: 0, b: 0 }],
        betweenGames: false,
        // The new game starts 0–0, so any game/match-point or interval flag
        // from the game just ended is stale. Without clearing, a manual
        // game-end at 20–5 kept "GAME PT" on the leader at 0–0.
        isGamePoint: false,
        isMatchPoint: false,
        gamePoint: { a: false, b: false },
        matchPoint: { a: false, b: false },
        setPoint: { a: false, b: false },
        isDeuce: false,
        atInterval: false,
        points: { a: 0, b: 0 },
        inTiebreak: false,
        serverNumber: opening.serverNumber,
        // BWF Law 9.1.1: service at an even score — 0 included — is from the
        // right court. serverCourt still holds the parity of the FINISHED
        // game's final rally, so any game won on an odd score (21-19, 15-9)
        // otherwise opened the next game with the server shown on the left.
        serverCourt: 'right',
      };
    }

    case 'undo':
      // No-op here; undo is handled at the event-list level via applyUndo().
      return state;

    case 'walkover':
      // First terminal event wins, like every other ending below. Without this
      // a stray second walkover could reassign `winner` on an already-decided
      // match — and because the log is replayed from scratch on every device,
      // a duplicate that reached Supabase would flip the result everywhere.
      if (state.matchOver) return state;
      return { ...state, ...endedBy('walkover', ev.winner) };

    case 'retirement': {
      // Retiring side loses; opponent wins.
      if (state.matchOver) return state;
      return { ...state, ...endedBy('retirement', other(ev.retiring)) };
    }

    case 'default': {
      if (state.matchOver) return state;
      return { ...state, ...endedBy('default', other(ev.defaulted)) };
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
      const teamKey = key(ev.side);
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
        //
        // Under side-out scoring a rally win by the receiving side does NOT
        // score, so routing the card through applyPoint would silently turn a
        // red card into a side-out. A fault penalty has to be a point, so the
        // opponent's tally is credited directly there.
        const opponent = other(ev.side);
        const next =
          cfg.scoring === 'side-out'
            ? awardSideOutPenaltyPoint(state, opponent, cfg)
            : applyPoint(state, opponent, cfg, intervalSeen);
        return { ...next, cards };
      }
      // Black: disqualification — opponent wins immediately.
      return { ...state, cards, ...endedBy('default', other(ev.side)) };
    }

    case 'score.correct':
      return applyCorrection(state, ev, cfg);

    default:
      return state;
  }
}

/** Shared shape for every terminal event: freeze the match on a winner. */
const endedBy = (
  endReason: NonNullable<RacquetState['endReason']>,
  winner: SideId
) =>
  ({
    matchOver: true,
    winner,
    endReason,
    betweenGames: false,
    isGamePoint: false,
    isMatchPoint: false,
    gamePoint: { a: false, b: false },
    matchPoint: { a: false, b: false },
    setPoint: { a: false, b: false },
    isDeuce: false,
  }) satisfies Partial<RacquetState>;

// ---------------------------------------------------------------------------
// Points
// ---------------------------------------------------------------------------

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

  if (cfg.scoring === 'tennis') return applyTennisPoint(working, side, cfg);
  if (cfg.scoring === 'side-out') return applySideOutPoint(working, side, cfg);
  return applyRallyPoint(working, side, cfg, intervalSeen);
}

/**
 * Rally scoring — badminton, table tennis, pickleball's rally variant. Every
 * rally awards a point to its winner.
 */
function applyRallyPoint(
  working: RacquetState,
  side: SideId,
  cfg: RacquetConfig,
  intervalSeen: Set<number>
): RacquetState {
  const gameIdx = working.games.length - 1;
  const cur = working.games[gameIdx]!;
  const next: GameScore =
    side === 'A' ? { a: cur.a + 1, b: cur.b } : { a: cur.a, b: cur.b + 1 };
  const newGames = [...working.games.slice(0, gameIdx), next];
  const winner = isGameWon(next, cfg);

  // Server depends on the configured rule. 'rally-winner' (badminton): the side
  // that just scored serves next. 'alternate' (TT): computed from combined
  // score and the per-game initial server.
  const servingSide: SideId =
    cfg.serveRule === 'alternate'
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
  const nextPartnerOnRight = rotatePartners(working, side, wonOnServe, cfg);

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
    // For 'alternate' and a non-final game, surface the next game's initial
    // server immediately so the between-games display is correct.
    const nextGameIdx = newGames.length; // the upcoming, not-yet-created game
    const servingSideAfterGame: SideId =
      cfg.serveRule === 'alternate' && !matchOver
        ? computeAlternatingServer(
            { a: 0, b: 0 },
            nextGameIdx,
            working.matchInitialServer,
            cfg
          )
        : servingSide;
    const partnerAfter = matchOver
      ? nextPartnerOnRight
      : ({ a: 1, b: 1 } as RacquetState['partnerOnRight']);
    const courtAfter = matchOver ? serverCourt : 'right';
    return {
      ...working,
      games: newGames,
      gamesWon,
      servingSide: servingSideAfterGame,
      // Between games the meaningful server display is the NEXT game's opening
      // state: score 0 → right court (Law 9.1.1), matching servingSideAfterGame
      // and the partner reset below. Keeping the finished game's parity here
      // put the opening server in the left court whenever the game was won on
      // an odd score. Match over freezes the final rally as played — there is
      // no next game to anchor to.
      serverCourt: courtAfter,
      // BWF: each new game starts with both teams' slot-1 in the right court.
      // (Match-over keeps last positions for the audience-facing surfaces.)
      partnerOnRight: partnerAfter,
      serverSlot: slotInCourt(partnerAfter, servingSideAfterGame, courtAfter),
      betweenGames: !matchOver,
      matchOver,
      winner: matchOver ? (gamesWon.a > gamesWon.b ? 'A' : 'B') : null,
      atInterval: false,
      isGamePoint: false,
      isMatchPoint: false,
      gamePoint: { a: false, b: false },
      matchPoint: { a: false, b: false },
      setPoint: { a: false, b: false },
      isDeuce: false,
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
    serverSlot: slotInCourt(nextPartnerOnRight, servingSide, serverCourt),
    atInterval: reachedInterval,
    isGamePoint: aWouldWinGame || bWouldWinGame,
    isMatchPoint: aWouldWinMatch || bWouldWinMatch,
    gamePoint: { a: aWouldWinGame, b: bWouldWinGame },
    matchPoint: { a: aWouldWinMatch, b: bWouldWinMatch },
    setPoint: { a: false, b: false },
    isDeuce: isDeuceScore(next, cfg),
  };
}

/**
 * Partner court rotation. 'serve-swap' (default — BWF Law 8, and the same rule
 * in pickleball) swaps the scoring team's two players each time they score on
 * their own serve. 'fixed' (tennis, padel) holds partners in their halves for
 * the whole set, so the flag never moves and `serverSlot` carries the server.
 */
function rotatePartners(
  working: RacquetState,
  side: SideId,
  wonOnServe: boolean,
  cfg: RacquetConfig
): RacquetState['partnerOnRight'] {
  if ((cfg.partnerRotation ?? 'serve-swap') === 'fixed') {
    return working.partnerOnRight;
  }
  if (!wonOnServe) return working.partnerOnRight;
  const teamKey = key(side);
  return {
    ...working.partnerOnRight,
    [teamKey]: working.partnerOnRight[teamKey] === 1 ? 2 : 1,
  };
}

/**
 * Side-out scoring — official pickleball. Only the serving side scores.
 *
 * Serving side wins the rally: a point, and the two partners switch courts, so
 * the SAME player serves again from the other side (which keeps `serverCourt`
 * in step with the team's score parity — even is right).
 *
 * Serving side loses the rally: no point. In doubles the serve passes to the
 * partner (server 1 → 2) who serves from where they already stand; on the
 * second fault, or always in singles, it is a side-out to the opponents, whose
 * first server is the player in the court their own score parity dictates.
 */
function applySideOutPoint(
  working: RacquetState,
  side: SideId,
  cfg: RacquetConfig
): RacquetState {
  const gameIdx = working.games.length - 1;
  const cur = working.games[gameIdx]!;
  const serving = working.servingSide;
  const isDoubles = !!cfg.doubles;

  if (side !== serving) {
    // Rally to the receivers — the serve moves, the score does not.
    if (isDoubles && working.serverNumber === 1) {
      const nextCourt = working.serverCourt === 'right' ? 'left' : 'right';
      return {
        ...working,
        serverNumber: 2,
        serverCourt: nextCourt,
        serverSlot: slotInCourt(working.partnerOnRight, serving, nextCourt),
        ...sideOutFlags(cur, serving, working, cfg),
      };
    }
    const nextServing = other(serving);
    const theirScore = nextServing === 'A' ? cur.a : cur.b;
    const nextCourt: 'right' | 'left' = theirScore % 2 === 0 ? 'right' : 'left';
    return {
      ...working,
      servingSide: nextServing,
      serverNumber: 1,
      serverCourt: nextCourt,
      serverSlot: slotInCourt(working.partnerOnRight, nextServing, nextCourt),
      // Game point belongs to whoever holds the serve, so it moves with it: a
      // team parked on 10 stops being a point from the game the moment they
      // hand the serve over, and can't take it back until they earn it again.
      ...sideOutFlags(cur, nextServing, working, cfg),
    };
  }

  const next: GameScore =
    side === 'A' ? { a: cur.a + 1, b: cur.b } : { a: cur.a, b: cur.b + 1 };
  const newGames = [...working.games.slice(0, gameIdx), next];
  const winner = isGameWon(next, cfg);
  const nextPartnerOnRight = rotatePartners(working, side, true, cfg);
  // The server moved across with their partner, so they are now in the other
  // court — which is exactly the parity of their team's new score.
  const serverCourt: 'right' | 'left' =
    working.serverCourt === 'right' ? 'left' : 'right';

  if (winner) {
    const gamesWon = {
      a: working.gamesWon.a + (winner === 'A' ? 1 : 0),
      b: working.gamesWon.b + (winner === 'B' ? 1 : 0),
    };
    const matchOver =
      gamesWon.a >= cfg.gamesToWin || gamesWon.b >= cfg.gamesToWin;
    const partnerAfter = matchOver
      ? nextPartnerOnRight
      : ({ a: 1, b: 1 } as RacquetState['partnerOnRight']);
    return {
      ...working,
      games: newGames,
      gamesWon,
      partnerOnRight: partnerAfter,
      serverCourt: matchOver ? serverCourt : 'right',
      // A new game re-opens on the "0–0–2" convention for whoever serves it.
      serverNumber: matchOver ? working.serverNumber : isDoubles ? 2 : 1,
      serverSlot: matchOver ? working.serverSlot : 1,
      betweenGames: !matchOver,
      matchOver,
      winner: matchOver ? (gamesWon.a > gamesWon.b ? 'A' : 'B') : null,
      atInterval: false,
      isGamePoint: false,
      isMatchPoint: false,
      gamePoint: { a: false, b: false },
      matchPoint: { a: false, b: false },
      setPoint: { a: false, b: false },
      isDeuce: false,
    };
  }

  return {
    ...working,
    games: newGames,
    partnerOnRight: nextPartnerOnRight,
    serverCourt,
    serverSlot: slotInCourt(nextPartnerOnRight, side, serverCourt),
    atInterval: false,
    ...sideOutFlags(next, side, working, cfg),
  };
}

/**
 * Game / match point under side-out scoring, which only the side holding the
 * serve can be on — a receiver sitting on 10 in an 11-point game has to win the
 * serve back before that 11th point is even available to them. Rally scoring's
 * symmetric "either side is a point away" is wrong here.
 */
function sideOutFlags(
  score: GameScore,
  servingSide: SideId,
  working: RacquetState,
  cfg: RacquetConfig
): Pick<
  RacquetState,
  | 'isGamePoint'
  | 'isMatchPoint'
  | 'gamePoint'
  | 'matchPoint'
  | 'setPoint'
  | 'isDeuce'
> {
  const wouldWin = wouldWinGameWithPoint(score, servingSide, cfg);
  const wouldWinMatch =
    wouldWin && working.gamesWon[key(servingSide)] + 1 >= cfg.gamesToWin;
  const flag = (v: boolean) => ({
    a: servingSide === 'A' && v,
    b: servingSide === 'B' && v,
  });
  return {
    isGamePoint: wouldWin,
    isMatchPoint: wouldWinMatch,
    gamePoint: flag(wouldWin),
    matchPoint: flag(wouldWinMatch),
    setPoint: { a: false, b: false },
    isDeuce: isDeuceScore(score, cfg),
  };
}

/**
 * A red card under side-out scoring. `applyPoint` would read the opponent as
 * the rally winner and produce a side-out instead of a point, so the tally is
 * credited directly and the serve stays with whoever held it.
 *
 * When the beneficiary IS the serving side the point has to move them exactly
 * as a won rally would — partners swap and the server crosses to the other
 * court. `serverCourt` is maintained transitionally rather than re-derived, so
 * crediting the point without that step left it one step behind the team's
 * score parity, and `applySideOutPoint` then flipped it relative to the stale
 * value on every later rally: the serve pill sat on the wrong player, in the
 * wrong court, for the rest of the game.
 */
function awardSideOutPenaltyPoint(
  state: RacquetState,
  beneficiary: SideId,
  cfg: RacquetConfig
): RacquetState {
  const gameIdx = state.games.length - 1;
  const cur = state.games[gameIdx]!;
  const next: GameScore =
    beneficiary === 'A'
      ? { a: cur.a + 1, b: cur.b }
      : { a: cur.a, b: cur.b + 1 };
  const newGames = [...state.games.slice(0, gameIdx), next];
  const winner = isGameWon(next, cfg);
  // Only the serving side's own positions are touched by their point; a point
  // handed to the receivers changes nobody's court.
  const scoredOnServe = state.servingSide === beneficiary;
  const partnerAfterPoint = scoredOnServe
    ? rotatePartners(state, beneficiary, true, cfg)
    : state.partnerOnRight;
  const courtAfterPoint: 'right' | 'left' = scoredOnServe
    ? state.serverCourt === 'right'
      ? 'left'
      : 'right'
    : state.serverCourt;
  if (!winner) {
    const wouldWin = wouldWinGameWithPoint(next, beneficiary, cfg);
    const wouldWinMatch =
      wouldWin && state.gamesWon[key(beneficiary)] + 1 >= cfg.gamesToWin;
    const flag = (v: boolean) => ({
      a: beneficiary === 'A' && v,
      b: beneficiary === 'B' && v,
    });
    return {
      ...state,
      games: newGames,
      partnerOnRight: partnerAfterPoint,
      serverCourt: courtAfterPoint,
      serverSlot: slotInCourt(
        partnerAfterPoint,
        state.servingSide,
        courtAfterPoint
      ),
      isGamePoint: wouldWin,
      isMatchPoint: wouldWinMatch,
      gamePoint: flag(wouldWin),
      matchPoint: flag(wouldWinMatch),
      isDeuce: isDeuceScore(next, cfg),
    };
  }
  const gamesWon = {
    a: state.gamesWon.a + (winner === 'A' ? 1 : 0),
    b: state.gamesWon.b + (winner === 'B' ? 1 : 0),
  };
  const matchOver =
    gamesWon.a >= cfg.gamesToWin || gamesWon.b >= cfg.gamesToWin;
  return {
    ...state,
    games: newGames,
    gamesWon,
    betweenGames: !matchOver,
    matchOver,
    winner: matchOver ? (gamesWon.a > gamesWon.b ? 'A' : 'B') : null,
    serverNumber: matchOver ? state.serverNumber : cfg.doubles ? 2 : 1,
    serverCourt: matchOver ? courtAfterPoint : 'right',
    partnerOnRight: matchOver ? partnerAfterPoint : { a: 1, b: 1 },
    serverSlot: matchOver ? state.serverSlot : 1,
    isGamePoint: false,
    isMatchPoint: false,
    gamePoint: { a: false, b: false },
    matchPoint: { a: false, b: false },
    setPoint: { a: false, b: false },
    isDeuce: false,
  };
}

// ---------------------------------------------------------------------------
// Tennis / padel — the point tier inside each game
// ---------------------------------------------------------------------------

/** Games completed in the match so far, across every set. */
const gamesPlayed = (games: GameScore[]): number =>
  games.reduce((n, g) => n + g.a + g.b, 0);

/** Service turns `team` has taken before game index `g` of the match. */
const priorServiceTurns = (
  team: SideId,
  g: number,
  matchInitialServer: SideId
): number =>
  team === matchInitialServer ? Math.ceil(g / 2) : Math.floor(g / 2);

/**
 * Who serves game `g` of the match, and which of their two players.
 *
 * Serve alternates every game, and inside a team the two partners alternate
 * their own service games — so the doubles order runs A1, B1, A2, B2, A1, …
 * A tiebreak counts as one game, which is what makes the first game of the
 * next set fall to whoever received first in it.
 */
const serverForGame = (
  g: number,
  matchInitialServer: SideId
): { side: SideId; slot: 1 | 2 } => {
  const side = g % 2 === 0 ? matchInitialServer : other(matchInitialServer);
  const turns = priorServiceTurns(side, g, matchInitialServer);
  return { side, slot: turns % 2 === 0 ? 1 : 2 };
};

/**
 * Who serves the rally at `pointsPlayed` of a tiebreak that is game `g`.
 *
 * The player due to serve takes one point, and service alternates every two
 * points after that — so turn index is `floor((p + 1) / 2)`, and the partners
 * of each team keep alternating across those turns as they would across games.
 */
const serverInTiebreak = (
  pointsPlayed: number,
  g: number,
  matchInitialServer: SideId
): { side: SideId; slot: 1 | 2 } => {
  const opener = g % 2 === 0 ? matchInitialServer : other(matchInitialServer);
  const turn = Math.floor((pointsPlayed + 1) / 2);
  const side = turn % 2 === 0 ? opener : other(opener);
  const turns =
    priorServiceTurns(side, g, matchInitialServer) + Math.floor(turn / 2);
  return { side, slot: turns % 2 === 0 ? 1 : 2 };
};

/** Deuce/ad court: the first rally of every game and tiebreak is served from
 * the right, and the court alternates with each rally after it. */
const courtForPoints = (points: GameScore): 'right' | 'left' =>
  (points.a + points.b) % 2 === 0 ? 'right' : 'left';

function applyTennisPoint(
  working: RacquetState,
  side: SideId,
  cfg: RacquetConfig
): RacquetState {
  const setIdx = working.games.length - 1;
  const curSet = working.games[setIdx]!;
  const nextPoints: GameScore =
    side === 'A'
      ? { a: working.points.a + 1, b: working.points.b }
      : { a: working.points.a, b: working.points.b + 1 };

  const gameWinner = tennisGameWinner(nextPoints, working.inTiebreak, cfg);

  if (!gameWinner) {
    const g = gamesPlayed(working.games);
    const server = working.inTiebreak
      ? serverInTiebreak(
          nextPoints.a + nextPoints.b,
          g,
          working.matchInitialServer
        )
      : serverForGame(g, working.matchInitialServer);
    return {
      ...working,
      points: nextPoints,
      servingSide: server.side,
      serverSlot: server.slot,
      serverCourt: courtForPoints(nextPoints),
      atInterval: false,
      ...tennisPointFlags(nextPoints, curSet, working, cfg),
    };
  }

  // Game over — credit it to the set.
  const nextSet: GameScore =
    gameWinner === 'A'
      ? { a: curSet.a + 1, b: curSet.b }
      : { a: curSet.a, b: curSet.b + 1 };
  const newGames = [...working.games.slice(0, setIdx), nextSet];
  const setWinner = isGameWon(nextSet, cfg);

  if (setWinner) {
    const gamesWon = {
      a: working.gamesWon.a + (setWinner === 'A' ? 1 : 0),
      b: working.gamesWon.b + (setWinner === 'B' ? 1 : 0),
    };
    const matchOver =
      gamesWon.a >= cfg.gamesToWin || gamesWon.b >= cfg.gamesToWin;
    const nextServer = serverForGame(
      gamesPlayed(newGames),
      working.matchInitialServer
    );
    return {
      ...working,
      games: newGames,
      gamesWon,
      points: { a: 0, b: 0 },
      inTiebreak: false,
      servingSide: matchOver ? working.servingSide : nextServer.side,
      serverSlot: matchOver ? working.serverSlot : nextServer.slot,
      serverCourt: matchOver ? working.serverCourt : 'right',
      betweenGames: !matchOver,
      matchOver,
      winner: matchOver ? (gamesWon.a > gamesWon.b ? 'A' : 'B') : null,
      atInterval: false,
      isGamePoint: false,
      isMatchPoint: false,
      gamePoint: { a: false, b: false },
      matchPoint: { a: false, b: false },
      setPoint: { a: false, b: false },
      isDeuce: false,
    };
  }

  const nextServer = serverForGame(
    gamesPlayed(newGames),
    working.matchInitialServer
  );
  return {
    ...working,
    games: newGames,
    points: { a: 0, b: 0 },
    inTiebreak: isTiebreakScore(nextSet, cfg),
    servingSide: nextServer.side,
    serverSlot: nextServer.slot,
    serverCourt: 'right',
    atInterval: false,
    isGamePoint: false,
    isMatchPoint: false,
    gamePoint: { a: false, b: false },
    matchPoint: { a: false, b: false },
    setPoint: { a: false, b: false },
    isDeuce: false,
  };
}

/**
 * Game / set / match point for the tennis tiers, which nest: a side at set
 * point is at game point too, and at match point only if that set takes the
 * match. Deuce is 40–40 under advantage scoring; with a golden point the next
 * rally settles it, so both sides read as game point instead.
 */
function tennisPointFlags(
  points: GameScore,
  curSet: GameScore,
  working: RacquetState,
  cfg: RacquetConfig
): Pick<
  RacquetState,
  | 'isGamePoint'
  | 'isMatchPoint'
  | 'gamePoint'
  | 'matchPoint'
  | 'setPoint'
  | 'isDeuce'
> {
  const inTb = working.inTiebreak;
  const gp = {
    a: wouldWinTennisGame(points, 'A', inTb, cfg),
    b: wouldWinTennisGame(points, 'B', inTb, cfg),
  };
  const sp = {
    a: gp.a && wouldWinGameWithPoint(curSet, 'A', cfg),
    b: gp.b && wouldWinGameWithPoint(curSet, 'B', cfg),
  };
  const mp = {
    a: sp.a && working.gamesWon.a + 1 >= cfg.gamesToWin,
    b: sp.b && working.gamesWon.b + 1 >= cfg.gamesToWin,
  };
  const tier = gameTierOf(cfg);
  const threshold = inTb
    ? (cfg.tiebreak?.pointsToWin ?? 7) - 1
    : tier.pointsToWin - 1;
  const isDeuce =
    points.a === points.b && points.a >= threshold && !gp.a && !gp.b;
  return {
    isGamePoint: gp.a || gp.b,
    isMatchPoint: mp.a || mp.b,
    gamePoint: gp,
    matchPoint: mp,
    setPoint: sp,
    isDeuce,
  };
}

// ---------------------------------------------------------------------------
// Manual score correction
// ---------------------------------------------------------------------------

function applyCorrection(
  state: RacquetState,
  ev: Extract<RacquetEvent, { type: 'score.correct' }>,
  cfg: RacquetConfig
): RacquetState {
  // Authoritative reset of scores. Recompute winner/over flags. A tied
  // gamesWon can never end a match (winner would be arbitrary) — treat a
  // fat-fingered tie at/above gamesToWin as an in-progress match so the
  // operator can correct it, rather than declaring the wrong winner.
  const matchOver =
    (ev.gamesWon.a >= cfg.gamesToWin || ev.gamesWon.b >= cfg.gamesToWin) &&
    ev.gamesWon.a !== ev.gamesWon.b;
  const nextGames = ev.games.length > 0 ? [...ev.games] : [{ a: 0, b: 0 }];
  const cur = nextGames[nextGames.length - 1] ?? { a: 0, b: 0 };
  const atGameStart = cur.a === 0 && cur.b === 0;

  if (cfg.scoring === 'tennis') {
    // Sets and games come from the sheet; the point tier resets unless the
    // caller sent one, since a correction is usually "we mis-scored a game".
    const points = ev.points ?? { a: 0, b: 0 };
    const inTiebreak = !matchOver && isTiebreakScore(cur, cfg);
    const server = serverForGame(
      gamesPlayed(nextGames),
      state.matchInitialServer
    );
    const flags = matchOver
      ? {
          isGamePoint: false,
          isMatchPoint: false,
          gamePoint: { a: false, b: false },
          matchPoint: { a: false, b: false },
          setPoint: { a: false, b: false },
          isDeuce: false,
        }
      : tennisPointFlags(
          points,
          cur,
          { ...state, gamesWon: ev.gamesWon, inTiebreak },
          cfg
        );
    return {
      ...state,
      games: nextGames,
      gamesWon: { ...ev.gamesWon },
      points,
      inTiebreak,
      servingSide: server.side,
      serverSlot: server.slot,
      serverCourt: courtForPoints(points),
      partnerOnRight: state.partnerOnRight,
      matchOver,
      winner: matchOver ? (ev.gamesWon.a > ev.gamesWon.b ? 'A' : 'B') : null,
      endReason: matchOver ? 'normal' : null,
      betweenGames: false,
      atInterval: false,
      ...flags,
    };
  }

  // Recompute serverCourt from BWF parity: server's own score even → right,
  // odd → left. `applyPoint` keeps this in sync rally-by-rally; without
  // mirroring it here, a mid-game "reset to 0–0" leaves the server stuck on
  // the left court if the last rally happened to make their score odd.
  // partnerOnRight resets to {1,1} when the current game is back to 0–0
  // (start-of-game state) so doubles partner placement matches a fresh game.
  //
  // For alternate serve rules, the server is fully determined by the score +
  // per-game initial server, so a score correction must also recompute it. For
  // rally-winner and side-out rules, the operator's last known server is the
  // best we can do.
  const servingSide: SideId =
    cfg.scoring === 'rally' && cfg.serveRule === 'alternate'
      ? computeAlternatingServer(
          cur,
          nextGames.length - 1,
          state.matchInitialServer,
          cfg
        )
      : state.servingSide;
  const serverScore = servingSide === 'A' ? cur.a : cur.b;
  const parityCourt: 'right' | 'left' =
    serverScore % 2 === 0 ? 'right' : 'left';
  const partnerOnRight = atGameStart
    ? ({ a: 1, b: 1 } as RacquetState['partnerOnRight'])
    : state.partnerOnRight;
  // A game back at 0–0 re-opens on the "0–0–2" convention; otherwise the
  // correction is only about the score and the service turn carries on.
  const serverNumber: 1 | 2 =
    cfg.scoring !== 'side-out'
      ? state.serverNumber
      : atGameStart && cfg.doubles
        ? 2
        : state.serverNumber;
  // Score parity places the FIRST server of a side-out turn. The second server
  // is their partner, standing in the other court — so re-deriving the court
  // from parity alone while keeping `serverNumber: 2` produced a state that
  // contradicted itself, and rendered "SERVES · 2" on the first server.
  const isSecondServer =
    cfg.scoring === 'side-out' &&
    !!cfg.doubles &&
    serverNumber === 2 &&
    !atGameStart;
  const serverCourt: 'right' | 'left' = isSecondServer
    ? parityCourt === 'right'
      ? 'left'
      : 'right'
    : parityCourt;
  // A correction can land the match straight onto game/match point (the
  // operator fixes a mis-scored rally to 20–5). Recompute from the
  // corrected score instead of clearing — otherwise the chip and status
  // pill stay hidden until the next rally is scored.
  //
  // Under side-out scoring only the serving side can convert, so a receiver
  // sitting on 10 in an 11-point game is not at game point.
  const canScore = (s: SideId) =>
    cfg.scoring !== 'side-out' || servingSide === s;
  const aWouldWinGame =
    !matchOver && canScore('A') && wouldWinGameWithPoint(cur, 'A', cfg);
  const bWouldWinGame =
    !matchOver && canScore('B') && wouldWinGameWithPoint(cur, 'B', cfg);
  const aWouldWinMatch = aWouldWinGame && ev.gamesWon.a + 1 >= cfg.gamesToWin;
  const bWouldWinMatch = bWouldWinGame && ev.gamesWon.b + 1 >= cfg.gamesToWin;
  return {
    ...state,
    games: nextGames,
    gamesWon: { ...ev.gamesWon },
    points: { a: 0, b: 0 },
    inTiebreak: false,
    servingSide,
    serverCourt,
    partnerOnRight,
    serverSlot: slotInCourt(partnerOnRight, servingSide, serverCourt),
    serverNumber,
    matchOver,
    winner: matchOver ? (ev.gamesWon.a > ev.gamesWon.b ? 'A' : 'B') : null,
    endReason: matchOver ? 'normal' : null,
    betweenGames: false,
    isGamePoint: aWouldWinGame || bWouldWinGame,
    isMatchPoint: aWouldWinMatch || bWouldWinMatch,
    gamePoint: { a: aWouldWinGame, b: bWouldWinGame },
    matchPoint: { a: aWouldWinMatch, b: bWouldWinMatch },
    setPoint: { a: false, b: false },
    // Same reason the point flags are recomputed rather than cleared: a
    // correction can land the game straight on 20–20.
    isDeuce: !matchOver && isDeuceScore(cur, cfg),
    atInterval: false,
  };
}

/** Returns the event list with the most recent point/game.end removed (true undo). */
export const applyUndo = trimLastPointOrGameEnd;
