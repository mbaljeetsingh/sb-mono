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
// Shape of the reducer. Each event handler changes only what the event itself
// decides — the score, who holds the serve, partner positions, the pickleball
// server number. Everything that FOLLOWS from those is recomputed from scratch
// after every event by two pure passes:
//
//   seat()  — who serves and receives, from which court (and, for table-tennis
//             doubles, where each player stands).
//   flags() — game / set / match point and deuce.
//
// They used to be carried forward event to event by each handler, and every
// path that wasn't an ordinary rally (a penalty point, a score correction, a
// manual game end) left one of them stale.

import type {
  GameScore,
  RacquetConfig,
  RacquetEvent,
  RacquetState,
  SideId,
} from '../racquet-shared';
import {
  computeAlternatingServer,
  effectiveConfig,
  initialRacquetState,
  isDeuceScore,
  isGameWon,
  isMatchTiebreakSet,
  isTiebreakScore,
  other,
  slotInCourt,
  tennisGameWinner,
  tennisTierOf,
  trimLastPointOrGameEnd,
  wouldWinGameWithPoint,
  wouldWinTennisGame,
} from '../racquet-shared';

export function reduce(
  events: RacquetEvent[],
  cfg: RacquetConfig
): RacquetState {
  let state = derive(openingState(cfg, !!cfg.doubles), cfg);
  const intervalSeen = new Set<number>();

  for (const ev of events) {
    state = derive(applyEvent(state, ev, cfg, intervalSeen), cfg);
  }
  return state;
}

const key = (side: SideId): 'a' | 'b' => (side === 'A' ? 'a' : 'b');
const bump = (g: GameScore, side: SideId): GameScore =>
  side === 'A' ? { a: g.a + 1, b: g.b } : { a: g.a, b: g.b + 1 };
const flip = (c: 'right' | 'left'): 'right' | 'left' =>
  c === 'right' ? 'left' : 'right';

/**
 * Side-out doubles opens every game on "0–0–2": the team serving first gets a
 * single server, so one fault ends their turn. That is a call-out convention,
 * not a position — the right-court player still serves (`serverIsPartner`
 * false).
 */
const openingServerNumber = (cfg: RacquetConfig, doubles: boolean): 1 | 2 =>
  cfg.scoring === 'side-out' && doubles ? 2 : 1;

const openingState = (cfg: RacquetConfig, doubles: boolean): RacquetState => ({
  ...initialRacquetState(),
  doubles,
  serverNumber: openingServerNumber(cfg, doubles),
});

/** Per-game resets shared by a won game and a manual `game.end`. */
const freshGameFields = (
  cfg: RacquetConfig,
  doubles: boolean
): Partial<RacquetState> => ({
  // BWF: each new game starts with both teams' slot-1 in the right court.
  partnerOnRight: { a: 1, b: 1 },
  serverNumber: openingServerNumber(cfg, doubles),
  serverIsPartner: false,
  receiverSwap: null,
  points: { a: 0, b: 0 },
  atInterval: false,
  // Squash: every game opens a fresh hand from the right box, target reset.
  serveRun: 0,
  handBox: 'right',
  gameTarget: null,
});

/** A change of server (a new hand): squash's box choice and run reset. */
const newHand = { serveRun: 0, handBox: 'right' } as const;

function applyEvent(
  state: RacquetState,
  ev: RacquetEvent,
  cfg: RacquetConfig,
  intervalSeen: Set<number>
): RacquetState {
  switch (ev.type) {
    case 'match.start': {
      intervalSeen.clear();
      const doubles = ev.isDoubles ?? !!cfg.doubles;
      return {
        ...openingState(cfg, doubles),
        servingSide: ev.serverSide,
        matchInitialServer: ev.serverSide,
        names: state.names,
      };
    }

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
      // Explicit transition into the next game (the "Start game N" button),
      // or a manual game end mid-game. Forces a new empty game. Everything
      // positional resets exactly as a won game resets it — a manual end used
      // to leave the partner positions of the abandoned game in place.
      if (state.matchOver) return state;
      return {
        ...state,
        ...freshGameFields(cfg, state.doubles),
        games: [...state.games, { a: 0, b: 0 }],
        betweenGames: false,
        endsChange: false,
        inTiebreak:
          cfg.scoring === 'tennis' && isMatchTiebreakSet(state.gamesWon, cfg),
      };
    }

    case 'undo':
      // No-op here; undo is handled at the event-list level via applyUndo().
      return state;

    case 'serve.box': {
      // Squash only, and only at the start of a hand — choosing mid-hand
      // would move where the rallies already played were served from.
      if (
        state.matchOver ||
        cfg.serveBox !== 'choice' ||
        state.serveRun !== 0
      ) {
        return state;
      }
      return { ...state, handBox: ev.court };
    }

    case 'game.target': {
      // Classic squash set one / set two, only while the game is level at the
      // choice score. Clamped to the two legal targets.
      const at = cfg.setChoiceAt;
      const game = liveGame(state);
      if (state.matchOver || !at || game.a !== at || game.b !== at)
        return state;
      const to = Math.min(at + 2, Math.max(at + 1, Math.round(ev.to)));
      return { ...state, gameTarget: to };
    }

    case 'serve.choose': {
      // Table-tennis doubles only, and only before the game's first rally —
      // a choice made mid-game would rewrite who served every rally so far.
      const game = liveGame(state);
      if (
        state.matchOver ||
        !state.doubles ||
        cfg.scoring !== 'rally' ||
        cfg.serveRule !== 'alternate' ||
        game.a !== 0 ||
        game.b !== 0
      ) {
        return state;
      }
      return {
        ...state,
        firstServerByGame: {
          ...state.firstServerByGame,
          [liveGameIndex(state)]: ev.slot,
        },
      };
    }

    case 'walkover':
      // First terminal event wins, like every other ending below. Without this
      // a stray second walkover could reassign `winner` on an already-decided
      // match — and because the log is replayed from scratch on every device,
      // a duplicate that reached Supabase would flip the result everywhere.
      if (state.matchOver) return state;
      return { ...state, ...endedBy('walkover', ev.winner) };

    case 'retirement':
      // Retiring side loses; opponent wins.
      if (state.matchOver) return state;
      return { ...state, ...endedBy('retirement', other(ev.retiring)) };

    case 'default':
      if (state.matchOver) return state;
      return { ...state, ...endedBy('default', other(ev.defaulted)) };

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
      if (ev.card === 'yellow') return { ...state, cards };
      if (ev.card === 'red') {
        // Award a point to the opponent. Under side-out scoring a rally won by
        // the receivers does NOT score, so routing the card through the rally
        // path would silently turn a red card into a side-out; a fault penalty
        // is a point, so it is credited directly there.
        const opponent = other(ev.side);
        const next =
          cfg.scoring === 'side-out'
            ? state.matchOver
              ? state
              : creditSideOutPoint(openNextGame(state), opponent, cfg)
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
  }) satisfies Partial<RacquetState>;

// ---------------------------------------------------------------------------
// Points
// ---------------------------------------------------------------------------

/** Between games, the next point (or penalty point) opens the next game —
 * otherwise it would land on the game that just finished. */
const openNextGame = (state: RacquetState): RacquetState =>
  state.betweenGames
    ? {
        ...state,
        games: [...state.games, { a: 0, b: 0 }],
        betweenGames: false,
      }
    : state;

function applyPoint(
  state: RacquetState,
  side: SideId,
  cfg: RacquetConfig,
  intervalSeen: Set<number>
): RacquetState {
  if (state.matchOver) return state;

  const working = openNextGame(state);

  if (cfg.scoring === 'tennis') return applyTennisPoint(working, side, cfg);
  if (cfg.scoring === 'side-out') {
    if (side !== working.servingSide) return sideOut(working);
    return creditSideOutPoint(working, side, cfg);
  }
  return applyRallyPoint(working, side, cfg, intervalSeen);
}

/** Deciding game of a rally/side-out match: games level one short of it. */
const isDecidingGame = (s: RacquetState, cfg: RacquetConfig) =>
  s.gamesWon.a === cfg.gamesToWin - 1 && s.gamesWon.b === cfg.gamesToWin - 1;

/**
 * Credit a finished game (rally/side-out). The next game's opening positions
 * are reset here; `seat` then places the server for them.
 */
function closeGame(
  working: RacquetState,
  winner: SideId,
  newGames: GameScore[],
  cfg: RacquetConfig
): RacquetState {
  const gamesWon = bump(working.gamesWon, winner);
  const matchOver =
    gamesWon.a >= cfg.gamesToWin || gamesWon.b >= cfg.gamesToWin;
  return {
    ...working,
    // Match over freezes positions as the final rally left them, for the
    // audience-facing surfaces; otherwise the next game opens fresh.
    ...(matchOver
      ? { atInterval: false }
      : freshGameFields(cfg, working.doubles)),
    games: newGames,
    gamesWon,
    betweenGames: !matchOver,
    matchOver,
    winner: matchOver ? (gamesWon.a > gamesWon.b ? 'A' : 'B') : null,
    endsChange: false,
  };
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
  const next = bump(working.games[gameIdx]!, side);
  const newGames = [...working.games.slice(0, gameIdx), next];

  // 'rally-winner' (badminton): the side that just scored serves next.
  // 'alternate' (TT) is fully determined by the score — `seat` computes it.
  const servingSide =
    cfg.serveRule === 'alternate' ? working.servingSide : side;

  // BWF doubles partner tracking: a team that scores on its own serve swaps
  // its two players' courts. Receivers gaining the serve swap nobody.
  const partnerOnRight = rotatePartners(
    working,
    side,
    working.servingSide === side,
    cfg
  );

  // Interval flag fires once per game, the first time intervalAt is reached.
  const reachedInterval =
    cfg.intervalAt !== null &&
    !intervalSeen.has(gameIdx) &&
    (next.a === cfg.intervalAt || next.b === cfg.intervalAt);
  if (reachedInterval) intervalSeen.add(gameIdx);

  // Squash: the server keeps the hand while winning rallies; losing one is a
  // change of server and a fresh box choice.
  const run =
    working.servingSide === side
      ? { serveRun: working.serveRun + 1, handBox: working.handBox }
      : newHand;

  const winner = isGameWon(next, effectiveConfig(working, cfg));
  if (winner) {
    return closeGame(
      { ...working, ...run, servingSide, partnerOnRight },
      winner,
      newGames,
      cfg
    );
  }

  const endsAt = cfg.endsChangeAt ?? cfg.intervalAt;
  const crossedEnds = crossedMidpoint(working, next, endsAt, cfg);
  return {
    ...working,
    ...run,
    games: newGames,
    servingSide,
    partnerOnRight,
    atInterval: reachedInterval,
    endsChange: crossedEnds,
    // ITTF 2.14.3: at that same score in the last possible game, the pair due
    // to receive next reverses its receiving order.
    receiverSwap:
      crossedEnds && working.doubles && cfg.serveRule === 'alternate'
        ? other(alternatingServer(next, gameIdx, working, cfg))
        : working.receiverSwap,
  };
}

/** The leading score just reached `at` for the first time in the deciding
 * game — the ends-change moment. */
const crossedMidpoint = (
  working: RacquetState,
  next: GameScore,
  at: number | null | undefined,
  cfg: RacquetConfig
): boolean => {
  if (!at || !isDecidingGame(working, cfg)) return false;
  const cur = working.games[working.games.length - 1]!;
  return Math.max(next.a, next.b) === at && Math.max(cur.a, cur.b) < at;
};

/**
 * Partner court rotation. 'serve-swap' (default — BWF Law 8, and the same rule
 * in pickleball) swaps the scoring team's two players each time they score on
 * their own serve. 'fixed' (tennis, padel) holds partners in their halves.
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
 * Side-out: the receivers won the rally, so the serve moves and the score
 * doesn't. In doubles the serve passes to the partner (server 1 → 2), who
 * serves from where they already stand; on the second fault — or the single
 * opening server's fault, or always in singles — it passes to the opponents.
 */
function sideOut(working: RacquetState): RacquetState {
  if (working.doubles && working.serverNumber === 1) {
    return { ...working, ...newHand, serverNumber: 2, serverIsPartner: true };
  }
  return {
    ...working,
    ...newHand,
    servingSide: other(working.servingSide),
    serverNumber: 1,
    serverIsPartner: false,
  };
}

/**
 * Side-out: add a point for `side` — a won rally on serve, or a penalty point.
 *
 * When the scorer holds the serve their partners swap courts, so the same
 * player serves on from the other side (keeping the court in step with the
 * team's score parity). A penalty point handed to the receivers moves nobody.
 */
function creditSideOutPoint(
  working: RacquetState,
  side: SideId,
  cfg: RacquetConfig
): RacquetState {
  const gameIdx = working.games.length - 1;
  const next = bump(working.games[gameIdx]!, side);
  const newGames = [...working.games.slice(0, gameIdx), next];
  const partnerOnRight = rotatePartners(
    working,
    side,
    working.servingSide === side,
    cfg
  );
  // A point on serve extends the hand (squash alternates boxes on it); a
  // penalty point to the receivers doesn't touch the server's run.
  const serveRun =
    working.servingSide === side ? working.serveRun + 1 : working.serveRun;
  const winner = isGameWon(next, effectiveConfig(working, cfg));
  if (winner) {
    return closeGame(
      { ...working, serveRun, partnerOnRight },
      winner,
      newGames,
      cfg
    );
  }
  return {
    ...working,
    serveRun,
    games: newGames,
    partnerOnRight,
    endsChange: crossedMidpoint(working, next, cfg.endsChangeAt, cfg),
  };
}

// ---------------------------------------------------------------------------
// Tennis / padel — the point tier inside each game
// ---------------------------------------------------------------------------

/** Games completed in the match so far, across every set. */
const gamesPlayed = (games: GameScore[]): number =>
  games.reduce((n, g) => n + g.a + g.b, 0);

function applyTennisPoint(
  working: RacquetState,
  side: SideId,
  cfg: RacquetConfig
): RacquetState {
  const setIdx = working.games.length - 1;
  const curSet = working.games[setIdx]!;
  const nextPoints = bump(working.points, side);
  const tier = tennisTierOf(working, cfg);
  const gameWinner = tennisGameWinner(nextPoints, tier);

  if (!gameWinner) {
    // Tiebreaks change ends every six points.
    const played = nextPoints.a + nextPoints.b;
    return {
      ...working,
      points: nextPoints,
      endsChange: working.inTiebreak && played % 6 === 0,
    };
  }

  // Game over — credit it to the set. A match tiebreak IS the deciding set,
  // recorded as won 1–0 (the ITF convention), so it settles the set outright.
  const matchTb =
    working.inTiebreak && isMatchTiebreakSet(working.gamesWon, cfg);
  const nextSet = bump(curSet, gameWinner);
  const newGames = [...working.games.slice(0, setIdx), nextSet];
  const setWinner = matchTb ? gameWinner : isGameWon(nextSet, cfg);
  // Ends change after every odd game of the match (a tiebreak counts as one),
  // which is the ITF odd-game rule including its carry across set breaks.
  const endsChange = gamesPlayed(newGames) % 2 === 1;

  if (!setWinner) {
    return {
      ...working,
      games: newGames,
      points: { a: 0, b: 0 },
      inTiebreak: isTiebreakScore(nextSet, cfg),
      endsChange,
    };
  }

  const gamesWon = bump(working.gamesWon, setWinner);
  const matchOver =
    gamesWon.a >= cfg.gamesToWin || gamesWon.b >= cfg.gamesToWin;
  return {
    ...working,
    games: newGames,
    gamesWon,
    points: matchOver ? working.points : { a: 0, b: 0 },
    // The next set may itself be the match tiebreak.
    inTiebreak: !matchOver && isMatchTiebreakSet(gamesWon, cfg),
    betweenGames: !matchOver,
    matchOver,
    winner: matchOver ? (gamesWon.a > gamesWon.b ? 'A' : 'B') : null,
    endsChange: !matchOver && endsChange,
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
  // Authoritative reset of scores. A tied gamesWon can never end a match
  // (winner would be arbitrary) — treat a fat-fingered tie at/above gamesToWin
  // as an in-progress match so the operator can correct it, rather than
  // declaring the wrong winner.
  const matchOver =
    (ev.gamesWon.a >= cfg.gamesToWin || ev.gamesWon.b >= cfg.gamesToWin) &&
    ev.gamesWon.a !== ev.gamesWon.b;
  const nextGames = ev.games.length > 0 ? [...ev.games] : [{ a: 0, b: 0 }];
  const cur = nextGames[nextGames.length - 1] ?? { a: 0, b: 0 };
  const base = {
    ...state,
    games: nextGames,
    gamesWon: { ...ev.gamesWon },
    matchOver,
    winner: matchOver
      ? ((ev.gamesWon.a > ev.gamesWon.b ? 'A' : 'B') as SideId)
      : null,
    endReason: matchOver ? ('normal' as const) : null,
    betweenGames: false,
    atInterval: false,
    endsChange: false,
  };

  if (cfg.scoring === 'tennis') {
    // Sets and games come from the sheet; the point tier resets unless the
    // caller sent one.
    return {
      ...base,
      points: ev.points ?? { a: 0, b: 0 },
      inTiebreak:
        !matchOver &&
        (isMatchTiebreakSet(ev.gamesWon, cfg) || isTiebreakScore(cur, cfg)),
    };
  }

  // A game back at 0–0 is a fresh game: partners to their opening courts and,
  // under side-out, the "0–0–2" opening. Otherwise the correction is only
  // about the score and the service turn carries on.
  const atGameStart = cur.a === 0 && cur.b === 0;
  // A set-one/set-two choice only survives a correction that leaves the game
  // past the choice score; otherwise it would be applied to a game that
  // never reached 8–all.
  const keepsTarget =
    !!cfg.setChoiceAt && Math.min(cur.a, cur.b) >= cfg.setChoiceAt;
  return {
    ...base,
    ...(atGameStart ? freshGameFields(cfg, state.doubles) : {}),
    points: { a: 0, b: 0 },
    inTiebreak: false,
    gameTarget: keepsTarget ? state.gameTarget : null,
  };
}

// ---------------------------------------------------------------------------
// Derived state — recomputed after every event
// ---------------------------------------------------------------------------

const derive = (s: RacquetState, cfg: RacquetConfig): RacquetState =>
  flags(seat(s, cfg), cfg);

/** The game being played — 0–0 between games, when the next one hasn't begun. */
const liveGame = (s: RacquetState): GameScore =>
  s.betweenGames
    ? { a: 0, b: 0 }
    : (s.games[s.games.length - 1] ?? { a: 0, b: 0 });

/** Index of the game being played (the upcoming one between games). */
const liveGameIndex = (s: RacquetState) =>
  s.betweenGames ? s.games.length : s.games.length - 1;

const parityCourt = (score: number): 'right' | 'left' =>
  score % 2 === 0 ? 'right' : 'left';

/**
 * Who serves, who receives, and from which court.
 *
 * At match end the positions freeze as the last rally left them (the tennis
 * family would otherwise already be pointing at a next game that will never
 * be played).
 */
function seat(s: RacquetState, cfg: RacquetConfig): RacquetState {
  if (s.matchOver && cfg.scoring === 'tennis') return s;
  if (cfg.scoring === 'tennis') return seatTennis(s, cfg);
  if (cfg.scoring === 'rally' && cfg.serveRule === 'alternate') {
    return seatAlternating(s, cfg);
  }
  if (cfg.serveBox === 'choice') {
    // Squash: the chosen box, alternating with every rally won this hand.
    const court = s.serveRun % 2 === 0 ? s.handBox : flip(s.handBox);
    return { ...s, serverCourt: court, serverSlot: 1, receiverSlot: 1 };
  }

  // Badminton, pickleball (both modes): the server stands in the court their
  // own score's parity dictates — or, for side-out's second server, in the
  // other one, because they serve from wherever they already stand.
  const game = s.matchOver ? s.games[s.games.length - 1]! : liveGame(s);
  const serving = s.servingSide;
  const serverScore = serving === 'A' ? game.a : game.b;
  const court =
    cfg.scoring === 'side-out' && s.serverIsPartner
      ? flip(parityCourt(serverScore))
      : parityCourt(serverScore);
  return {
    ...s,
    serverCourt: court,
    serverSlot: slotInCourt(s.partnerOnRight, serving, court),
    // The only legal receiver is diagonally opposite — the same-named court.
    receiverSlot: slotInCourt(s.partnerOnRight, other(serving), court),
  };
}

/** Service turns `team` has taken before game index `g` of the match. */
const priorServiceTurns = (
  team: SideId,
  g: number,
  matchInitialServer: SideId
): number =>
  team === matchInitialServer ? Math.ceil(g / 2) : Math.floor(g / 2);

/**
 * Tennis / padel. Serve alternates every game, and within a team the two
 * partners alternate their own service games — A1, B1, A2, B2, A1, … A
 * tiebreak counts as one game; inside it the player due to serve takes one
 * point and service then changes every two (turn = floor((p + 1) / 2)). The
 * court is deuce/ad by the points played in the game.
 */
function seatTennis(s: RacquetState, cfg: RacquetConfig): RacquetState {
  const g = gamesPlayed(s.games);
  const init = s.matchInitialServer;
  const opener: SideId = g % 2 === 0 ? init : other(init);
  const played = s.betweenGames ? 0 : s.points.a + s.points.b;
  let serving = opener;
  let turns = priorServiceTurns(opener, g, init);
  if (s.inTiebreak && !s.betweenGames) {
    const turn = Math.floor((played + 1) / 2);
    serving = turn % 2 === 0 ? opener : other(opener);
    turns = priorServiceTurns(serving, g, init) + Math.floor(turn / 2);
  }
  const court = parityCourt(played);
  return {
    ...s,
    servingSide: serving,
    serverSlot: turns % 2 === 0 ? 1 : 2,
    serverCourt: court,
    // Receivers hold their courts for the set; the one in the court served to
    // receives. (Partners never rotate here, so this is fixed per court.)
    receiverSlot: slotInCourt(s.partnerOnRight, other(serving), court),
    inMatchTiebreak: s.inTiebreak && isMatchTiebreakSet(s.gamesWon, cfg),
  };
}

/** Table tennis: the side serving the given score, from the score alone. */
const alternatingServer = (
  game: GameScore,
  gameIdx: number,
  s: RacquetState,
  cfg: RacquetConfig
): SideId => computeAlternatingServer(game, gameIdx, s.matchInitialServer, cfg);

type Player = { side: SideId; slot: 1 | 2 };
const partner = (p: Player): Player => ({
  side: p.side,
  slot: p.slot === 1 ? 2 : 1,
});

/**
 * Table tennis. The serving SIDE follows from the score (every
 * `serveTurnLength` points, every point from deuce). In doubles the players
 * also rotate through a fixed four-player cycle, S→R, R→S', S'→R', R'→S
 * (ITTF 2.14): the receiver of one turn serves the next. In each later game
 * the serving pair's player 1 serves first and the first receiver is the
 * player who served to them in the previous game; in the deciding game the
 * pair due to receive reverses its order at the ends-change score.
 *
 * Table-tennis doubles has no fixed service courts — a server serves from
 * their right half to the diagonal — so the cells show the server and the
 * receiver on the right, their partners on the left.
 */
function seatAlternating(s: RacquetState, cfg: RacquetConfig): RacquetState {
  const gameIdx = s.matchOver ? s.games.length - 1 : liveGameIndex(s);
  const game = s.matchOver ? s.games[gameIdx]! : liveGame(s);
  const servingSide = alternatingServer(game, gameIdx, s, cfg);

  if (!s.doubles) {
    const court = parityCourt(servingSide === 'A' ? game.a : game.b);
    return {
      ...s,
      servingSide,
      serverCourt: court,
      serverSlot: 1,
      receiverSlot: 1,
    };
  }

  // Build the cycle for this game from game 0. Each game's first server is the
  // serving pair's choice (slot 1 unless they said otherwise); in game 1 the
  // receiving pair's choice is made at the toss, which orders their slots.
  const init = s.matchInitialServer;
  const chosen = (g: number): 1 | 2 => s.firstServerByGame[g] ?? 1;
  let cycle: Player[] = [
    { side: init, slot: chosen(0) },
    { side: other(init), slot: 1 },
  ];
  cycle = [cycle[0]!, cycle[1]!, partner(cycle[0]!), partner(cycle[1]!)];
  for (let g = 1; g <= gameIdx; g++) {
    const first: Player = {
      side: g % 2 === 0 ? init : other(init),
      slot: chosen(g),
    };
    const i = cycle.findIndex(
      (p) => p.side === first.side && p.slot === first.slot
    );
    const firstReceiver = cycle[(i + 3) % 4]!; // who served to them last game
    cycle = [first, firstReceiver, partner(first), partner(firstReceiver)];
  }
  if (s.receiverSwap && !s.betweenGames) {
    const t = s.receiverSwap;
    cycle = cycle.map((p) => (p.side === t ? partner(p) : p));
  }

  const turnLen = Math.max(1, cfg.serveTurnLength ?? 2);
  const deuceCombined = (cfg.pointsPerGame - 1) * 2;
  const combined = game.a + game.b;
  const turn =
    combined < deuceCombined
      ? Math.floor(combined / turnLen)
      : Math.floor(deuceCombined / turnLen) + (combined - deuceCombined);
  const server = cycle[turn % 4]!;
  const receiver = cycle[(turn + 1) % 4]!;
  return {
    ...s,
    servingSide: server.side,
    serverCourt: 'right',
    serverSlot: server.slot,
    receiverSlot: receiver.slot,
    partnerOnRight: {
      [key(server.side)]: server.slot,
      [key(receiver.side)]: receiver.slot,
    } as RacquetState['partnerOnRight'],
  };
}

const NO = { a: false, b: false };

/**
 * Game / set / match point and deuce, from the state alone.
 *
 * - Rally: either side can be a point from the game (the receiver scores too).
 * - Side-out: only the side holding the serve can score, so only it can be.
 * - Tennis: the tiers nest — a side at set point is at game point too, and at
 *   match point only if that set takes the match.
 */
function flags(s: RacquetState, cfg: RacquetConfig): RacquetState {
  if (s.matchOver || s.betweenGames) {
    return {
      ...s,
      isGamePoint: false,
      isMatchPoint: false,
      gamePoint: NO,
      matchPoint: NO,
      setPoint: NO,
      isDeuce: false,
      decidingPoint: null,
      awaitingSetChoice: false,
    };
  }
  const game = liveGame(s);
  const toMatch = (side: SideId) => s.gamesWon[key(side)] + 1 >= cfg.gamesToWin;
  const awaitingSetChoice =
    !!cfg.setChoiceAt &&
    s.gameTarget === null &&
    game.a === cfg.setChoiceAt &&
    game.b === cfg.setChoiceAt;

  let gp: { a: boolean; b: boolean };
  let sp = NO;
  let decidingPoint: RacquetState['decidingPoint'] = null;
  let mp: { a: boolean; b: boolean };
  let isDeuce: boolean;

  if (cfg.scoring === 'tennis') {
    const tier = tennisTierOf(s, cfg);
    gp = {
      a: wouldWinTennisGame(s.points, 'A', tier),
      b: wouldWinTennisGame(s.points, 'B', tier),
    };
    const takesSet = (side: SideId) =>
      s.inMatchTiebreak || wouldWinGameWithPoint(game, side, cfg);
    sp = { a: gp.a && takesSet('A'), b: gp.b && takesSet('B') };
    mp = { a: sp.a && toMatch('A'), b: sp.b && toMatch('B') };
    isDeuce =
      s.points.a === s.points.b &&
      s.points.a >= tier.pointsToWin - 1 &&
      !gp.a &&
      !gp.b;
    // Level and either side takes the game with the next rally.
    if (gp.a && gp.b && s.points.a === s.points.b) {
      decidingPoint =
        !s.inTiebreak && 'suddenDeathAtDeuce' in tier && tier.suddenDeathAtDeuce
          ? 'star'
          : !s.inTiebreak && cfg.sport === 'padel'
            ? 'golden'
            : 'deciding';
    }
  } else {
    const eff = effectiveConfig(s, cfg);
    const canScore = (side: SideId) =>
      cfg.scoring !== 'side-out' || s.servingSide === side;
    gp = {
      a: canScore('A') && wouldWinGameWithPoint(game, 'A', eff),
      b: canScore('B') && wouldWinGameWithPoint(game, 'B', eff),
    };
    mp = { a: gp.a && toMatch('A'), b: gp.b && toMatch('B') };
    isDeuce = isDeuceScore(game, eff);
  }

  return {
    ...s,
    isGamePoint: gp.a || gp.b,
    isMatchPoint: mp.a || mp.b,
    gamePoint: gp,
    matchPoint: mp,
    setPoint: sp,
    isDeuce,
    decidingPoint,
    awaitingSetChoice,
  };
}

/** Returns the event list with the most recent point/game.end removed (true undo). */
export const applyUndo = trimLastPointOrGameEnd;
