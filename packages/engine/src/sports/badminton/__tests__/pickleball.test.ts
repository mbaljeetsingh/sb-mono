// Official pickleball — side-out scoring (USA Pickleball).
//
// The rules this file pins down, and why each one is easy to get wrong:
//  - Only the SERVING side scores. A receiving-side rally win moves the serve,
//    never the scoreboard.
//  - Doubles gives a team two servers per turn, so a fault advances 1 → 2 and
//    only the second fault is a side-out. Singles has one.
//  - Each game opens on "0–0–2": the first serving team gets a single server so
//    it can't bank a free fault. The player on the right still serves, so that
//    is a call-out convention rather than a position.
//  - The serving team's partners swap courts on every point they score, which
//    keeps the server's court in step with their score parity (even = right).

import { describe, expect, it } from 'vitest';
import { pickleballClassic, pickleballOfficial } from '../../../registry';
import type { RacquetConfig, RacquetEvent, SideId } from '../../racquet-shared';
import { reduce } from '../index';

let nextId = 0;
const ev = (
  type: RacquetEvent['type'],
  extra: Record<string, unknown> = {}
): RacquetEvent =>
  ({
    id: `e${nextId++}`,
    ts: Date.now() + nextId,
    type,
    ...extra,
  }) as RacquetEvent;

const start = (server: SideId = 'A'): RacquetEvent =>
  ev('match.start', { serverSide: server, serverCourt: 'right' });
const point = (side: SideId): RacquetEvent => ev('point', { side });

const doubles: RacquetConfig = { ...pickleballOfficial, doubles: true };
const singles: RacquetConfig = { ...pickleballOfficial, doubles: false };

/** Rallies won, in order, from a fresh match with A serving. */
const play = (cfg: RacquetConfig, winners: SideId[]) =>
  reduce([start('A'), ...winners.map(point)], cfg);

describe('pickleball side-out — only the serving side scores', () => {
  it('a receiving-side rally win does not change the score', () => {
    const s = play(doubles, ['B']);
    expect(s.games[0]).toEqual({ a: 0, b: 0 });
  });

  it('a serving-side rally win scores', () => {
    const s = play(doubles, ['A']);
    expect(s.games[0]).toEqual({ a: 1, b: 0 });
    expect(s.servingSide).toBe('A');
  });

  it('the receiving team only scores once it has the serve', () => {
    // A faults away the serve (0–0–2 → side-out), then B scores twice.
    const s = play(doubles, ['B', 'B', 'B']);
    expect(s.servingSide).toBe('B');
    expect(s.games[0]).toEqual({ a: 0, b: 2 });
  });
});

describe('pickleball side-out — server number', () => {
  it('doubles opens each game on 0–0–2 with the right-court player serving', () => {
    const s = reduce([start('A')], doubles);
    expect(s.serverNumber).toBe(2);
    expect(s.serverCourt).toBe('right');
    expect(s.serverSlot).toBe(1);
  });

  it('singles has no second server', () => {
    const s = reduce([start('A')], singles);
    expect(s.serverNumber).toBe(1);
  });

  it('the opening fault is an immediate side-out (the 0–0–2 point)', () => {
    const s = play(doubles, ['B']);
    expect(s.servingSide).toBe('B');
    expect(s.serverNumber).toBe(1);
  });

  it('after the first side-out a team gets both of its servers', () => {
    // A faults → B serves as server 1. B faults → B's partner (server 2).
    const s = play(doubles, ['B', 'A']);
    expect(s.servingSide).toBe('B');
    expect(s.serverNumber).toBe(2);
    // Same team, other player, and they serve from where they stand.
    expect(s.serverSlot).toBe(2);
    expect(s.serverCourt).toBe('left');
  });

  it('a second fault hands the serve back', () => {
    const s = play(doubles, ['B', 'A', 'A']);
    expect(s.servingSide).toBe('A');
    expect(s.serverNumber).toBe(1);
  });

  it('singles side-outs on the first fault, every time', () => {
    const s = play(singles, ['B']);
    expect(s.servingSide).toBe('B');
    const back = play(singles, ['B', 'A']);
    expect(back.servingSide).toBe('A');
    expect(back.serverNumber).toBe(1);
  });
});

describe('pickleball side-out — court and partner positions', () => {
  it('partners swap on every point, keeping serve court in score parity', () => {
    // A scores three straight from 0–0–2.
    const one = play(doubles, ['A']);
    expect(one.games[0]).toEqual({ a: 1, b: 0 });
    expect(one.serverCourt).toBe('left'); // score 1 = odd
    expect(one.partnerOnRight.a).toBe(2);
    expect(one.serverSlot).toBe(1); // same human, other court

    const two = play(doubles, ['A', 'A']);
    expect(two.serverCourt).toBe('right'); // score 2 = even
    expect(two.partnerOnRight.a).toBe(1);
    expect(two.serverSlot).toBe(1);
  });

  it("a side-out puts the incoming team's parity player on serve", () => {
    // B takes over at 0 points → even → right court.
    const s = play(doubles, ['B']);
    expect(s.serverCourt).toBe('right');
    expect(s.serverSlot).toBe(1);
  });
});

describe('pickleball side-out — winning', () => {
  it('first to 11 wins the game, but only by two', () => {
    const rallies: SideId[] = [];
    for (let i = 0; i < 10; i++) rallies.push('A'); // 10–0, A still serving
    const at10 = play(doubles, rallies);
    expect(at10.games[0]).toEqual({ a: 10, b: 0 });
    expect(at10.isGamePoint).toBe(true);
    expect(at10.gamePoint).toEqual({ a: true, b: false });

    const won = play(doubles, [...rallies, 'A']);
    expect(won.gamesWon).toEqual({ a: 1, b: 0 });
    expect(won.betweenGames).toBe(true);
  });

  it('a receiver on 10 is not at game point — they cannot score', () => {
    // B reaches 10 while serving, then faults twice to hand A the serve.
    const rallies: SideId[] = ['B']; // side-out to B
    for (let i = 0; i < 10; i++) rallies.push('B'); // B to 10
    rallies.push('A', 'A'); // both of B's servers fault → A serves
    const s = play(doubles, rallies);
    expect(s.games[0]).toEqual({ a: 0, b: 10 });
    expect(s.servingSide).toBe('A');
    expect(s.gamePoint).toEqual({ a: false, b: false });
    expect(s.isGamePoint).toBe(false);
  });

  it('10–10 is deuce and the game runs on to a two-point margin', () => {
    // Alternate service turns, each team scoring 10.
    const rallies: SideId[] = ['B']; // A's single opening server faults
    for (let i = 0; i < 10; i++) rallies.push('B');
    rallies.push('A', 'A'); // B's two servers fault → A serves
    for (let i = 0; i < 10; i++) rallies.push('A');
    const s = play(doubles, rallies);
    expect(s.games[0]).toEqual({ a: 10, b: 10 });
    expect(s.isDeuce).toBe(true);
    expect(s.gamesWon).toEqual({ a: 0, b: 0 });
  });

  it('a new game re-opens on 0–0–2', () => {
    const rallies: SideId[] = [];
    for (let i = 0; i < 11; i++) rallies.push('A');
    const won = play(doubles, rallies);
    expect(won.betweenGames).toBe(true);
    // First rally of game 2 auto-starts it.
    const next = play(doubles, [...rallies, 'A']);
    expect(next.games).toHaveLength(2);
    expect(next.serverNumber).toBe(2);
  });

  it('best of 3 — two games take the match', () => {
    const gameToA: SideId[] = [];
    for (let i = 0; i < 11; i++) gameToA.push('A');
    const s = play(doubles, [...gameToA, ...gameToA]);
    expect(s.gamesWon).toEqual({ a: 2, b: 0 });
    expect(s.matchOver).toBe(true);
    expect(s.winner).toBe('A');
  });
});

describe('pickleball side-out — penalties', () => {
  it('a red card awards a point rather than a side-out', () => {
    // B is serving (A faulted away the opening serve); a red card against B
    // must credit A a point even though A is receiving.
    const s = reduce(
      [start('A'), point('B'), ev('penalty', { side: 'B', card: 'red' })],
      doubles
    );
    expect(s.games[0]).toEqual({ a: 1, b: 0 });
    expect(s.servingSide).toBe('B');
    expect(s.cards.b.red).toBe(1);
  });

  it('a point handed to the RECEIVERS leaves the serving positions alone', () => {
    const before = play(doubles, ['B', 'B']);
    const after = reduce(
      [
        start('A'),
        point('B'),
        point('B'),
        ev('penalty', { side: 'B', card: 'red' }),
      ],
      doubles
    );
    expect(after.games[0]).toEqual({ a: 1, b: 1 });
    expect(after.serverCourt).toBe(before.serverCourt);
    expect(after.partnerOnRight).toEqual(before.partnerOnRight);
  });

  it('a point handed to the SERVERS moves them like a won rally', () => {
    // B serving at 0-2 from the right court (even). The card takes them to 3,
    // so the server must cross to the left court with their partner —
    // serverCourt is tracked transitionally, and leaving it behind put the
    // serve pill on the wrong player, in the wrong court, for the rest of the
    // game as each later rally flipped it from the stale value.
    const rallies: SideId[] = ['B', 'B', 'B'];
    const before = play(doubles, rallies);
    expect(before.games[0]).toEqual({ a: 0, b: 2 });
    expect(before.serverCourt).toBe('right');

    const after = reduce(
      [
        start('A'),
        ...rallies.map(point),
        ev('penalty', { side: 'A', card: 'red' }),
      ],
      doubles
    );
    expect(after.games[0]).toEqual({ a: 0, b: 3 });
    // Odd score → the server is in the left court, and it is the same human.
    expect(after.serverCourt).toBe('left');
    expect(after.serverSlot).toBe(before.serverSlot);
    expect(after.partnerOnRight.b).not.toBe(before.partnerOnRight.b);
    expect(after.servingSide).toBe('B');
  });
});

describe('pickleball side-out — score corrections', () => {
  it('keeps the second server in their own court, not the parity court', () => {
    // A faults away the opening serve, then B's first server faults too, so B
    // is on server 2 — standing in the court OPPOSITE their score parity.
    const base = [start('A'), point('B'), point('A')];
    const before = reduce(base, doubles);
    expect(before.serverNumber).toBe(2);
    expect(before.serverCourt).toBe('left');

    const after = reduce(
      [
        ...base,
        ev('score.correct', {
          games: [{ a: 0, b: 4 }],
          gamesWon: { a: 0, b: 0 },
        }),
      ],
      doubles
    );
    expect(after.games[0]).toEqual({ a: 0, b: 4 });
    expect(after.serverNumber).toBe(2);
    // Parity of 4 is the right court, so server 2 stands in the left one.
    expect(after.serverCourt).toBe('left');
    expect(after.serverSlot).toBe(2);
  });

  it('a correction back to 0-0 re-opens the game on 0-0-2', () => {
    const s = reduce(
      [
        start('A'),
        point('A'),
        ev('score.correct', {
          games: [{ a: 0, b: 0 }],
          gamesWon: { a: 0, b: 0 },
        }),
      ],
      doubles
    );
    expect(s.serverNumber).toBe(2);
    expect(s.serverCourt).toBe('right');
    expect(s.serverSlot).toBe(1);
  });

  it('singles is unaffected by the second-server rule', () => {
    const s = reduce(
      [
        start('A'),
        point('A'),
        ev('score.correct', {
          games: [{ a: 3, b: 1 }],
          gamesWon: { a: 0, b: 0 },
        }),
      ],
      singles
    );
    expect(s.serverNumber).toBe(1);
    // A serving on 3 (odd) → left court.
    expect(s.serverCourt).toBe('left');
  });
});

describe('pickleball rally variant (simplified) is unaffected', () => {
  it('every rally scores for its winner', () => {
    const s = reduce(
      [start('A'), point('B'), point('B'), point('A')],
      pickleballClassic
    );
    expect(s.games[0]).toEqual({ a: 1, b: 2 });
    expect(s.servingSide).toBe('A');
  });
});
