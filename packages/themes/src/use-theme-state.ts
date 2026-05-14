// Shared per-theme derivations. Every default theme needs the same handful of
// lookups (split team names into players + flag the active server, defensive
// card counts, prior vs current games), so we keep the math here and let the
// themes focus on layout.

import { computed, type Ref } from "vue";
import type { RacquetState } from "@sb/engine";

export type SideKey = "a" | "b";

export type Player = {
  name: string;
  /** True when this player is the active server right now. */
  isServer: boolean;
  /** True when this player's partner is serving (used for dim styling).
   *  Always false in singles and after match-over. */
  isPartner: boolean;
};

const EMPTY_CARDS = { yellow: 0, red: 0, black: 0 } as const;

/**
 * Derive per-team player arrays + per-team card counts + prior/current game
 * splits. Themes call this once and bind to the returned refs.
 *
 * Doubles uses BWF Law 8: `partnerOnRight` says which slot of each team is
 * currently in their right service court; `serverCourt` says which court the
 * server is in for the team that's serving. Singles falls through with a
 * single isServer=false entry.
 */
export function useThemeState(
  stateRef: Ref<RacquetState>,
  teamNamesRef: Ref<{ a: string; b: string }>,
) {
  const playersOf = (side: SideKey): Player[] => {
    const state = stateRef.value;
    const parts = teamNamesRef.value[side]
      .split(" / ")
      .map((s) => s.trim())
      .filter(Boolean);
    if (parts.length < 2) {
      return [{ name: parts[0] ?? "", isServer: false, isPartner: false }];
    }
    const onRight = state.partnerOnRight?.[side] ?? 1;
    const isServingTeam =
      state.servingSide.toLowerCase() === side && !state.matchOver;
    const serverSlot =
      state.serverCourt === "right" ? onRight : onRight === 1 ? 2 : 1;
    return parts.map((name, idx) => {
      const isServer = isServingTeam && idx + 1 === serverSlot;
      return { name, isServer, isPartner: isServingTeam && !isServer };
    });
  };

  const playersA = computed(() => playersOf("a"));
  const playersB = computed(() => playersOf("b"));

  const cards = (side: SideKey) => stateRef.value.cards?.[side] ?? EMPTY_CARDS;

  const games = computed(() => stateRef.value.games);
  const currentGame = computed(
    () => games.value[games.value.length - 1] ?? { a: 0, b: 0 },
  );
  // Prior games = everything before the current. Match-over treats the final
  // game as still the "current" highlight column so the FINAL row stays
  // visually balanced; themes that prefer "tabulate all games" can read
  // `games` directly instead.
  const priorGames = computed(() => games.value.slice(0, -1));

  // Active rally play — false during betweenGames + matchOver so SERVE chips
  // give way to GAME WON / WINNER chips at game/match boundaries.
  const isServingSide = (side: SideKey) =>
    stateRef.value.servingSide.toLowerCase() === side &&
    !stateRef.value.matchOver &&
    !stateRef.value.betweenGames;

  // Winner of the most recently *completed* game. Set while the match sits
  // between games, and also at match-end (the deciding game). Themes use this
  // for the GAME WON chip; SERVE returns once a new point auto-starts game N+1.
  const lastGameWinner = computed<SideKey | null>(() => {
    const s = stateRef.value;
    if (!s.betweenGames && !s.matchOver) return null;
    const last = s.games[s.games.length - 1];
    if (!last) return null;
    if (last.a === last.b) return null;
    return last.a > last.b ? "a" : "b";
  });

  const isLastGameWinner = (side: SideKey) => lastGameWinner.value === side;

  // Winner of the match (only after matchOver). Distinct from
  // isLastGameWinner because at match-end both fire — themes pick whichever
  // chip they want to render. Defensive lowercase: engine writes "A"/"B".
  const isMatchWinner = (side: SideKey) =>
    stateRef.value.matchOver && stateRef.value.winner?.toLowerCase() === side;

  return {
    playersA,
    playersB,
    cards,
    games,
    currentGame,
    priorGames,
    isServingSide,
    isLastGameWinner,
    isMatchWinner,
    /** Back-compat alias for themes still using isWinningSide. */
    isWinningSide: isMatchWinner,
  };
}

/**
 * Status pill priority shared across themes that show a contextual banner.
 * Returns null when nothing is active. Themes can override the labels by
 * inlining their own version.
 */
export type StatusPill = {
  label: string;
  tone: "accent" | "warn" | "muted";
  side: "A" | "B" | null;
};

/**
 * Phrase the match-end reason for theme footer / WINNER captions.
 * Returns null when the match ended cleanly (or hasn't ended).
 */
export const endReasonLabel = (
  reason: RacquetState["endReason"] | undefined,
): string | null => {
  switch (reason) {
    case "walkover":
      return "won by walkover";
    case "retirement":
      return "won by retirement";
    case "default":
      return "won by default";
    default:
      return null;
  }
};

export function useStatusPill(stateRef: Ref<RacquetState>) {
  return computed<StatusPill | null>(() => {
    const s = stateRef.value;
    if (s.matchOver) return null;
    if (s.suspended) return { label: "SUSPENDED", tone: "warn", side: null };
    if (s.timeout)
      return {
        label: `${s.timeout.kind.toUpperCase()} TIMEOUT`,
        tone: "warn",
        side: s.timeout.side,
      };
    if (s.isMatchPoint)
      return { label: "MATCH POINT", tone: "accent", side: s.servingSide };
    if (s.isGamePoint)
      return { label: "GAME POINT", tone: "accent", side: s.servingSide };
    if (s.atInterval) return { label: "INTERVAL", tone: "muted", side: null };
    return null;
  });
}

/**
 * Concatenated meta string ("BADMINTON · QUARTERFINAL · COURT 1") used by
 * most overlay/scoreboard headers. Filters out empty fields.
 */
export function useMetaLine(
  metaRef: Ref<
    | {
        sportLabel?: string;
        round?: string | null;
        category?: string | null;
        courtLabel?: string | null;
      }
    | undefined
  >,
) {
  return computed(() => {
    const m = metaRef.value ?? {};
    return [m.sportLabel, m.round, m.category, m.courtLabel]
      .filter(Boolean)
      .join(" · ");
  });
}

/**
 * CSS var lookup for team color. Centralized so themes don't repeat the
 * "side === 'a' ? var(--color-team-a) : var(--color-team-b)" ternary.
 */
export const teamColor = (side: SideKey | "A" | "B") =>
  side === "a" || side === "A" ? "var(--color-team-a)" : "var(--color-team-b)";
