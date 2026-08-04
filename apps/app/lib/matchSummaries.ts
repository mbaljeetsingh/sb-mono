import {
  type RacquetConfig,
  type RacquetEvent,
  type RacquetState,
  getPreset,
} from '@sb/engine';
import type { Database } from '@sb/shared';
// Compact per-match summaries (status + scoreline) for list/card contexts —
// the /matches rows and the home page's recent-match card. One batched
// events fetch for all requested matches, then a pure engine reduce per
// match. This module is fetch-only; liveness is the caller's choice —
// /matches layers a Realtime events subscription on top and re-calls this
// per match, while the home card stays a mount-time snapshot.
import type { SupabaseClient } from '@supabase/supabase-js';

export type MatchStatus = 'ready' | 'live' | 'final';

// One definition of "has this match actually started", shared by every surface
// that badges a match. Opening /control seeds a `match.start` event, so "the
// log is non-empty" is not the same question — a match nobody has scored a
// rally in is still `ready`, and the /m/[id] hero card used to badge it LIVE
// (with a pulsing dot) directly beside its own "Ready · 0 events".
export const matchStatusFrom = (
  state: Pick<RacquetState, 'matchOver' | 'games' | 'gamesWon'>,
  endedAt?: string | null
): MatchStatus => {
  if (state.matchOver || endedAt) return 'final';
  const played =
    state.games.some((g) => g.a > 0 || g.b > 0) ||
    state.gamesWon.a > 0 ||
    state.gamesWon.b > 0;
  return played ? 'live' : 'ready';
};

export type MatchSummary = {
  status: MatchStatus;
  /** Compact scoreline — live multi-game: "1–0 · 14–11" (games won · current
   *  game); final multi-game: "2–0"; single-game: just the points. */
  scoreline: string | null;
  winner: 'A' | 'B' | null;
};

export type SummaryInput = {
  id: string;
  sport_preset: string;
  config: { gamesToWin?: number } | null;
  ended_at?: string | null;
};

type EventRow = {
  match_id: string;
  id: string;
  ts: string;
  type: string;
  payload: Record<string, unknown> | null;
};

const fromEventRow = (row: EventRow): RacquetEvent =>
  ({
    id: row.id,
    ts: Date.parse(row.ts),
    type: row.type,
    ...(row.payload ?? {}),
  }) as RacquetEvent;

const summarize = (
  state: RacquetState,
  config: RacquetConfig,
  endedAt: string | null | undefined
): MatchSummary => {
  const status = matchStatusFrom(state, endedAt);
  const cur = state.games[state.games.length - 1] ?? { a: 0, b: 0 };
  const multiGame = config.gamesToWin > 1;
  if (status === 'final') {
    // A walkover called before the first rally ends the match with every game
    // still 0–0. Printing that as the scoreline claims a nil-nil result nobody
    // played, so drop it and let the winner carry the row. (A walkover or
    // retirement *mid*-match keeps its real partial score and still prints.)
    const played = state.games.some((g) => g.a > 0 || g.b > 0);
    return {
      status: 'final',
      scoreline: played
        ? multiGame
          ? `${state.gamesWon.a}–${state.gamesWon.b}`
          : `${cur.a}–${cur.b}`
        : null,
      winner: state.winner,
    };
  }
  // `ready` carries no scoreline: 0–0 is not a result, and every consumer
  // (list row, home card) already treats a null scoreline as "nothing to show".
  if (status === 'ready') {
    return { status, scoreline: null, winner: null };
  }
  return {
    status: 'live',
    scoreline: multiGame
      ? `${state.gamesWon.a}–${state.gamesWon.b} · ${cur.a}–${cur.b}`
      : `${cur.a}–${cur.b}`,
    winner: null,
  };
};

export async function fetchMatchSummaries(
  supabase: SupabaseClient<Database>,
  matches: SummaryInput[]
): Promise<Map<string, MatchSummary>> {
  const out = new Map<string, MatchSummary>();
  if (!matches.length) return out;

  const { data, error } = await supabase
    .from('events')
    .select('match_id, id, ts, type, payload')
    .in(
      'match_id',
      matches.map((m) => m.id)
    );
  if (error) {
    console.warn('[matchSummaries] events fetch failed', error);
    return out;
  }

  const byMatch = new Map<string, RacquetEvent[]>();
  for (const row of (data ?? []) as EventRow[]) {
    const list = byMatch.get(row.match_id);
    const ev = fromEventRow(row);
    if (list) list.push(ev);
    else byMatch.set(row.match_id, [ev]);
  }

  for (const m of matches) {
    const events = (byMatch.get(m.id) ?? []).sort((a, b) =>
      a.id < b.id ? -1 : a.id > b.id ? 1 : 0
    );
    if (!events.length) {
      out.set(m.id, {
        status: m.ended_at ? 'final' : 'ready',
        scoreline: null,
        winner: null,
      });
      continue;
    }
    const preset = getPreset(m.sport_preset);
    const config: RacquetConfig = {
      ...preset.config,
      gamesToWin: m.config?.gamesToWin ?? preset.config.gamesToWin,
    };
    out.set(
      m.id,
      summarize(preset.reducer(events, config), config, m.ended_at)
    );
  }
  return out;
}
