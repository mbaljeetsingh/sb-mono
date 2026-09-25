// Squash — World Squash singles rules (2025): point-a-rally to 11 by two,
// best of five, and the traditional hand-in/hand-out game to 9 with the
// receiver's set-one / set-two choice at 8–all. The server chooses a service
// box at the start of every hand and alternates while retaining serve.

import { describe, expect, it } from 'vitest';
import { squashClassic, squashPar11 } from '../../../registry';
import type { RacquetEvent, SideId } from '../../racquet-shared';
import { reduce } from '../index';

let n = 0;
const ev = (
  type: RacquetEvent['type'],
  extra: Record<string, unknown> = {}
): RacquetEvent =>
  ({ id: `e${n++}`, ts: Date.now() + n, type, ...extra }) as RacquetEvent;
const start = (server: SideId = 'A') =>
  ev('match.start', {
    serverSide: server,
    serverCourt: 'right',
    isDoubles: false,
  });
const point = (side: SideId) => ev('point', { side });
const times = (side: SideId, k: number): SideId[] => Array(k).fill(side);

describe('squash — PAR 11', () => {
  const par = (events: RacquetEvent[]) =>
    reduce([start('A'), ...events], squashPar11);

  it('every rally scores, first to 11 by two, best of five', () => {
    const s = par(times('A', 11).map(point));
    expect(s.gamesWon).toEqual({ a: 1, b: 0 });
    const level = par([...times('A', 10), ...times('B', 10)].map(point));
    expect(level.isDeuce).toBe(true);
    const three = par(times('A', 33).map(point));
    expect(three.matchOver).toBe(true);
  });

  it('the server alternates boxes while holding serve, from the right by default', () => {
    expect(par([]).serverCourt).toBe('right');
    expect(par([point('A')]).serverCourt).toBe('left');
    expect(par([point('A'), point('A')]).serverCourt).toBe('right');
  });

  it('a change of server is a new hand, opening from the right', () => {
    // A wins one (now in the left box), then loses the rally: B serves right.
    const s = par([point('A'), point('B')]);
    expect(s.servingSide).toBe('B');
    expect(s.serverCourt).toBe('right');
  });

  it('the server may choose the box at the start of a hand', () => {
    const s = par([point('A'), point('B'), ev('serve.box', { court: 'left' })]);
    expect(s.serverCourt).toBe('left');
    // …and alternates from there.
    const next = par([
      point('A'),
      point('B'),
      ev('serve.box', { court: 'left' }),
      point('B'),
    ]);
    expect(next.serverCourt).toBe('right');
  });

  it('a box choice mid-hand is ignored', () => {
    const s = par([point('A'), ev('serve.box', { court: 'right' })]);
    expect(s.serverCourt).toBe('left');
  });

  it('the winner of a game serves first in the next, choosing again', () => {
    const s = par(([...times('B', 11), 'A', 'B'] as SideId[]).map(point));
    // B won game 1; game 2 opened with B serving from the right; A won a rally
    // (new hand), then B won it back.
    expect(s.games).toHaveLength(2);
    expect(s.servingSide).toBe('B');
    expect(s.serverCourt).toBe('right');
    const between = par(times('B', 11).map(point));
    expect(between.servingSide).toBe('B');
    expect(between.serverCourt).toBe('right');
  });

  it('has no interval and no change of ends', () => {
    const s = par(
      [
        ...times('A', 11),
        ...times('B', 11),
        ...times('A', 11),
        ...times('B', 11),
        ...times('A', 6),
      ].map(point)
    );
    expect(s.atInterval).toBe(false);
    expect(s.endsChange).toBe(false);
  });
});

describe('squash — classic hand-in/hand-out to 9', () => {
  const classic = (events: RacquetEvent[]) =>
    reduce([start('A'), ...events], squashClassic);

  it('only the server scores; winning as receiver wins the serve', () => {
    const s = classic([point('B')]);
    expect(s.games[0]).toEqual({ a: 0, b: 0 });
    expect(s.servingSide).toBe('B');
    expect(s.serverCourt).toBe('right');
  });

  it('the box alternates on points won on serve', () => {
    expect(classic([point('A')]).serverCourt).toBe('left');
    expect(classic([point('A'), point('A')]).serverCourt).toBe('right');
  });

  /** A to 8, hand-out, B to 8 — A serving at 8–8 with B receiving. */
  const to88: RacquetEvent[] = [
    ...times('A', 8).map(point),
    point('B'), // hand-out
    ...times('B', 8).map(point),
    point('A'), // hand-out back to A
  ];

  it('8–all waits on the receiver; with no choice it is set one', () => {
    const s = classic(to88);
    expect(s.games[0]).toEqual({ a: 8, b: 8 });
    expect(s.awaitingSetChoice).toBe(true);
    // Only the server can score, so only the server is at game point.
    expect(s.gamePoint).toEqual({ a: true, b: false });
    const won = classic([...to88, point('A')]);
    expect(won.gamesWon).toEqual({ a: 1, b: 0 });
  });

  it('set two plays to 10', () => {
    const chosen = classic([...to88, ev('game.target', { to: 10 })]);
    expect(chosen.awaitingSetChoice).toBe(false);
    expect(chosen.gamePoint).toEqual({ a: false, b: false });
    const nine = classic([...to88, ev('game.target', { to: 10 }), point('A')]);
    expect(nine.gamesWon).toEqual({ a: 0, b: 0 });
    const ten = classic([
      ...to88,
      ev('game.target', { to: 10 }),
      point('A'),
      point('A'),
    ]);
    expect(ten.gamesWon).toEqual({ a: 1, b: 0 });
  });

  it('the winner of a game serves first in the next, from the right', () => {
    // B takes the serve, wins game 1 9–0, then serves game 2.
    const s = classic([point('B'), ...times('B', 9).map(point), point('B')]);
    expect(s.games).toHaveLength(2);
    expect(s.games[1]).toEqual({ a: 0, b: 1 });
    expect(s.servingSide).toBe('B');
    const between = classic([point('B'), ...times('B', 9).map(point)]);
    expect(between.servingSide).toBe('B');
    expect(between.serverCourt).toBe('right');
  });

  it('the set choice is ignored at any other score, and reset each game', () => {
    const early = classic([point('A'), ev('game.target', { to: 10 })]);
    expect(early.gameTarget).toBeNull();
    const next = classic([
      ...to88,
      ev('game.target', { to: 10 }),
      point('A'),
      point('A'),
      point('A'),
    ]);
    expect(next.games).toHaveLength(2);
    expect(next.gameTarget).toBeNull();
  });
});
