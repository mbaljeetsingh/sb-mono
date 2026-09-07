// Tennis and padel — the three-tier `scoring: 'tennis'` mode.
//
// Rallies win POINTS on the 0/15/30/40 ladder, points win GAMES, games win
// SETS. Under this mode the flat fields shift one tier up: `games[i]` holds the
// game score of set i and `gamesWon` counts sets, while the rally tally inside
// the current game lives in `points`.
//
// Padel shares the whole structure and differs on one switch: the GOLDEN POINT
// preset settles 40–40 with a single rally instead of advantages.

import { describe, expect, it } from 'vitest';
import { padelGolden, padelOfficial, tennisOfficial } from '../../../registry';
import type { RacquetConfig, RacquetEvent, SideId } from '../../racquet-shared';
import { pointLabel } from '../../racquet-shared';
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

const play = (cfg: RacquetConfig, winners: SideId[]) =>
  reduce([start('A'), ...winners.map(point)], cfg);

/** Rallies that hand `side` a love game. */
const loveGame = (side: SideId): SideId[] => [side, side, side, side];
/** N consecutive love games to `side`. */
const games = (side: SideId, n: number): SideId[] =>
  Array.from({ length: n }, () => loveGame(side)).flat();
/**
 * N games alternating A, B, A, B… — the only way to reach a level set score,
 * since handing one side six straight ends the set at 6–0 long before 6–6.
 */
const alternatingGames = (n: number): SideId[] =>
  Array.from({ length: n }, (_, i) => loveGame(i % 2 === 0 ? 'A' : 'B')).flat();

describe('tennis — the point ladder', () => {
  it('counts rallies 0/15/30/40 inside a game', () => {
    const labels = [0, 1, 2, 3].map((n) => {
      const s = play(tennisOfficial, Array<SideId>(n).fill('A'));
      return pointLabel(s.points, 'A', s.inTiebreak, tennisOfficial);
    });
    expect(labels).toEqual(['0', '15', '30', '40']);
  });

  it('four points wins a game, and the game lands in the set', () => {
    const s = play(tennisOfficial, loveGame('A'));
    expect(s.points).toEqual({ a: 0, b: 0 });
    expect(s.games[0]).toEqual({ a: 1, b: 0 });
    expect(s.gamesWon).toEqual({ a: 0, b: 0 });
  });

  it('40–40 is deuce, not game point', () => {
    const s = play(tennisOfficial, ['A', 'A', 'A', 'B', 'B', 'B']);
    expect(s.isDeuce).toBe(true);
    expect(s.gamePoint).toEqual({ a: false, b: false });
    expect(pointLabel(s.points, 'A', false, tennisOfficial)).toBe('40');
    expect(pointLabel(s.points, 'B', false, tennisOfficial)).toBe('40');
  });

  it('advantage shows as AD and does not win the game', () => {
    const deuce: SideId[] = ['A', 'A', 'A', 'B', 'B', 'B'];
    const s = play(tennisOfficial, [...deuce, 'A']);
    expect(s.games[0]).toEqual({ a: 0, b: 0 });
    expect(pointLabel(s.points, 'A', false, tennisOfficial)).toBe('AD');
    expect(pointLabel(s.points, 'B', false, tennisOfficial)).toBe('40');
    expect(s.gamePoint).toEqual({ a: true, b: false });
  });

  it('losing the advantage returns to deuce', () => {
    const deuce: SideId[] = ['A', 'A', 'A', 'B', 'B', 'B'];
    const s = play(tennisOfficial, [...deuce, 'A', 'B']);
    expect(s.isDeuce).toBe(true);
    expect(pointLabel(s.points, 'A', false, tennisOfficial)).toBe('40');
  });

  it('two straight from deuce takes the game', () => {
    const deuce: SideId[] = ['A', 'A', 'A', 'B', 'B', 'B'];
    const s = play(tennisOfficial, [...deuce, 'A', 'A']);
    expect(s.games[0]).toEqual({ a: 1, b: 0 });
  });
});

describe('tennis — sets', () => {
  it('six games by two takes the set', () => {
    const s = play(tennisOfficial, games('A', 6));
    expect(s.games[0]).toEqual({ a: 6, b: 0 });
    expect(s.gamesWon).toEqual({ a: 1, b: 0 });
    expect(s.betweenGames).toBe(true);
  });

  it('5–5 keeps playing; 6–5 does not end the set', () => {
    const s = play(tennisOfficial, [...alternatingGames(10), ...games('A', 1)]);
    expect(s.games).toHaveLength(1);
    expect(s.games[0]).toEqual({ a: 6, b: 5 });
    expect(s.gamesWon).toEqual({ a: 0, b: 0 });
  });

  it('7–5 takes the set', () => {
    const s = play(tennisOfficial, [...alternatingGames(10), ...games('A', 2)]);
    expect(s.games[0]).toEqual({ a: 7, b: 5 });
    expect(s.gamesWon).toEqual({ a: 1, b: 0 });
  });

  it('two sets win the match', () => {
    const s = play(tennisOfficial, [...games('A', 6), ...games('A', 6)]);
    expect(s.gamesWon).toEqual({ a: 2, b: 0 });
    expect(s.matchOver).toBe(true);
    expect(s.winner).toBe('A');
  });

  it('set point and match point nest inside game point', () => {
    // A serving for the set at 5–0, 40–0 in the second set of a two-set win.
    const s = play(tennisOfficial, [
      ...games('A', 6), // set 1
      ...games('A', 5), // 5–0 in set 2
      'A',
      'A',
      'A', // 40–0
    ]);
    expect(s.gamePoint).toEqual({ a: true, b: false });
    expect(s.setPoint).toEqual({ a: true, b: false });
    expect(s.matchPoint).toEqual({ a: true, b: false });
  });

  it('game point without set point when the set is not on the line', () => {
    const s = play(tennisOfficial, ['A', 'A', 'A']); // 40–0, 0–0 in games
    expect(s.gamePoint).toEqual({ a: true, b: false });
    expect(s.setPoint).toEqual({ a: false, b: false });
    expect(s.matchPoint).toEqual({ a: false, b: false });
  });
});

describe('tennis — tiebreak', () => {
  const to6All: SideId[] = alternatingGames(12);

  it('6–6 starts a tiebreak', () => {
    const s = play(tennisOfficial, to6All);
    expect(s.games[0]).toEqual({ a: 6, b: 6 });
    expect(s.inTiebreak).toBe(true);
    expect(s.gamesWon).toEqual({ a: 0, b: 0 });
  });

  it('tiebreak points are counted numerically', () => {
    const s = play(tennisOfficial, [...to6All, 'A', 'A']);
    expect(s.points).toEqual({ a: 2, b: 0 });
    expect(pointLabel(s.points, 'A', true, tennisOfficial)).toBe('2');
  });

  it('seven points by two wins the tiebreak and the set 7–6', () => {
    const s = play(tennisOfficial, [...to6All, ...Array<SideId>(7).fill('A')]);
    expect(s.games[0]).toEqual({ a: 7, b: 6 });
    expect(s.gamesWon).toEqual({ a: 1, b: 0 });
    expect(s.inTiebreak).toBe(false);
  });

  it('6–6 in the tiebreak needs a two-point margin', () => {
    const level: SideId[] = [
      ...to6All,
      ...Array<SideId>(6).fill('A'),
      ...Array<SideId>(6).fill('B'),
    ];
    const s = play(tennisOfficial, level);
    expect(s.points).toEqual({ a: 6, b: 6 });
    expect(s.gamesWon).toEqual({ a: 0, b: 0 });
    const seven = play(tennisOfficial, [...level, 'A']);
    expect(seven.gamesWon).toEqual({ a: 0, b: 0 }); // 7–6 is not enough
    const eight = play(tennisOfficial, [...level, 'A', 'A']);
    expect(eight.gamesWon).toEqual({ a: 1, b: 0 });
  });

  it('serve takes one point then alternates every two', () => {
    // A opened the match, so with 12 games played A serves the tiebreak.
    const at = (n: number) =>
      play(tennisOfficial, [...to6All, ...Array<SideId>(n).fill('A')])
        .servingSide;
    expect(at(0)).toBe('A'); // point 1
    expect(at(1)).toBe('B'); // points 2–3
    expect(at(2)).toBe('B');
    expect(at(3)).toBe('A'); // points 4–5
    expect(at(4)).toBe('A');
    expect(at(5)).toBe('B');
  });

  it('the tiebreak counts as a game, so the next set flips the serve', () => {
    const s = play(tennisOfficial, [...to6All, ...Array<SideId>(7).fill('A')]);
    // 13 games played → B serves first in set 2.
    expect(s.servingSide).toBe('B');
  });
});

describe('tennis — service rotation', () => {
  it('serve alternates every game', () => {
    expect(play(tennisOfficial, []).servingSide).toBe('A');
    expect(play(tennisOfficial, games('A', 1)).servingSide).toBe('B');
    expect(play(tennisOfficial, games('A', 2)).servingSide).toBe('A');
  });

  it('the server holds the whole game while the court alternates', () => {
    const s1 = play(tennisOfficial, ['A']);
    expect(s1.servingSide).toBe('A');
    expect(s1.serverCourt).toBe('left'); // 15–0, second rally from the ad court
    const s2 = play(tennisOfficial, ['A', 'B']);
    expect(s2.servingSide).toBe('A');
    expect(s2.serverCourt).toBe('right');
  });

  it('doubles partners alternate service games A1, B1, A2, B2', () => {
    const slots = [0, 1, 2, 3, 4].map((n) => {
      const s = play(tennisOfficial, games('A', n));
      return `${s.servingSide}${s.serverSlot}`;
    });
    expect(slots).toEqual(['A1', 'B1', 'A2', 'B2', 'A1']);
  });

  it('partners hold their halves — the flag never toggles', () => {
    const s = play(tennisOfficial, [...games('A', 3), 'A', 'A']);
    expect(s.partnerOnRight).toEqual({ a: 1, b: 1 });
  });
});

describe('padel', () => {
  it('shares tennis scoring', () => {
    const s = play(padelOfficial, loveGame('A'));
    expect(s.games[0]).toEqual({ a: 1, b: 0 });
  });

  it('is a doubles-only sport', () => {
    expect(padelOfficial.doublesOnly).toBe(true);
    expect(padelGolden.doublesOnly).toBe(true);
  });

  it('golden point: 40–40 is settled by the next rally', () => {
    const deuce: SideId[] = ['A', 'A', 'A', 'B', 'B', 'B'];
    const level = play(padelGolden, deuce);
    // Sudden death, so nobody is "at deuce" — both sides are a rally from the game.
    expect(level.isDeuce).toBe(false);
    expect(level.gamePoint).toEqual({ a: true, b: true });

    const decided = play(padelGolden, [...deuce, 'B']);
    expect(decided.games[0]).toEqual({ a: 0, b: 1 });
  });

  it('advantage preset still plays deuce out', () => {
    const deuce: SideId[] = ['A', 'A', 'A', 'B', 'B', 'B'];
    const s = play(padelOfficial, [...deuce, 'B']);
    expect(s.games[0]).toEqual({ a: 0, b: 0 });
    expect(pointLabel(s.points, 'B', false, padelOfficial)).toBe('AD');
  });
});

describe('tennis — undo and correction', () => {
  it('undo steps back one rally, not one game', () => {
    const events = [start('A'), point('A'), point('A')];
    const before = reduce(events, tennisOfficial);
    expect(before.points).toEqual({ a: 2, b: 0 });
    const undone = reduce(events.slice(0, -1), tennisOfficial);
    expect(undone.points).toEqual({ a: 1, b: 0 });
  });

  it('a correction resets the point tier unless one is supplied', () => {
    const corrected = reduce(
      [
        start('A'),
        point('A'),
        ev('score.correct', {
          games: [{ a: 4, b: 3 }],
          gamesWon: { a: 0, b: 0 },
        }),
      ],
      tennisOfficial
    );
    expect(corrected.games[0]).toEqual({ a: 4, b: 3 });
    expect(corrected.points).toEqual({ a: 0, b: 0 });

    const withPoints = reduce(
      [
        start('A'),
        ev('score.correct', {
          games: [{ a: 4, b: 3 }],
          gamesWon: { a: 0, b: 0 },
          points: { a: 3, b: 1 },
        }),
      ],
      tennisOfficial
    );
    expect(withPoints.points).toEqual({ a: 3, b: 1 });
    expect(withPoints.gamePoint).toEqual({ a: true, b: false });
  });

  it('a correction to 6–6 puts the set into a tiebreak', () => {
    const s = reduce(
      [
        start('A'),
        ev('score.correct', {
          games: [{ a: 6, b: 6 }],
          gamesWon: { a: 0, b: 0 },
        }),
      ],
      tennisOfficial
    );
    expect(s.inTiebreak).toBe(true);
  });
});
