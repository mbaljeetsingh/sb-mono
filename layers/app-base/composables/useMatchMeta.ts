import type { Json } from '@sb/shared';
import { watchDebounced } from '@vueuse/core';
import { type Ref, computed, onMounted, onUnmounted, ref, watch } from 'vue';

// useMatchMeta — per-match display metadata (team / player names + tournament
// info). Backed by the `matches` row in Supabase + a Realtime UPDATE
// subscription so any device that opens the match URL stays live-in-sync
// with the operator's edits (typo fix on phone → OBS overlay re-renders).
//
// Write path: deep watch on `meta` → debounced UPDATE.
// Read path: initial fetch on mount + Realtime UPDATE listener thereafter.
// Echo prevention: track the last-seen-remote snapshot; update skips when
// the current state equals what we just received from Supabase, breaking
// the write-back loop without time-based heuristics.
//
// Events (the scoring stream) keep their localStorage-first pattern in
// useEvents — that asymmetry is intentional. Meta is rarely edited but
// needs cross-device consistency; events tap-rate + offline tolerance
// justifies a separate caching strategy there.

export type MatchMeta = {
  sport?: string;
  sportPreset?: string;
  isDoubles?: boolean;
  teamNames?: { a: string; b: string };
  players?: { a1: string; a2: string; b1: string; b2: string };
  /** Tournament metadata surfaced by themes (e.g., "Quarterfinal", "Mixed Doubles", "Court 1"). */
  eventName?: string;
  round?: string;
  category?: string;
  courtLabel?: string;
};

// Display-only title case. "alice smith" → "Alice Smith", "alice / bob" →
// "Alice / Bob". Unicode-aware. Storage keeps user input as-is.
const titleCase = (s: string) =>
  s ? s.replace(/(^|[^\p{L}])(\p{L})/gu, (_, p, c) => p + c.toUpperCase()) : s;

const fromRow = (row: {
  sport_preset?: string | null;
  is_doubles?: boolean | null;
  team_name_a?: string | null;
  team_name_b?: string | null;
  players?: Json | null;
  event_name?: string | null;
  round?: string | null;
  category?: string | null;
  court_label?: string | null;
}): MatchMeta => {
  const p = (row.players ?? {}) as Partial<MatchMeta['players']>;
  return {
    sport: 'racquet',
    sportPreset: row.sport_preset ?? undefined,
    isDoubles: row.is_doubles ?? false,
    teamNames: {
      a: row.team_name_a ?? '',
      b: row.team_name_b ?? '',
    },
    players: {
      a1: p?.a1 ?? '',
      a2: p?.a2 ?? '',
      b1: p?.b1 ?? '',
      b2: p?.b2 ?? '',
    },
    eventName: row.event_name ?? undefined,
    round: row.round ?? undefined,
    category: row.category ?? undefined,
    courtLabel: row.court_label ?? undefined,
  };
};

export function useMatchMeta(matchId: Ref<string>) {
  const supabase = useSupabaseClient();
  const meta = ref<MatchMeta>({});
  // Snapshot of the last value applied from Supabase. The watch-driven
  // update compares to this and skips when they match — that's how we
  // suppress the originator's own UPDATE echoing back as a duplicate write.
  let lastSeenRemote: string | null = null;
  let realtimeChannel: ReturnType<typeof supabase.channel> | null = null;
  // Per-instance unique channel-name suffix — prevents collision when two
  // pages with the same matchId mount in overlapping lifecycles (e.g.
  // navigation /control → /m/[id]). See useEvents for the full rationale.
  const channelSuffix = Math.random().toString(36).slice(2, 10);

  const applyRemote = (row: Parameters<typeof fromRow>[0]) => {
    const incoming = fromRow(row);
    const incomingStr = JSON.stringify(incoming);
    if (incomingStr === JSON.stringify(meta.value)) return;
    lastSeenRemote = incomingStr;
    meta.value = incoming;
  };

  const fetchRemote = async () => {
    const id = matchId.value;
    if (!id) return;
    const { data, error } = await supabase
      .from('matches')
      .select(
        'sport_preset, is_doubles, team_name_a, team_name_b, players, event_name, round, category, court_label'
      )
      .eq('id', id)
      .maybeSingle();
    if (error) {
      console.warn('[useMatchMeta] fetch failed', error);
      return;
    }
    if (data) applyRemote(data);
  };

  const updateRemote = async () => {
    const id = matchId.value;
    if (!id) return;
    const m = meta.value;
    // Empty-content guard — don't create a stub row just because a viewer
    // mounted the composable with nothing to persist (e.g. overlay-only).
    const hasContent =
      m.teamNames?.a ||
      m.teamNames?.b ||
      m.players?.a1 ||
      m.players?.a2 ||
      m.players?.b1 ||
      m.players?.b2 ||
      m.eventName ||
      m.round ||
      m.category ||
      m.courtLabel;
    if (!hasContent) return;
    // Echo guard — current state was just hydrated from Supabase; nothing
    // new to push back. Realtime UPDATE round-trips of our own writes are
    // skipped here so we don't loop.
    const currentStr = JSON.stringify({
      sport: 'racquet',
      sportPreset: m.sportPreset,
      isDoubles: m.isDoubles ?? false,
      teamNames: { a: m.teamNames?.a ?? '', b: m.teamNames?.b ?? '' },
      players: {
        a1: m.players?.a1 ?? '',
        a2: m.players?.a2 ?? '',
        b1: m.players?.b1 ?? '',
        b2: m.players?.b2 ?? '',
      },
      eventName: m.eventName,
      round: m.round,
      category: m.category,
      courtLabel: m.courtLabel,
    });
    if (currentStr === lastSeenRemote) return;

    // UPDATE, not upsert — the row always exists (/new creates it before any
    // surface mounts this composable). Sport columns are owned by useFormat
    // and must never be written from here: the old upsert's
    // `sportPreset ?? "badminton-21"` fallback could stomp a non-badminton
    // preset when a meta edit raced the initial fetch.
    const { error } = await supabase
      .from('matches')
      .update({
        is_doubles: m.isDoubles ?? false,
        team_name_a: m.teamNames?.a?.trim() || null,
        team_name_b: m.teamNames?.b?.trim() || null,
        players: m.players ?? {},
        event_name: m.eventName?.trim() || null,
        round: m.round?.trim() || null,
        category: m.category?.trim() || null,
        court_label: m.courtLabel?.trim() || null,
      })
      .eq('id', id);
    if (error) {
      console.warn('[useMatchMeta] update failed', error);
      return;
    }
    // Remember what we sent so the realtime echo skips itself.
    lastSeenRemote = currentStr;
  };

  const subscribeRealtime = () => {
    if (realtimeChannel) {
      supabase.removeChannel(realtimeChannel);
      realtimeChannel = null;
    }
    const id = matchId.value;
    if (!id) return;
    realtimeChannel = supabase
      .channel(`match-meta:${id}:${channelSuffix}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'matches',
          filter: `id=eq.${id}`,
        },
        (payload) => applyRemote(payload.new as Parameters<typeof fromRow>[0])
      )
      .subscribe();
  };

  onMounted(() => {
    fetchRemote();
    subscribeRealtime();
  });

  watch(matchId, () => {
    fetchRemote();
    subscribeRealtime();
  });

  onUnmounted(() => {
    if (realtimeChannel) {
      supabase.removeChannel(realtimeChannel);
      realtimeChannel = null;
    }
  });

  watchDebounced(meta, () => updateRemote(), { debounce: 500, deep: true });

  // Display names — title-cased exactly as typed. No placeholder fallback;
  // /new always seeds these. An empty string flows through unchanged.
  const teamNames = computed(() => ({
    a: titleCase(meta.value.teamNames?.a?.trim() ?? ''),
    b: titleCase(meta.value.teamNames?.b?.trim() ?? ''),
  }));

  // Force an immediate update, bypassing the 500ms debounce. Used when the
  // user closes the settings sheet and we want the matches list (or any
  // other reader) to see the change on the very next fetch — without this
  // flush, fast nav (sheet close → /matches) races the debounce.
  const flush = () => updateRemote();

  return { meta, teamNames, flush };
}
