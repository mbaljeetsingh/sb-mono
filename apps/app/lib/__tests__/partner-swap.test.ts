// Regression guard for the doubles partner-swap invariant.
//
// Two representations of the same fact live on the `matches` row:
//   `players`      {a1, a2}      — source of truth on /control (useCourtCells)
//   `team_name_a`  "Alice / Bob" — what every theme reads (useThemeState splits
//                                  it on " / " and places the SERVE highlight
//                                  by slot index)
//
// SettingsSheet rewrites both together. /control's `swapPlayers` used to
// rewrite only `players`, so after a partner swap the overlay, scoreboard and
// render put the serve chip on the wrong partner while control looked right.

import type { RacquetState } from '@sb/engine';
import { describe, expect, it } from 'vitest';
import { ref } from 'vue';
// Relative import: `use-theme-state` is internal to @sb/themes (only the theme
// components are exported as subpaths), and widening the package's public
// surface just for a test isn't worth it.
import { useThemeState } from '../../../../packages/themes/src/use-theme-state';
import { type Players, swapTeamPlayers } from '../partner-swap';

type Meta = { players: Players; teamNames: { a: string; b: string } };

// Thin wrapper so the tests read against a single meta object, exactly the
// shape /control passes through matchMeta.
const swapPlayers = (meta: Meta, side: 'A' | 'B'): Meta =>
  swapTeamPlayers(meta.players, meta.teamNames, side);

const initial: Meta = {
  players: { a1: 'Alice', a2: 'Bob', b1: 'Carol', b2: 'Dave' },
  teamNames: { a: 'Alice / Bob', b: 'Carol / Dave' },
};

// Minimal state: team A serving from the right court, slot 1 on the right.
// useThemeState therefore marks slot 1 of team A as the server.
const servingState = {
  servingSide: 'A',
  serverCourt: 'right',
  partnerOnRight: { a: 1, b: 1 },
  matchOver: false,
  betweenGames: false,
  games: [{ a: 0, b: 0 }],
  cards: { a: undefined, b: undefined },
  winner: null,
} as unknown as RacquetState;

/** Name the theme puts the SERVE highlight on, for team A. */
const themeServerName = (
  teamNames: { a: string; b: string },
  players?: Players
) => {
  const { playersA } = useThemeState(
    ref(servingState),
    ref(teamNames),
    ref(players)
  );
  return playersA.value.find((p) => p.isServer)?.name ?? null;
};

describe('doubles partner swap', () => {
  it('agrees with control before any swap', () => {
    // Control shows slot 1 (players.a1) in the right service court.
    expect(initial.players.a1).toBe('Alice');
    expect(themeServerName(initial.teamNames)).toBe('Alice');
  });

  it('keeps teamNames in sync so the theme highlights the same partner', () => {
    const after = swapPlayers(initial, 'A');
    expect(after.players.a1).toBe('Bob');
    // The user-visible symptom first: without the teamNames rewrite the theme
    // returned 'Alice' while control showed Bob in the right service court.
    expect(themeServerName(after.teamNames)).toBe(after.players.a1);
    expect(after.teamNames.a).toBe('Bob / Alice');
  });

  it('leaves the other team untouched', () => {
    const after = swapPlayers(initial, 'A');
    expect(after.players.b1).toBe('Carol');
    expect(after.teamNames.b).toBe('Carol / Dave');
  });

  it('round-trips back to the original', () => {
    const after = swapPlayers(swapPlayers(initial, 'A'), 'A');
    expect(after).toEqual(initial);
  });

  // Match 01KYXRJ440FP0B0QEAN4J9NFPF, scored before the swap was fixed:
  // team B's partners were swapped on /control, so `players` says Rajvir is in
  // the right service court but `team_name_b` still reads "Vigas / Rajvir".
  // The overlay highlighted Vigas throughout. Nothing repairs the row — the
  // themes have to read `players` for it to render correctly.
  describe('a match already stored in the desynced state', () => {
    const stored = {
      teamNames: { a: 'Baljeet / Jasraj', b: 'Vigas / Rajvir' },
      players: {
        a1: 'Baljeet',
        a2: 'Jasraj',
        b1: 'Rajvir',
        b2: 'Vigas',
      } satisfies Players,
    };

    // Team B serving, slot 1 in the right court → the chip belongs on
    // players.b1, which is Rajvir.
    const bServing = {
      ...servingState,
      servingSide: 'B',
    } as unknown as RacquetState;

    const serverB = (players?: Players) => {
      const { playersB } = useThemeState(
        ref(bServing),
        ref(stored.teamNames),
        ref(players)
      );
      return playersB.value.find((p) => p.isServer)?.name ?? null;
    };

    it('highlighted the wrong partner when only the team name was read', () => {
      expect(serverB(undefined)).toBe('Vigas');
      expect(serverB(undefined)).not.toBe(stored.players.b1);
    });

    it('highlights the right partner once players is passed', () => {
      expect(serverB(stored.players)).toBe('Rajvir');
      expect(serverB(stored.players)).toBe(stored.players.b1);
    });

    it('exposes team B in slot order, not team-name order', () => {
      // minimal-bug badges the team by the initial of slot 1, so this is what
      // decides whether it shows "R" (Rajvir, correct) or "V" (Vigas, stale).
      const { playersB } = useThemeState(
        ref(bServing),
        ref(stored.teamNames),
        ref(stored.players)
      );
      expect(playersB.value.map((p) => p.name)).toEqual(['Rajvir', 'Vigas']);
      expect(playersB.value[0]?.name[0]).toBe('R');
    });

    it('leaves the untouched team alone', () => {
      const { playersA } = useThemeState(
        ref(servingState),
        ref(stored.teamNames),
        ref(stored.players)
      );
      expect(playersA.value.map((p) => p.name)).toEqual(['Baljeet', 'Jasraj']);
      expect(playersA.value.find((p) => p.isServer)?.name).toBe('Baljeet');
    });
  });

  it('falls back to splitting the team name when players is absent', () => {
    // Singles, previews, and any caller that doesn't have per-slot names.
    expect(themeServerName(initial.teamNames, undefined)).toBe('Alice');
  });

  it('preserves a custom team name instead of clobbering it', () => {
    const custom: Meta = {
      players: { a1: 'Alice', a2: 'Bob', b1: 'Carol', b2: 'Dave' },
      teamNames: { a: 'Indonesia', b: 'Carol / Dave' },
    };
    const after = swapPlayers(custom, 'A');
    expect(after.players.a1).toBe('Bob');
    expect(after.teamNames.a).toBe('Indonesia');
  });
});
