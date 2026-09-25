import { describe, expect, it } from 'vitest';
import { tableTennis, tableTennis21 } from '../../../registry';
import type { RacquetEvent, SideId } from '../../racquet-shared';
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

describe('table tennis serve rule (alternate-every-2)', () => {
  it('serve does not pass on the 1st point', () => {
    // A serves, B wins point 1. A still serves point 2.
    const s = reduce([start('A'), point('B')], tableTennis);
    expect(s.servingSide).toBe('A');
    expect(s.games[0]).toEqual({ a: 0, b: 1 });
  });

  it('serve switches after 2 combined points', () => {
    // After two points (any split), B serves.
    const s = reduce([start('A'), point('A'), point('B')], tableTennis);
    expect(s.games[0]).toEqual({ a: 1, b: 1 });
    expect(s.servingSide).toBe('B');
  });

  it('serve switches back after 4 combined points', () => {
    const s = reduce(
      [start('A'), point('A'), point('A'), point('B'), point('B')],
      tableTennis
    );
    expect(s.games[0]).toEqual({ a: 2, b: 2 });
    expect(s.servingSide).toBe('A');
  });

  it('at deuce (10-10), serve alternates every single point', () => {
    // Build to 10-10 with A serving initially.
    const seq: RacquetEvent[] = [start('A')];
    for (let i = 0; i < 10; i++) seq.push(point('A'));
    for (let i = 0; i < 10; i++) seq.push(point('B'));
    const at1010 = reduce(seq, tableTennis);
    expect(at1010.games[0]).toEqual({ a: 10, b: 10 });
    // 20 combined points, even → game's initial server (A).
    expect(at1010.servingSide).toBe('A');

    const after11 = reduce([...seq, point('A')], tableTennis);
    expect(after11.servingSide).toBe('B');

    const after12 = reduce([...seq, point('A'), point('B')], tableTennis);
    expect(after12.servingSide).toBe('A');
  });

  it('initial server alternates each game', () => {
    // Win game 1 for A: A scores 11 in a row (B serves on points 3-4, 7-8, 11
    // but loses every rally — engine doesn't care about server identity for
    // who scored).
    const seq: RacquetEvent[] = [start('A')];
    for (let i = 0; i < 11; i++) seq.push(point('A'));
    const afterGame1 = reduce(seq, tableTennis);
    expect(afterGame1.gamesWon).toEqual({ a: 1, b: 0 });
    expect(afterGame1.betweenGames).toBe(true);
    // Game 2 starts with B serving (initial alternates).
    expect(afterGame1.servingSide).toBe('B');

    // First point of game 2: server stays as B (no rotation on point 1).
    const intoGame2 = reduce([...seq, point('A')], tableTennis);
    expect(intoGame2.games).toHaveLength(2);
    expect(intoGame2.games[1]).toEqual({ a: 1, b: 0 });
    expect(intoGame2.servingSide).toBe('B');

    // After 2 combined points in game 2, server flips back to A.
    const game2TwoPoints = reduce(
      [...seq, point('A'), point('A')],
      tableTennis
    );
    expect(game2TwoPoints.servingSide).toBe('A');
  });

  it('11-9 wins the game; 10-10 needs win-by-2', () => {
    // A reaches 11-9.
    const seq: RacquetEvent[] = [start('A')];
    for (let i = 0; i < 11; i++) seq.push(point('A'));
    for (let i = 0; i < 9; i++) seq.push(point('B'));
    // Build score 9-9, then A 10, B 10, A 11, A win? Let's construct precisely.
    const events: RacquetEvent[] = [start('A')];
    // 9-9
    for (let i = 0; i < 9; i++) {
      events.push(point('A'));
      events.push(point('B'));
    }
    const at99 = reduce(events, tableTennis);
    expect(at99.games[0]).toEqual({ a: 9, b: 9 });
    expect(at99.gamesWon).toEqual({ a: 0, b: 0 });

    // A 10, B 10 — still 10-10, not over.
    const at1010 = reduce([...events, point('A'), point('B')], tableTennis);
    expect(at1010.games[0]).toEqual({ a: 10, b: 10 });
    expect(at1010.gamesWon).toEqual({ a: 0, b: 0 });

    // A 11, B 10 — still need win-by-2.
    const at1110 = reduce(
      [...events, point('A'), point('B'), point('A')],
      tableTennis
    );
    expect(at1110.gamesWon).toEqual({ a: 0, b: 0 });

    // A 12, B 10 — A wins game.
    const at1210 = reduce(
      [...events, point('A'), point('B'), point('A'), point('A')],
      tableTennis
    );
    expect(at1210.gamesWon).toEqual({ a: 1, b: 0 });
    expect(at1210.betweenGames).toBe(true);
  });

  it('best-of-5 ends at 3 games won', () => {
    const winGame = (side: SideId): RacquetEvent[] => {
      const seq: RacquetEvent[] = [];
      for (let i = 0; i < 11; i++) seq.push(point(side));
      return seq;
    };
    const s = reduce(
      [start('A'), ...winGame('A'), ...winGame('A'), ...winGame('A')],
      tableTennis
    );
    expect(s.gamesWon).toEqual({ a: 3, b: 0 });
    expect(s.matchOver).toBe(true);
    expect(s.winner).toBe('A');
  });
});

// The pre-2001 game, still what most clubs play: 21 points, serve every 5, and
// single serves from 20–20.
describe('table tennis classic 21 (serve every 5)', () => {
  it('the same side serves the first five points', () => {
    const seq: RacquetEvent[] = [start('A')];
    for (let i = 0; i < 4; i++) {
      seq.push(point('B'));
      expect(reduce(seq, tableTennis21).servingSide).toBe('A');
    }
  });

  it('serve passes after 5 combined points', () => {
    const seq: RacquetEvent[] = [start('A')];
    for (let i = 0; i < 5; i++) seq.push(point('B'));
    expect(reduce(seq, tableTennis21).servingSide).toBe('B');
  });

  it('serve comes back after 10 combined points', () => {
    const seq: RacquetEvent[] = [start('A')];
    for (let i = 0; i < 10; i++) seq.push(point('B'));
    expect(reduce(seq, tableTennis21).servingSide).toBe('A');
  });

  it('from 20–20 the serve alternates every single point', () => {
    const seq: RacquetEvent[] = [start('A')];
    for (let i = 0; i < 20; i++) seq.push(point('A'));
    for (let i = 0; i < 20; i++) seq.push(point('B'));
    const at2020 = reduce(seq, tableTennis21);
    expect(at2020.games[0]).toEqual({ a: 20, b: 20 });
    expect(at2020.isDeuce).toBe(true);
    const a = at2020.servingSide;
    const next = reduce([...seq, point('A')], tableTennis21);
    expect(next.servingSide).not.toBe(a);
  });

  it('21 by two wins the game', () => {
    const seq: RacquetEvent[] = [start('A')];
    for (let i = 0; i < 21; i++) seq.push(point('A'));
    const s = reduce(seq, tableTennis21);
    expect(s.gamesWon).toEqual({ a: 1, b: 0 });
  });
});
