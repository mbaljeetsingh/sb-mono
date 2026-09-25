// The formats beyond each sport's base ruleset: tennis Fast4 and the no-ad /
// match-tiebreak game, padel's star point, side-out pickleball to 15,
// table-tennis doubles service order, and per-sport ends changes. Plus the
// log-level facts the reducer now reads off `match.start`.

import { describe, expect, it } from 'vitest';
import {
  padelGolden,
  padelStar,
  pickleballOfficial,
  pickleballOfficial15,
  tableTennis,
  tennisFast4,
  tennisMatchTiebreak,
  tennisOfficial,
} from '../../../registry';
import type { RacquetConfig, RacquetEvent, SideId } from '../../racquet-shared';
import { pointLabel } from '../../racquet-shared';
import { badminton21 } from '../config';
import { reduce } from '../index';

let n = 0;
const ev = (
  type: RacquetEvent['type'],
  extra: Record<string, unknown> = {}
): RacquetEvent =>
  ({ id: `e${n++}`, ts: Date.now() + n, type, ...extra }) as RacquetEvent;
const start = (server: SideId = 'A', extra: Record<string, unknown> = {}) =>
  ev('match.start', { serverSide: server, serverCourt: 'right', ...extra });
const point = (side: SideId) => ev('point', { side });
const play = (cfg: RacquetConfig, winners: SideId[], startExtra = {}) =>
  reduce([start('A', startExtra), ...winners.map(point)], cfg);

const times = (side: SideId, k: number): SideId[] => Array(k).fill(side);
const loveGame = (side: SideId) => times(side, 4);
const alternatingGames = (k: number): SideId[] =>
  Array.from({ length: k }, (_, i) => loveGame(i % 2 === 0 ? 'A' : 'B')).flat();

describe('tennis — no-ad with a match tiebreak', () => {
  it('40–40 is decided by one rally', () => {
    const s = play(tennisMatchTiebreak, ['A', 'A', 'A', 'B', 'B', 'B', 'B']);
    expect(s.games[0]).toEqual({ a: 0, b: 1 });
  });

  it('at one set all the deciding set is a single tiebreak to 10', () => {
    const setToA = times('A', 24); // 6–0
    const setToB = times('B', 24); // 0–6
    const s = play(tennisMatchTiebreak, [...setToA, ...setToB]);
    expect(s.gamesWon).toEqual({ a: 1, b: 1 });
    expect(s.inTiebreak).toBe(true);
    const into = play(tennisMatchTiebreak, [...setToA, ...setToB, 'A']);
    expect(into.inMatchTiebreak).toBe(true);
    expect(
      pointLabel(into.points, 'A', into.inTiebreak, tennisMatchTiebreak)
    ).toBe('1');
  });

  it('the match tiebreak goes past 7, needs 10 by two, and counts as a set 1–0', () => {
    const base = [...times('A', 24), ...times('B', 24)];
    const at9 = play(tennisMatchTiebreak, [...base, ...times('A', 9)]);
    expect(at9.matchOver).toBe(false);
    expect(at9.matchPoint).toEqual({ a: true, b: false });
    const won = play(tennisMatchTiebreak, [...base, ...times('A', 10)]);
    expect(won.matchOver).toBe(true);
    expect(won.winner).toBe('A');
    expect(won.games[2]).toEqual({ a: 1, b: 0 });
  });

  it('9–9 in the match tiebreak needs two clear', () => {
    const base = [...times('A', 24), ...times('B', 24)];
    const level: SideId[] = [...base, ...times('A', 9), ...times('B', 9), 'A'];
    expect(play(tennisMatchTiebreak, level).matchOver).toBe(false);
    expect(play(tennisMatchTiebreak, [...level, 'A']).matchOver).toBe(true);
  });
});

describe('tennis — Fast4', () => {
  it('four games take the set', () => {
    const s = play(tennisFast4, times('A', 16));
    expect(s.gamesWon).toEqual({ a: 1, b: 0 });
    expect(s.games[0]).toEqual({ a: 4, b: 0 });
  });

  it('3–3 goes to a tiebreak to 5 with sudden death at 4–4', () => {
    const to33 = alternatingGames(6);
    expect(play(tennisFast4, to33).inTiebreak).toBe(true);
    const at44 = [...to33, ...times('A', 4), ...times('B', 4)];
    const s = play(tennisFast4, at44);
    expect(s.gamePoint).toEqual({ a: true, b: true });
    const won = play(tennisFast4, [...at44, 'B']);
    expect(won.games[0]).toEqual({ a: 3, b: 4 });
    expect(won.gamesWon).toEqual({ a: 0, b: 1 });
  });
});

describe('padel — star point', () => {
  const deuce: SideId[] = ['A', 'A', 'A', 'B', 'B', 'B'];

  it('plays the first two advantages out', () => {
    // Deuce 1 → AD A → deuce 2 → AD B → deuce 3: still no game.
    const s = play(padelStar, [...deuce, 'A', 'B', 'B', 'A']);
    expect(s.games[0]).toEqual({ a: 0, b: 0 });
    expect(s.isDeuce).toBe(false);
    // The third deuce is sudden death — both sides a rally from the game.
    expect(s.gamePoint).toEqual({ a: true, b: true });
  });

  it('the second deuce is still a normal deuce', () => {
    const s = play(padelStar, [...deuce, 'A', 'B']);
    expect(s.isDeuce).toBe(true);
    // One advantage does not win it.
    const adv = play(padelStar, [...deuce, 'A', 'B', 'A']);
    expect(adv.games[0]).toEqual({ a: 0, b: 0 });
  });

  it('the star point decides the game', () => {
    const s = play(padelStar, [...deuce, 'A', 'B', 'B', 'A', 'B']);
    expect(s.games[0]).toEqual({ a: 0, b: 1 });
  });
});

describe('pickleball — side-out to 15', () => {
  it('is a single game to 15 by two', () => {
    const s = play(pickleballOfficial15, times('A', 15), { isDoubles: true });
    expect(s.matchOver).toBe(true);
    const at14 = play(pickleballOfficial15, times('A', 14), {
      isDoubles: true,
    });
    expect(at14.matchPoint).toEqual({ a: true, b: false });
  });
});

describe('isDoubles is read off match.start', () => {
  it('overrides the config fallback', () => {
    // Config says singles, the log says doubles → the "0–0–2" opening.
    const s = reduce([start('A', { isDoubles: true })], {
      ...pickleballOfficial,
      doubles: false,
    });
    expect(s.doubles).toBe(true);
    expect(s.serverNumber).toBe(2);
  });

  it('falls back to the config for logs that predate it', () => {
    const s = reduce([start('A')], { ...pickleballOfficial, doubles: true });
    expect(s.serverNumber).toBe(2);
  });
});

describe('table tennis — doubles service order (ITTF 2.14)', () => {
  const at = (winners: SideId[]) =>
    play(tableTennis, winners, { isDoubles: true });
  const who = (s: ReturnType<typeof at>) =>
    `${s.servingSide}${s.serverSlot}→${s.servingSide === 'A' ? 'B' : 'A'}${s.receiverSlot}`;

  it('rotates S→R, R→S′, S′→R′, R′→S every two points', () => {
    const seen = [0, 2, 4, 6, 8].map((k) =>
      who(at(Array.from({ length: k }, (_, i) => (i % 2 ? 'B' : 'A'))))
    );
    expect(seen).toEqual(['A1→B1', 'B1→A2', 'A2→B2', 'B2→A1', 'A1→B1']);
  });

  it('puts the server and receiver on the right of their halves', () => {
    const s = at(['A', 'B']); // B1 serving to A2
    expect(s.serverCourt).toBe('right');
    expect(s.partnerOnRight).toEqual({ a: 2, b: 1 });
  });

  it('in the next game the first receiver is who served to the first server', () => {
    // Game 1 to A 11–0; game 2 opens with B serving. B1 received from A1 in
    // game 1, so B1 now serves to A1.
    const s = at([...times('A', 11), 'B']);
    expect(s.games).toHaveLength(2);
    const opening = at([...times('A', 11)]);
    expect(who(opening)).toBe('B1→A1');
    expect(s.servingSide).toBe('B');
  });

  it('the deciding game reverses the receiving pair at 5', () => {
    // BO5: 2–2 in games, then play to 5–0 in game 5.
    const games = [
      ...times('A', 11),
      ...times('B', 11),
      ...times('A', 11),
      ...times('B', 11),
    ];
    const before = at([...games, ...times('A', 4)]);
    const after = at([...games, ...times('A', 5)]);
    expect(after.endsChange).toBe(true);
    expect(after.receiverSwap).not.toBeNull();
    // Serving continues; the receiver is now the other member of that pair.
    expect(before.gamesWon).toEqual({ a: 2, b: 2 });
    const receivingTeam = after.servingSide === 'A' ? 'B' : 'A';
    expect(after.receiverSwap).toBe(receivingTeam);
    // Game 5 runs the same cycle as game 1 (A1, B1, A2, B2); at 5–0 it is the
    // third turn, A2 serving — normally to B2, but B has reversed its order.
    expect(who(after)).toBe('A2→B1');
    // And it stays reversed for the rest of the game.
    const later = at([...games, ...times('A', 5), 'B', 'B']);
    expect(who(later)).toBe('B1→A1');
  });

  it('singles is unchanged', () => {
    const s = play(tableTennis, ['A', 'B']);
    expect(s.servingSide).toBe('B');
    expect(s.doubles).toBe(false);
  });
});

describe('ends changes', () => {
  it('tennis: after every odd game of the match', () => {
    expect(play(tennisOfficial, loveGame('A')).endsChange).toBe(true);
    expect(play(tennisOfficial, times('A', 8)).endsChange).toBe(false);
    expect(play(tennisOfficial, times('A', 12)).endsChange).toBe(true);
    // Not on a mid-game rally.
    expect(play(tennisOfficial, times('A', 5)).endsChange).toBe(false);
  });

  it('tennis: every six points of a tiebreak', () => {
    const tb = alternatingGames(12);
    expect(play(tennisOfficial, [...tb, ...times('A', 6)]).endsChange).toBe(
      true
    );
    expect(play(tennisOfficial, [...tb, ...times('A', 5)]).endsChange).toBe(
      false
    );
  });

  it('pickleball: at 6 in the deciding game only', () => {
    const cfg = { ...pickleballOfficial, doubles: false };
    // Game 1: A serves to 6 — not the deciding game, no change.
    expect(play(cfg, times('A', 6)).endsChange).toBe(false);
    // 1–1 in games, then A to 6 in game 3.
    const g1 = times('A', 11);
    const g2 = ['B', ...times('B', 11)] as SideId[]; // side-out, then B to 11
    const g3 = ['A', ...times('A', 6)] as SideId[];
    const s = play(cfg, [...g1, ...g2, ...g3]);
    expect(s.gamesWon).toEqual({ a: 1, b: 1 });
    expect(s.games[2]).toEqual({ a: 6, b: 0 });
    expect(s.endsChange).toBe(true);
  });

  it('badminton: at 11 in the deciding game', () => {
    const g = [...times('A', 21), ...times('B', 21), ...times('A', 11)];
    expect(play(badminton21, g).endsChange).toBe(true);
    expect(play(badminton21, times('A', 11)).endsChange).toBe(false);
  });
});

describe('manual game.end and corrections keep positions honest', () => {
  it('a mid-game game.end resets partner positions', () => {
    const s = reduce(
      [start('A', { isDoubles: true }), point('A'), ev('game.end')],
      badminton21
    );
    expect(s.partnerOnRight).toEqual({ a: 1, b: 1 });
    expect(s.serverCourt).toBe('right');
    expect(s.serverSlot).toBe(1);
  });

  it('a tennis correction into a tiebreak serves by the tiebreak rotation', () => {
    // 6–6 with 1 point played in the tiebreak: the second server has it.
    const s = reduce(
      [
        start('A'),
        ev('score.correct', {
          games: [{ a: 6, b: 6 }],
          gamesWon: { a: 0, b: 0 },
          points: { a: 1, b: 0 },
        }),
      ],
      tennisOfficial
    );
    expect(s.inTiebreak).toBe(true);
    // 12 games played → A opens the tiebreak; after one point B serves.
    expect(s.servingSide).toBe('B');
    expect(s.serverCourt).toBe('left');
  });
});

describe('side-out penalty between games', () => {
  it('lands in the next game, not the one just finished', () => {
    const cfg = { ...pickleballOfficial, doubles: false };
    const s = reduce(
      [
        start('A'),
        ...times('A', 11).map(point),
        ev('penalty', { side: 'A', card: 'red' }),
      ],
      cfg
    );
    expect(s.games[0]).toEqual({ a: 11, b: 0 });
    expect(s.games[1]).toEqual({ a: 0, b: 1 });
  });
});

describe('table tennis doubles — the serving pair chooses its first server', () => {
  const tt = (events: RacquetEvent[]) => reduce(events, tableTennis);
  const who = (s: ReturnType<typeof tt>) =>
    `${s.servingSide}${s.serverSlot}→${s.servingSide === 'A' ? 'B' : 'A'}${s.receiverSlot}`;
  const game1ToA = times('A', 11).map(point);

  it('game 2: B picks B2, who serves to the player who served to them', () => {
    // Game 1 ran A1→B1, B1→A2, A2→B2, B2→A1 — so A2 served to B2.
    const s = tt([
      start('A', { isDoubles: true }),
      ...game1ToA,
      ev('game.end'),
      ev('serve.choose', { slot: 2 }),
    ]);
    expect(who(s)).toBe('B2→A2');
    // And the cycle continues from that choice: B2→A2, A2→B1, B1→A1, A1→B2.
    const later = tt([
      start('A', { isDoubles: true }),
      ...game1ToA,
      ev('game.end'),
      ev('serve.choose', { slot: 2 }),
      point('A'),
      point('A'),
    ]);
    expect(who(later)).toBe('A2→B1');
  });

  it('works between games, before "Start game" is tapped', () => {
    const s = tt([
      start('A', { isDoubles: true }),
      ...game1ToA,
      ev('serve.choose', { slot: 2 }),
    ]);
    expect(s.betweenGames).toBe(true);
    expect(who(s)).toBe('B2→A2');
  });

  it('is ignored once the game has started', () => {
    const s = tt([
      start('A', { isDoubles: true }),
      point('A'),
      ev('serve.choose', { slot: 2 }),
    ]);
    expect(s.firstServerByGame).toEqual({});
    expect(who(s)).toBe('A1→B1');
  });

  it('is ignored outside table-tennis doubles', () => {
    const s = reduce(
      [start('A', { isDoubles: true }), ev('serve.choose', { slot: 2 })],
      badminton21
    );
    expect(s.firstServerByGame).toEqual({});
  });
});

describe('decidingPoint — naming the one-rally game', () => {
  const deuce: SideId[] = ['A', 'A', 'A', 'B', 'B', 'B'];

  it('golden point in padel', () => {
    expect(play(padelGolden, deuce).decidingPoint).toBe('golden');
  });

  it('star point at the third deuce, not before', () => {
    expect(play(padelStar, [...deuce, 'A', 'B']).decidingPoint).toBeNull();
    expect(play(padelStar, [...deuce, 'A', 'B', 'B', 'A']).decidingPoint).toBe(
      'star'
    );
  });

  it('deciding point in no-ad tennis, and none under advantage', () => {
    expect(play(tennisMatchTiebreak, deuce).decidingPoint).toBe('deciding');
    expect(play(tennisOfficial, deuce).decidingPoint).toBeNull();
  });

  it('Fast4 tiebreak sudden death at 4–4', () => {
    const at44 = [...alternatingGames(6), ...times('A', 4), ...times('B', 4)];
    expect(play(tennisFast4, at44).decidingPoint).toBe('deciding');
  });

  it('clears once the rally is played', () => {
    expect(play(padelGolden, [...deuce, 'A']).decidingPoint).toBeNull();
  });
});
