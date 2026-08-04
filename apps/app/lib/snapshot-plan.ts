// Snapshot plan for the post-game video render (/m/[id]/render).
//
// Each entry pairs a moment in the uploaded video with the engine-time needed
// to compute the overlay for that moment. The render page walks the plan,
// writes `replayTimeMs` into the reactive state, and rasterizes the overlay —
// so the plan decides which frames the burned-in overlay can ever show.

/** Maps "this video moment" to "this event's ts", one per game. */
export type Anchor = { videoMs: number; eventTs: number };

export type PlanEvent = { ts: number; type: string };

export type SnapshotPlanEntry = { videoTimeSec: number; replayTimeMs: number };

/**
 * Build the plan.
 *
 * Every event gets a frame, not just points. Penalty cards, timeouts,
 * suspensions, team renames and score corrections all change what the theme
 * draws; sampling only at rally ends made them surface a whole rally late — or
 * never, when they were the last thing to happen (a score correction after the
 * final point, or a walkover / retirement ending, neither of which produces a
 * point to hang a frame on).
 *
 * Events belonging to a game with no anchor are skipped — at least one game
 * must be synced before anything can be rendered. (The render page warns when
 * that leaves games out; the overlay freezes across their footage.)
 *
 * KNOWN CONSTRAINT — games are segmented by `game.end` events only, here and
 * in render.vue's `firstPointPerGame`. A `score.correct` that CHANGES the
 * number of games would desynchronize both: its fabricated games emit no
 * game.end, so their events stay pinned to the previous game's anchor. This is
 * unreachable from the app today — ScoreCorrectSheet edits existing games and
 * can't add or remove one (and "reset current game" keeps the count) — so it
 * can only arise from hand-written events. If the sheet ever grows an "add
 * game" affordance, segmentation must switch from counting game.end to
 * deriving each event's game index from an engine replay.
 */
export const buildSnapshotPlan = (
  events: readonly PlanEvent[],
  anchors: Readonly<Record<number, Anchor | null | undefined>>
): SnapshotPlanEntry[] => {
  const plan: SnapshotPlanEntry[] = [];
  let currentGame = 0;

  for (const ev of events) {
    const anchor = anchors[currentGame];
    const t = anchor
      ? (anchor.videoMs + (ev.ts - anchor.eventTs)) / 1000
      : null;

    // game.end closes the current game; everything after it is anchored
    // against the next one. Its own frame still belongs to the game just
    // played, so advance the counter after computing the time.
    if (ev.type === 'game.end') currentGame += 1;
    if (t === null) continue;

    // Clamp pre-anchor events (typically `match.start`, which fires a few
    // seconds before the first rally ends) to t=0, so the initial 0–0 state
    // has a frame at the video's start — otherwise the overlay's first draw is
    // whatever the first POSITIVE-time frame captured (usually 1–0).
    plan.push({ videoTimeSec: Math.max(0, t), replayTimeMs: ev.ts });
  }

  // The consumer (`pickActiveOverlay` in useVideoRenderWebCodecs) walks this
  // array in order and STOPS at the first entry past the current time, so it
  // requires ascending videoTimeSec. Event order alone doesn't guarantee that:
  // anything appended between `game.end` and the next game's first point is
  // timed against the next game's anchor while its ts precedes that anchor, so
  // it lands earlier in the video than the frames before it (and clamps to 0
  // when it goes negative). Left unsorted, the renderer would show that frame
  // over the rest of the previous game and never reach the later ones.
  plan.sort((x, y) => x.videoTimeSec - y.videoTimeSec);

  // Collapse frames sharing a video moment — several clamped to 0, or a card
  // issued in the same millisecond as a point — since they'd rasterize the
  // same overlay twice. Keep the one that replays furthest, so the surviving
  // frame reflects every event up to that instant. Must run after the sort:
  // duplicates are only adjacent once the array is ordered.
  const deduped: SnapshotPlanEntry[] = [];
  for (const entry of plan) {
    const prev = deduped[deduped.length - 1];
    if (prev && prev.videoTimeSec === entry.videoTimeSec) {
      prev.replayTimeMs = Math.max(prev.replayTimeMs, entry.replayTimeMs);
      continue;
    }
    deduped.push(entry);
  }

  return deduped;
};
