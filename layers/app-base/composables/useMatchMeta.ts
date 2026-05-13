import { computed, onMounted, ref, watch, type Ref } from "vue";
import { watchDebounced } from "@vueuse/core";

// useMatchMeta — per-match display metadata (team / player names + tournament
// info). Backed by the `matches` row in Supabase so any device that opens the
// match URL (OBS overlay on a laptop, phone of a co-scorer, browser source on
// another machine) renders the same names without sharing localStorage.
//
// Read path: fetch the row on mount + on matchId change.
// Write path: deep watch on `meta`, debounced upsert. Hydration is gated so
// the initial fetch doesn't echo straight back as a write.
//
// Events (the scoring stream) still use localStorage-first for fast taps +
// offline tolerance — that asymmetry is intentional. Meta is read-once per
// page load; the round-trip is fine. See useEvents for the high-write path.

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
  players?: Record<string, unknown> | null;
  event_name?: string | null;
  round?: string | null;
  category?: string | null;
  court_label?: string | null;
}): MatchMeta => {
  const p = (row.players ?? {}) as Partial<MatchMeta["players"]>;
  return {
    sport: "racquet",
    sportPreset: row.sport_preset ?? undefined,
    isDoubles: row.is_doubles ?? false,
    teamNames: {
      a: row.team_name_a ?? "",
      b: row.team_name_b ?? "",
    },
    players: {
      a1: p?.a1 ?? "",
      a2: p?.a2 ?? "",
      b1: p?.b1 ?? "",
      b2: p?.b2 ?? "",
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
  // Gate writes during hydration so the initial fetch doesn't immediately
  // echo back as an upsert. Cleared once Vue's reactive flush has run.
  let hydrating = false;

  const fetchRemote = async () => {
    const id = matchId.value;
    if (!id) return;
    const { data, error } = await supabase
      .from("matches")
      .select(
        "sport_preset, is_doubles, team_name_a, team_name_b, players, event_name, round, category, court_label",
      )
      .eq("id", id)
      .maybeSingle();
    if (error) {
      console.warn("[useMatchMeta] fetch failed", error);
      return;
    }
    if (!data) return;
    hydrating = true;
    meta.value = fromRow(data);
    // Release after the debounce window so the trailing watch tick is
    // suppressed too. 600ms > the 500ms debounce below.
    setTimeout(() => {
      hydrating = false;
    }, 600);
  };

  const upsertRemote = async () => {
    if (hydrating) return;
    const id = matchId.value;
    if (!id) return;
    const m = meta.value;
    // Don't create an empty row just because the composable mounted on a
    // surface with no data to persist (e.g. an overlay reading remote).
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
    const { error } = await supabase.from("matches").upsert(
      {
        id,
        sport_family: "racquet",
        sport_preset: m.sportPreset ?? "badminton-21",
        is_doubles: m.isDoubles ?? false,
        team_name_a: m.teamNames?.a?.trim() || null,
        team_name_b: m.teamNames?.b?.trim() || null,
        players: m.players ?? {},
        event_name: m.eventName?.trim() || null,
        round: m.round?.trim() || null,
        category: m.category?.trim() || null,
        court_label: m.courtLabel?.trim() || null,
      },
      { onConflict: "id" },
    );
    if (error) console.warn("[useMatchMeta] upsert failed", error);
  };

  onMounted(() => {
    fetchRemote();
  });

  watch(matchId, () => {
    fetchRemote();
  });

  watchDebounced(meta, () => upsertRemote(), { debounce: 500, deep: true });

  // Display names with placeholder fallback. Empty user input is treated as
  // "no name given" — themes show "Team A" / "Team B" rather than literal blanks.
  const teamNames = computed(() => ({
    a: titleCase(meta.value.teamNames?.a?.trim() || "") || "Team A",
    b: titleCase(meta.value.teamNames?.b?.trim() || "") || "Team B",
  }));

  return { meta, teamNames };
}
