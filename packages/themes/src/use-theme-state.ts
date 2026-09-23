// Shared per-theme derivations. Every default theme needs the same handful of
// lookups (split team names into players + flag the active server, defensive
// card counts, prior vs current games), so we keep the math here and let the
// themes focus on layout.

import {
  type RacquetConfig,
  type RacquetState,
  pointLabel,
  slotInCourt,
  unitNoun,
} from '@sb/engine';
import { type Ref, computed } from 'vue';

export type SideKey = 'a' | 'b';

/** Per-slot player names. Slot 1 / slot 2 of each team, in engine slot order. */
export type Players = { a1: string; a2: string; b1: string; b2: string };

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
  playersRef?: Ref<Players | undefined>,
  configRef?: Ref<RacquetConfig>
) {
  // Partner order comes from `players` when the caller supplies it, and only
  // falls back to splitting the joined team name otherwise.
  //
  // The split used to be the only source, which made the display depend on
  // `team_name_a` staying in lockstep with `players`. It didn't: /control's
  // partner swap rewrote `players` alone, so every theme placed the SERVE
  // highlight on the wrong partner for the rest of the match — and matches
  // scored before that was fixed still carry the stale name. Reading
  // `players` first makes those render correctly with no data repair.
  const partnersOf = (side: SideKey): string[] => {
    const split = teamNamesRef.value[side]
      .split(' / ')
      .map((s) => s.trim())
      .filter(Boolean);

    // Only take over when the stored name is itself a joined pair (or blank).
    // A team the operator deliberately named — "Indonesia" — must keep showing
    // that, not get expanded into its two players. So `players` decides the
    // ORDER of a pair, it doesn't change what gets displayed.
    if (split.length > 1 || split.length === 0) {
      const p = playersRef?.value;
      const pair = side === 'a' ? [p?.a1, p?.a2] : [p?.b1, p?.b2];
      const explicit = pair.map((s) => s?.trim() ?? '').filter(Boolean);
      if (explicit.length === 2) return explicit;
    }
    return split;
  };

  const playersOf = (side: SideKey): Player[] => {
    const state = stateRef.value;
    const parts = partnersOf(side);
    if (parts.length < 2) {
      return [{ name: parts[0] ?? '', isServer: false, isPartner: false }];
    }
    const isServingTeam =
      state.servingSide.toLowerCase() === side && !state.matchOver;
    // The engine names the serving player outright. Deriving it from the court
    // is only right for badminton and pickleball, where the server is by
    // definition whoever stands in the court the score parity dictates; in
    // tennis one player serves the whole game while the court alternates
    // deuce/ad every point, so the fallback would highlight their partner on
    // alternate rallies. Kept as a fallback for logs reduced before the engine
    // tracked it.
    const serverSlot =
      state.serverSlot ??
      slotInCourt(
        state.partnerOnRight ?? { a: 1, b: 1 },
        side === 'a' ? 'A' : 'B',
        state.serverCourt
      );
    return parts.map((name, idx) => {
      const isServer = isServingTeam && idx + 1 === serverSlot;
      return { name, isServer, isPartner: isServingTeam && !isServer };
    });
  };

  const playersA = computed(() => playersOf('a'));
  const playersB = computed(() => playersOf('b'));

  const cards = (side: SideKey) => stateRef.value.cards?.[side] ?? EMPTY_CARDS;

  const games = computed(() => stateRef.value.games);
  const gamesWon = computed(() => stateRef.value.gamesWon);
  const currentGame = computed(
    () => games.value[games.value.length - 1] ?? { a: 0, b: 0 }
  );
  // Prior games = everything before the current. Match-over treats the final
  // game as still the "current" highlight column so the FINAL row stays
  // visually balanced; themes that prefer "tabulate all games" can read
  // `games` directly instead.
  const priorGames = computed(() => games.value.slice(0, -1));

  /**
   * True when the format has a point tier below the entries in `state.games` —
   * i.e. tennis and padel, where a `games` entry is a SET and the live rally
   * tally sits in `state.points`.
   *
   * Themes use it for two decisions: what the big numeral shows (see
   * `primaryScore`) and whether the cell row includes the current entry. It
   * should: under tennis scoring the current set's 4–3 is settled history at
   * the set level and belongs in a box, exactly as a broadcast draws it —
   * `Set1 6 | Set2 4 | 40`. Under rally scoring the current game IS the big
   * numeral, so including it would print the same number twice.
   */
  const showsPointTier = computed(() => configRef?.value.scoring === 'tennis');

  /**
   * Captions for whatever one entry of `state.games` is in this format: a GAME
   * for badminton / pickleball / table tennis, a SET for tennis and padel.
   *
   * Shared here rather than ternaried into each of the eleven themes, all of
   * which print some version of this — a "GAME 2" header, a "G3" chip, a "GAME
   * WON" flag — and every one of which said "game" against a tennis match,
   * where a game is the tier below and the header was off by a whole level.
   */
  const unitWord = computed(() =>
    configRef ? unitNoun(configRef.value).toUpperCase() : 'GAME'
  );
  const unitInitial = computed(() => unitWord.value.charAt(0));
  const wonLabel = computed(() => `${unitWord.value} WON`);

  /**
   * The big numeral a theme prints as "the score right now".
   *
   * A string, not a number, because tennis's is "15" / "40" / "AD" rather than
   * a rally count — and a tiebreak inside that same format goes back to plain
   * integers. Every other format returns the current game's score unchanged,
   * so themes that swapped `currentGame[side]` for this render identically.
   */
  const primaryScore = (side: SideKey): string => {
    const cfg = configRef?.value;
    const s = stateRef.value;
    if (!cfg || cfg.scoring !== 'tennis')
      return String(currentGame.value[side]);
    return pointLabel(s.points, side === 'a' ? 'A' : 'B', s.inTiebreak, cfg);
  };

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
    return last.a > last.b ? 'a' : 'b';
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
    gamesWon,
    currentGame,
    priorGames,
    primaryScore,
    showsPointTier,
    unitWord,
    unitInitial,
    wonLabel,
    isServingSide,
    isLastGameWinner,
    isMatchWinner,
    /** Back-compat alias for themes still using isWinningSide. */
    isWinningSide: isMatchWinner,
  };
}

/**
 * One boxed per-game cell, in game order. This is the core broadcast
 * convention: professional graphics tabulate each game in its own fixed-width
 * window rather than listing bare numbers, so the eye can count games at a
 * glance and the current game can be highlighted without moving anything.
 */
export type GameCell = {
  /** 1-based game number, for the G1 / G2 headers themes draw above cells. */
  n: number;
  a: number;
  b: number;
  /** Winner of a *completed* game. null while the game is still being played. */
  winner: SideKey | null;
  /** The game currently in play. At most one cell has this. */
  isCurrent: boolean;
};

/**
 * Derive the cell row from state. `state.games` keeps the in-progress game as
 * its last entry (except between games / at match end), which is exactly the
 * "current cell" every broadcast board highlights.
 */
export const gameCellsOf = (state: RacquetState): GameCell[] =>
  state.games.map((g, i) => {
    const isCurrent =
      !state.matchOver && !state.betweenGames && i === state.games.length - 1;
    const winner = isCurrent || g.a === g.b ? null : g.a > g.b ? 'a' : 'b';
    return { n: i + 1, a: g.a, b: g.b, winner, isCurrent };
  });

/**
 * ROADMAP E1.27 — the leading "games won" number only earns its space in BO5+.
 * In a single game there is nothing to count, and in BO3 the two or three
 * per-game cells already convey the standing; adding a third numeric column
 * there is noise. Tennis broadcasts draw the same line in the same place.
 */
export const showStanding = (config: RacquetConfig) => config.gamesToWin >= 3;

/**
 * Short code plate for a side — the "INA" / "DEN" of a BWF graphic, the
 * "MUN" / "LIV" of a football bug. Small surfaces (corner bugs, ribbon
 * centres) have no room for full names, and broadcast graphics solve that with
 * a code rather than by truncating mid-word.
 *
 * Derivation takes the FIRST word of the name. That looks arbitrary next to
 * "use the surname", so here is why it isn't:
 *
 * There is no rule that gets every name right, because word order encodes
 * family name inconsistently across the sport. Badminton's field is heavily
 * CHN / KOR / JPN / TPE, where the family name comes first, and BWF's own
 * graphics normalise to family-name-first ("AN Se Young", "AXELSEN Viktor").
 * So the two candidate rules fail differently:
 *
 *   last word  → An Se Young = "YOU", Tai Tzu-ying = "TZU"   ← nonsense
 *   first word → An Se Young = "AN",  Tai Tzu-ying = "TAI"   ← correct
 *                Viktor Axelsen = "VIK"                       ← informal, but reads
 *
 * Taking the last word produces a code that looks broken for a large share of
 * the actual player base; taking the first produces a merely informal one for
 * the rest. A wrong-but-readable default beats a wrong-and-confusing one, and
 * `meta.codes` is the escape hatch either way — it is also the seam the
 * branding work (E2.5) hangs richer per-side badges off.
 *
 * Team names that are already proper nouns fall out correctly: "Indonesia" → IND.
 */
export const teamCodeOf = (
  displayName: string,
  override?: string | null
): string => {
  const explicit = override?.trim();
  if (explicit) return explicit.slice(0, 4).toUpperCase();
  // First entrant only — a doubles pair gets the lead player's code, same as a
  // broadcast bug showing one code per side. Split on a bare slash so this holds
  // whether the caller passed a joined pair or an already-resolved single name.
  const lead = displayName.split('/')[0]?.trim() ?? '';
  const first = lead.split(/\s+/).find(Boolean);
  if (!first) return '—';
  return first.slice(0, 3).toUpperCase();
};

/**
 * Status pill priority shared across themes that show a contextual banner.
 * Returns null when nothing is active. Themes can override the labels by
 * inlining their own version.
 */
export type StatusPill = {
  label: string;
  tone: 'accent' | 'warn' | 'muted';
  side: 'A' | 'B' | null;
};

/**
 * Phrase the match-end reason for theme footer / WINNER captions.
 * Returns null when the match ended cleanly (or hasn't ended).
 */
export const endReasonLabel = (
  reason: RacquetState['endReason'] | undefined
): string | null => {
  switch (reason) {
    case 'walkover':
      return 'won by walkover';
    case 'retirement':
      return 'won by retirement';
    case 'default':
      return 'won by default';
    default:
      return null;
  }
};

/** Collapse a per-side flag pair into a pill side: null when both (or neither). */
const pointSide = (p: { a: boolean; b: boolean }): 'A' | 'B' | null => {
  if (p.a && p.b) return null;
  if (p.a) return 'A';
  if (p.b) return 'B';
  return null;
};

export function useStatusPill(stateRef: Ref<RacquetState>) {
  return computed<StatusPill | null>(() => {
    const s = stateRef.value;
    if (s.matchOver) return null;
    if (s.suspended) return { label: 'SUSPENDED', tone: 'warn', side: null };
    if (s.timeout)
      return {
        label: `${s.timeout.kind.toUpperCase()} TIMEOUT`,
        tone: 'warn',
        side: s.timeout.side,
      };
    // Attribute the pill to the side actually at match/game point — under
    // rally scoring that is often the receiver, not the server. When both
    // sides are a point away (e.g. 29–29), side is null (neutral pill).
    if (s.isMatchPoint)
      return {
        label: 'MATCH POINT',
        tone: 'accent',
        side: pointSide(s.matchPoint),
      };
    // Set point outranks game point and is strictly narrower — the engine only
    // sets it when the same rally would also take the game — so checking it
    // first is what makes a theme say SET POINT rather than the weaker truth.
    if (s.setPoint.a || s.setPoint.b)
      return {
        label: 'SET POINT',
        tone: 'accent',
        side: pointSide(s.setPoint),
      };
    if (s.isGamePoint)
      return {
        label: 'GAME POINT',
        tone: 'accent',
        side: pointSide(s.gamePoint),
      };
    // Below game point by construction — the engine never sets both (at the
    // 29–29 cap the next point wins, so that reads GAME POINT). Neutral side:
    // deuce belongs to the scoreline, not to one team. Reuses the existing
    // `accent` tone so every theme picks it up without a new class branch.
    if (s.isDeuce) return { label: 'DEUCE', tone: 'accent', side: null };
    if (s.atInterval) return { label: 'INTERVAL', tone: 'muted', side: null };
    // Lowest priority: a tiebreak lasts many rallies, so it is context rather
    // than an event, and anything above it is news.
    if (s.inTiebreak)
      return {
        label: s.inMatchTiebreak ? 'MATCH TIEBREAK' : 'TIEBREAK',
        tone: 'muted',
        side: null,
      };
    return null;
  });
}

/**
 * Concatenated meta string used by most overlay/scoreboard headers.
 * `sportLabel` is only meant for tournament/event branding (e.g. "Pro League
 * Finals") — the sport itself is conveyed visually by the SportIcon every
 * theme renders, so callers should leave this empty for plain matches rather
 * than passing "BADMINTON".
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
  configRef?: Ref<RacquetConfig>
) {
  return computed(() => {
    const m = metaRef.value ?? {};
    const bo = configRef
      ? `BO${(configRef.value.gamesToWin - 1) * 2 + 1}`
      : null;
    return [m.sportLabel, bo, m.round, m.category, m.courtLabel]
      .filter(Boolean)
      .join(' · ');
  });
}

/**
 * CSS var lookup for team color. Centralized so themes don't repeat the
 * "side === 'a' ? var(--color-team-a) : var(--color-team-b)" ternary.
 */
export const teamColor = (side: SideKey | 'A' | 'B') =>
  side === 'a' || side === 'A' ? 'var(--color-team-a)' : 'var(--color-team-b)';
