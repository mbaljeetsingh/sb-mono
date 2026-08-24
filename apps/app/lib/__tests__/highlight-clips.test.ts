// Clip selection runs against the real badminton reducer — the score context
// on a card ("20–18 → 21–18") must be what the engine says, not a parallel
// tally. A synthetic BO3 match exercises every kind: game winners, the match
// winner, long-rally gaps, and the anchor mapping into video time.

import { getPreset } from '@sb/engine';
import type { RacquetEvent } from '@sb/engine';
import { describe, expect, it } from 'vitest';
import { buildHighlightClips, clipsToVideo } from '../highlight-clips';
import type { Anchor } from '../snapshot-plan';

const T0 = 1_700_000_000_000;
const { reducer, config } = getPreset('badminton-21');

let seq = 0;
const ev = (
  secondsIntoEvents: number,
  partial: Record<string, unknown>
): RacquetEvent =>
  ({
    id: String(++seq).padStart(10, '0'),
    ts: T0 + secondsIntoEvents * 1000,
    ...partial,
  }) as RacquetEvent;

/**
 * Build a straight-sets match: A wins two 21–0 games. Points land every
 * `gapSec` seconds; `slowRallies` maps a point's ordinal within its game
 * (1-based) to a longer gap for that point.
 */
const straightSetsMatch = (
  gapSec = 20,
  slowRallies: Record<number, Record<number, number>> = {}
): RacquetEvent[] => {
  seq = 0;
  const events: RacquetEvent[] = [
    ev(0, { type: 'match.start', serverSide: 'A', serverCourt: 'right' }),
  ];
  let t = 10;
  for (let game = 0; game < 2; game++) {
    for (let point = 1; point <= 21; point++) {
      t += slowRallies[game]?.[point] ?? gapSec;
      events.push(ev(t, { type: 'point', side: 'A' }));
    }
    if (game === 0) {
      t += 120; // interval between games
      events.push(ev(t, { type: 'game.end' }));
    }
  }
  return events;
};

describe('buildHighlightClips', () => {
  it('finds the game winner and the match winner with engine-true scores', () => {
    const events = straightSetsMatch();
    const clips = buildHighlightClips(events, reducer, config, {
      maxRallies: 0,
    });

    expect(clips.map((c) => c.kind)).toEqual(['game-point', 'match-point']);

    const [g1, mp] = clips;
    expect(g1!.gameIndex).toBe(0);
    expect(g1!.scoreBefore).toEqual({ a: 20, b: 0 });
    expect(g1!.scoreAfter).toEqual({ a: 21, b: 0 });

    expect(mp!.gameIndex).toBe(1);
    expect(mp!.scoreBefore).toEqual({ a: 20, b: 0 });
    expect(mp!.scoreAfter).toEqual({ a: 21, b: 0 });
    expect(mp!.side).toBe('A');
  });

  it('picks the longest gaps as rallies, capped at maxRallies, skipping game winners', () => {
    // Three slow points in game 1 (60s, 45s, 90s) plus a slow game-winning
    // point — the winner must come out as game-point, not double-count as a
    // rally, and only the top two gaps survive maxRallies: 2.
    const events = straightSetsMatch(20, {
      0: { 5: 60, 12: 45, 17: 90, 21: 70 },
    });
    const clips = buildHighlightClips(events, reducer, config, {
      maxRallies: 2,
    });

    const rallies = clips.filter((c) => c.kind === 'long-rally');
    expect(rallies.map((r) => r.gapMs)).toEqual([60_000, 90_000]); // eventTs order
    expect(clips.filter((c) => c.kind === 'game-point')).toHaveLength(1);
    expect(clips.filter((c) => c.kind === 'match-point')).toHaveLength(1);
  });

  it('never reaches a clip window back into the previous rally', () => {
    const events = straightSetsMatch(20, { 0: { 5: 60 } });
    const clips = buildHighlightClips(events, reducer, config, {
      maxRallies: 1,
    });
    const rally = clips.find((c) => c.kind === 'long-rally');
    expect(rally).toBeDefined();
    // Gap 60s − 8s reset estimate = 52s, clamped to the 40s max lookback.
    expect(rally!.eventTs - rally!.startTs).toBe(40_000);
    // A routine 20s gap gets gap − 8s reset estimate = 12s of lookback, which
    // already clears the previous point — the 1s floor doesn't bite.
    const gameWinner = clips.find((c) => c.kind === 'game-point');
    expect(gameWinner!.eventTs - gameWinner!.startTs).toBe(12_000);
  });

  it("a game's first point uses the default lookback and reports no gap", () => {
    // Make game 2's first point slow enough to be a rally candidate — it
    // must not be one, because there is no previous point to measure from.
    const events = straightSetsMatch(20, { 1: { 1: 90 } });
    const clips = buildHighlightClips(events, reducer, config, {
      maxRallies: 5,
    });
    const game2FirstPoint = clips.find(
      (c) => c.gameIndex === 1 && c.kind === 'long-rally' && c.gapMs === null
    );
    expect(game2FirstPoint).toBeUndefined();
  });
});

describe('clipsToVideo', () => {
  it('maps through per-game anchors and drops unanchored games', () => {
    const events = straightSetsMatch();
    const clips = buildHighlightClips(events, reducer, config, {
      maxRallies: 0,
    });
    const game1FirstPointTs = T0 + 30_000; // t=10 start + 20s gap
    const anchors: Record<number, Anchor> = {
      // First point of game 1 at 25s of video.
      0: { videoMs: 25_000, eventTs: game1FirstPointTs },
    };

    const video = clipsToVideo(clips, anchors);
    expect(video).toHaveLength(1); // match point (game 2) dropped — no anchor
    expect(video[0]!.kind).toBe('game-point');

    const gameWinner = clips.find((c) => c.kind === 'game-point');
    const expectedStart = 25_000 + (gameWinner!.startTs - game1FirstPointTs);
    expect(video[0]!.videoStartMs).toBe(expectedStart);
    expect(video[0]!.videoEndMs - video[0]!.videoStartMs).toBe(
      gameWinner!.endTs - gameWinner!.startTs
    );
  });

  it('clamps a window that starts before the video and drops one that collapses', () => {
    const events = straightSetsMatch();
    const clips = buildHighlightClips(events, reducer, config, {
      maxRallies: 0,
    });
    const gameWinner = clips.find((c) => c.kind === 'game-point');
    // Anchor the game winner's point 2s into the video: the 21s lookback
    // clamps to 0 but the window survives; anchoring it at −10s collapses it.
    const survives = clipsToVideo([gameWinner!], {
      0: { videoMs: 2_000, eventTs: gameWinner!.eventTs },
    });
    expect(survives[0]!.videoStartMs).toBe(0);

    const collapsed = clipsToVideo([gameWinner!], {
      0: { videoMs: -10_000, eventTs: gameWinner!.eventTs },
    });
    expect(collapsed).toHaveLength(0);
  });
});
