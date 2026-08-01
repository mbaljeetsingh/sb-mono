// The render page rasterizes the overlay once per plan entry, so anything the
// plan skips can never appear in the burned-in video.
//
// It used to only plan for `point` and `match.start`. Every other state change
// — penalty cards, timeouts, suspensions, score corrections, walkover /
// retirement endings — surfaced a whole rally late, or never at all when it
// was the last thing to happen in the match.

import { describe, expect, it } from 'vitest';
import { type Anchor, buildSnapshotPlan } from '../snapshot-plan';

const T0 = 1_700_000_000_000;
// Game 0 anchored: the first point (T0 + 10s of events) sits at 30s of video.
const anchored: Record<number, Anchor> = {
  0: { videoMs: 30_000, eventTs: T0 + 10_000 },
};

const at = (secondsIntoEvents: number, type: string) => ({
  ts: T0 + secondsIntoEvents * 1000,
  type,
});

/** Which event timestamps got their own frame. */
const framedAt = (plan: { replayTimeMs: number }[]) =>
  plan.map((p) => (p.replayTimeMs - T0) / 1000);

describe('buildSnapshotPlan', () => {
  it('gives a penalty card its own frame instead of waiting for the next point', () => {
    const events = [
      at(0, 'match.start'),
      at(10, 'point'),
      at(20, 'penalty'),
      at(40, 'point'),
    ];
    const plan = buildSnapshotPlan(events, anchored);
    expect(framedAt(plan)).toContain(20);
    // The card lands at 40s of video (20s after the anchored point at 30s),
    // not deferred to the next rally at 60s.
    expect(plan.find((p) => p.replayTimeMs === T0 + 20_000)?.videoTimeSec).toBe(
      40
    );
  });

  it('frames a score correction that is the last event of the match', () => {
    // Previously unreachable: no point follows, so no frame was ever taken and
    // the render kept showing the uncorrected score to the end.
    const events = [
      at(0, 'match.start'),
      at(10, 'point'),
      at(30, 'point'),
      at(35, 'score.correct'),
    ];
    expect(framedAt(buildSnapshotPlan(events, anchored))).toContain(35);
  });

  it('frames a retirement ending, which produces no point', () => {
    const events = [
      at(0, 'match.start'),
      at(10, 'point'),
      at(25, 'retirement'),
    ];
    expect(framedAt(buildSnapshotPlan(events, anchored))).toContain(25);
  });

  it('frames timeouts on both edges', () => {
    const events = [
      at(0, 'match.start'),
      at(10, 'point'),
      at(15, 'timeout.start'),
      at(22, 'timeout.end'),
      at(40, 'point'),
    ];
    const framed = framedAt(buildSnapshotPlan(events, anchored));
    expect(framed).toContain(15);
    expect(framed).toContain(22);
  });

  it('clamps pre-anchor events to the start of the video', () => {
    // match.start fires 10s before the anchored first point, which sits at 30s
    // of video — so it maps to 20s, still positive. Push the anchor earlier and
    // it would go negative; the plan must clamp rather than emit a negative.
    const early: Record<number, Anchor> = {
      0: { videoMs: 2_000, eventTs: T0 + 10_000 },
    };
    const plan = buildSnapshotPlan(
      [at(0, 'match.start'), at(10, 'point')],
      early
    );
    expect(plan.every((p) => p.videoTimeSec >= 0)).toBe(true);
    expect(plan[0]?.videoTimeSec).toBe(0);
  });

  it('collapses events sharing a video moment, keeping the latest state', () => {
    // A card issued in the same millisecond as a point would otherwise
    // rasterize the same overlay twice.
    const events = [at(10, 'point'), at(10, 'penalty')];
    const plan = buildSnapshotPlan(events, anchored);
    expect(plan).toHaveLength(1);
    // The surviving entry replays up to the card, not just the point.
    expect(plan[0]?.replayTimeMs).toBe(T0 + 10_000);
  });

  it('anchors each game separately and keeps game.end with the game it closed', () => {
    const twoGames: Record<number, Anchor> = {
      0: { videoMs: 30_000, eventTs: T0 + 10_000 },
      1: { videoMs: 300_000, eventTs: T0 + 200_000 },
    };
    const events = [
      at(10, 'point'), // game 0 → anchored at 30s
      at(60, 'game.end'), // still game 0 → 80s
      at(200, 'point'), // game 1 → 300s
    ];
    const plan = buildSnapshotPlan(events, twoGames);
    expect(plan.map((p) => p.videoTimeSec)).toEqual([30, 80, 300]);
  });

  it('skips events in games that have no anchor', () => {
    const events = [
      at(10, 'point'), // game 0, anchored
      at(60, 'game.end'),
      at(200, 'point'), // game 1, no anchor → skipped
    ];
    const plan = buildSnapshotPlan(events, anchored);
    expect(plan.map((p) => p.videoTimeSec)).toEqual([30, 80]);
  });

  it('returns nothing when no game is synced', () => {
    expect(buildSnapshotPlan([at(10, 'point')], {})).toEqual([]);
  });

  // pickActiveOverlay (useVideoRenderWebCodecs) walks the plan in order and
  // STOPS at the first entry past the current time, so ascending videoTimeSec
  // is a hard requirement. Event order alone doesn't give it: anything logged
  // between game.end and the next game's first point is timed against the next
  // game's anchor while its ts precedes that anchor.
  describe('ordering', () => {
    const twoGames: Record<number, Anchor> = {
      0: { videoMs: 30_000, eventTs: T0 + 10_000 },
      // Inter-game break trimmed out of the recording: game 2 starts just 5s
      // after game 1 ended on tape, but 140s later by the clock.
      1: { videoMs: 85_000, eventTs: T0 + 200_000 },
    };

    it('sorts a between-games event into place instead of leaving it late', () => {
      const events = [
        at(10, 'point'), // game 0 → 30s
        at(60, 'game.end'), // game 0 → 80s
        at(70, 'score.correct'), // game 1's anchor, ts before it → 85-130 → clamps to 0
        at(200, 'point'), // game 1 → 85s
      ];
      const plan = buildSnapshotPlan(events, twoGames);
      const times = plan.map((p) => p.videoTimeSec);
      expect(times).toEqual([...times].sort((x, y) => x - y));
      // The correction lands at the start rather than after the 80s frame,
      // which is what made the renderer replay it over the rest of game 1.
      expect(times).toEqual([0, 30, 80, 85]);
    });

    it('keeps every plan reachable by an ascending scan', () => {
      const events = [
        at(10, 'point'),
        at(60, 'game.end'),
        at(65, 'penalty'),
        at(70, 'timeout.start'),
        at(200, 'point'),
        at(230, 'point'),
      ];
      const plan = buildSnapshotPlan(events, twoGames);
      // Mirrors pickActiveOverlay's early `break`: with an unsorted plan this
      // stops short and later frames never render.
      const reachable = (tSec: number) => {
        let active = plan[0];
        for (const s of plan) {
          if (s.videoTimeSec <= tSec) active = s;
          else break;
        }
        return active;
      };
      const last = plan[plan.length - 1]!;
      expect(reachable(10_000)).toBe(last);
      expect(reachable(last.videoTimeSec)).toBe(last);
    });

    it('collapses duplicates after sorting, keeping the latest replay time', () => {
      // Two events clamped to 0 from different games must merge into one frame
      // that replays up to the later of the two.
      const events = [
        at(10, 'point'),
        at(60, 'game.end'),
        at(65, 'penalty'), // clamps to 0
        at(70, 'timeout.start'), // clamps to 0 as well
        at(200, 'point'),
      ];
      const plan = buildSnapshotPlan(events, twoGames);
      const atZero = plan.filter((p) => p.videoTimeSec === 0);
      expect(atZero).toHaveLength(1);
      expect(atZero[0]?.replayTimeMs).toBe(T0 + 70_000);
    });
  });
});
