// Highlight clip selection for the post-game render (/m/[id]/render).
//
// Derives clip windows from the event log by replaying the sport's reducer up
// to each point, so score context matches the engine exactly — undo trims and
// score.correct resets are whatever the engine says they are, not a parallel
// hand-tracked score that can drift. The log the render page loads has undone
// points hard-deleted already (see useReplayState), so a `point` event here is
// a point that stood.
//
// Replaying per point is O(n²) in event count, which is fine at match scale
// (~200 events → tens of thousands of cheap reducer iterations, run once per
// log load, never per frame).
//
// What counts as a highlight, with zero video analysis:
//   - match-point  — the point that ends the match (endReason 'normal').
//   - game-point   — the point that wins a game (except the match winner).
//   - point-saved  — the losing side of a game/match point wins the rally
//                    instead (engine's side-attributed gamePoint/matchPoint).
//   - clutch       — a point played from deuce (engine isDeuce: 20–20 for
//                    BWF-21 etc.). Deuce is mutually exclusive with GP/MP by
//                    construction, so clutch never shadows a save or a winner.
//   - long-rally   — top N points by time since the previous point in the same
//                    game. The gap is rally length + reset time, so a long gap
//                    is a long rally; shot counts don't exist in the log.
// "Funny" is not derivable from the log — the page covers it with manual
// markers placed on the timeline (video-time domain, not event domain).

import type { RacquetConfig, RacquetEvent, RacquetState } from '@sb/engine';
import type { Anchor } from './snapshot-plan';

export type RacquetReducer = (
  events: RacquetEvent[],
  cfg: RacquetConfig
) => RacquetState;

export type HighlightKind =
  'match-point' | 'game-point' | 'point-saved' | 'clutch' | 'long-rally';

/** Everything a card/band can be: engine-derived kinds plus operator-added. */
export type ClipKind = HighlightKind | 'manual';

/** Shared presentation metadata per kind — one source for the timeline
 * bands, the legend, and the card chips, so adding or recoloring a kind is
 * a one-place change. Band/chip classes are Tailwind utilities backed by
 * theme tokens. */
export const clipKindMeta: Record<
  ClipKind,
  { label: string; bandClass: string; chipClass: string }
> = {
  'match-point': {
    label: 'Match point',
    bandClass: 'bg-match-point',
    chipClass: 'text-match-point border-match-point/40 bg-match-point/15',
  },
  'game-point': {
    label: 'Game point',
    bandClass: 'bg-game-point',
    chipClass: 'text-game-point border-game-point/40 bg-game-point/15',
  },
  'point-saved': {
    label: 'Saved',
    bandClass: 'bg-success',
    chipClass: 'text-success border-success/40 bg-success/15',
  },
  clutch: {
    label: 'Clutch',
    bandClass: 'bg-warning',
    chipClass: 'text-warning border-warning/40 bg-warning/15',
  },
  'long-rally': {
    label: 'Long rally',
    bandClass: 'bg-primary',
    chipClass: 'text-primary border-primary/40 bg-primary/15',
  },
  manual: {
    label: 'Added by you',
    bandClass: 'bg-info',
    chipClass: 'text-info border-info/40 bg-info/15',
  },
};

/** m:ss for video positions/durations. */
export const formatClockMs = (ms: number): string => {
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

export type GamePair = { a: number; b: number };

export type HighlightClip = {
  /** The winning point's event id — stable across recomputes. */
  id: string;
  kind: HighlightKind;
  /** 0-based game the point belongs to (same segmentation as snapshot-plan). */
  gameIndex: number;
  /** The point event's ts (epoch ms). */
  eventTs: number;
  /** Event-time window (epoch ms). */
  startTs: number;
  endTs: number;
  scoreBefore: GamePair;
  scoreAfter: GamePair;
  /** Who won the point. */
  side: 'A' | 'B';
  /** ms since the previous point in the same game; null for a game's first point. */
  gapMs: number | null;
  /** point-saved only: whether the point erased a game point or a match point. */
  saved?: 'game' | 'match';
};

export type VideoHighlightClip = HighlightClip & {
  videoStartMs: number;
  videoEndMs: number;
};

// Clip-window heuristics. The gap between two points is reset time (retrieve
// the shuttle, towel, serve prep) followed by the rally, so the clip takes the
// gap minus an estimated reset, clamped to something watchable. All values in
// event-time ms; the operator can't trim clips yet, so err on including the
// rally's start over cutting it.
const POST_ROLL_MS = 4_000;
const RESET_ESTIMATE_MS = 8_000;
const MIN_LOOKBACK_MS = 10_000;
const MAX_LOOKBACK_MS = 40_000;
const FIRST_POINT_LOOKBACK_MS = 15_000;
/** A gap must be at least this long to qualify as a long rally. */
const LONG_RALLY_MIN_GAP_MS = 25_000;

const DEFAULT_MAX_RALLIES = 3;

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

export const buildHighlightClips = (
  events: readonly RacquetEvent[],
  reducer: RacquetReducer,
  config: RacquetConfig,
  opts: { maxRallies?: number } = {}
): HighlightClip[] => {
  const maxRallies = opts.maxRallies ?? DEFAULT_MAX_RALLIES;

  const winners: HighlightClip[] = [];
  const rallyCandidates: HighlightClip[] = [];

  let gameIndex = 0;
  let lastPointTs: number | null = null;

  for (let i = 0; i < events.length; i++) {
    const ev = events[i]!;

    // Same segmentation rule as buildSnapshotPlan: game.end closes the
    // current game; its own moment still belongs to the game just played.
    if (ev.type === 'game.end') {
      gameIndex += 1;
      lastPointTs = null;
      continue;
    }
    if (ev.type !== 'point') continue;

    const prevState = reducer(events.slice(0, i), config);
    const nextState = reducer(events.slice(0, i + 1), config);

    const scoreBefore: GamePair = prevState.games[gameIndex] ?? { a: 0, b: 0 };
    const scoreAfter: GamePair = nextState.games[gameIndex] ?? scoreBefore;

    const gapMs = lastPointTs === null ? null : ev.ts - lastPointTs;
    const lookback =
      gapMs === null
        ? FIRST_POINT_LOOKBACK_MS
        : clamp(gapMs - RESET_ESTIMATE_MS, MIN_LOOKBACK_MS, MAX_LOOKBACK_MS);
    // Never reach back into the previous rally's footage.
    const startTs =
      lastPointTs === null
        ? ev.ts - lookback
        : Math.max(ev.ts - lookback, lastPointTs + 1_000);

    const clip: Omit<HighlightClip, 'kind'> = {
      id: ev.id,
      gameIndex,
      eventTs: ev.ts,
      startTs,
      endTs: ev.ts + POST_ROLL_MS,
      scoreBefore,
      scoreAfter,
      side: ev.side,
      gapMs,
    };

    // A point event that flips matchOver IS a normal completion — walkover /
    // retirement / default end the match through their own event types and
    // never reach this branch. (endReason can't gate this: the reducer only
    // sets it for those terminal events, so a match scored to completion
    // carries endReason null.)
    const wonMatch = !prevState.matchOver && nextState.matchOver;
    const wonGame =
      nextState.gamesWon.a + nextState.gamesWon.b >
      prevState.gamesWon.a + prevState.gamesWon.b;

    // The loser of this rally, prevState-keyed: if THEY were a point from the
    // game/match and the winner took the rally anyway, that's a save.
    const loser = ev.side === 'A' ? 'b' : 'a';

    if (wonMatch) {
      winners.push({ ...clip, kind: 'match-point' });
    } else if (wonGame) {
      winners.push({ ...clip, kind: 'game-point' });
    } else if (prevState.matchPoint[loser]) {
      winners.push({ ...clip, kind: 'point-saved', saved: 'match' });
    } else if (prevState.gamePoint[loser]) {
      winners.push({ ...clip, kind: 'point-saved', saved: 'game' });
    } else if (prevState.isDeuce) {
      winners.push({ ...clip, kind: 'clutch' });
    } else if (gapMs !== null && gapMs >= LONG_RALLY_MIN_GAP_MS) {
      rallyCandidates.push({ ...clip, kind: 'long-rally' });
    }

    lastPointTs = ev.ts;
  }

  const rallies = rallyCandidates
    .sort((a, b) => (b.gapMs ?? 0) - (a.gapMs ?? 0))
    .slice(0, maxRallies);

  return [...winners, ...rallies].sort((a, b) => a.eventTs - b.eventTs);
};

/**
 * Map event-time clips onto video time through the per-game anchors — the same
 * "anchor.videoMs + (ts − anchor.eventTs)" mapping buildSnapshotPlan uses.
 * Clips in unanchored games are dropped (nothing can place them in the video),
 * and windows that collapse after the pre-video clamp are dropped too.
 */
export const clipsToVideo = (
  clips: readonly HighlightClip[],
  anchors: Readonly<Record<number, Anchor | null | undefined>>
): VideoHighlightClip[] =>
  clips.flatMap((clip) => {
    const anchor = anchors[clip.gameIndex];
    if (!anchor) return [];
    const toVideo = (ts: number) => anchor.videoMs + (ts - anchor.eventTs);
    const videoStartMs = Math.max(0, toVideo(clip.startTs));
    const videoEndMs = toVideo(clip.endTs);
    if (videoEndMs <= videoStartMs) return [];
    return [{ ...clip, videoStartMs, videoEndMs }];
  });
