// Doubles partner swap — which partner starts in the right service court.
//
// Two representations of the same fact live on the `matches` row:
//   `players`     {a1, a2}      — source of truth on /control (useCourtCells)
//   `team_name_a` "Alice / Bob" — what every theme reads (useThemeState splits
//                                 it on " / " and places the SERVE highlight
//                                 by slot index)
//
// They must move together. SettingsSheet already rewrites both on any player
// edit; /control's swap has to do the same, or the overlay, scoreboard and
// render put the serve chip on the wrong partner for the rest of the match
// while /control looks correct.

export type Players = { a1: string; a2: string; b1: string; b2: string };
export type TeamNames = { a: string; b: string };

/** Joined display form. Same rule SettingsSheet uses. */
export const joinNames = (p1: string, p2: string) =>
  [p1, p2]
    .map((s) => s.trim())
    .filter(Boolean)
    .join(' / ');

/**
 * Swap the two partners of one team. Returns the new `players` and
 * `teamNames` pair.
 *
 * `teamNames` is only rebuilt when it still IS the joined form — an operator
 * who typed a real team name ("Indonesia") keeps it, and themes render that
 * as a single unsplittable name anyway.
 */
export const swapTeamPlayers = (
  players: Players,
  teamNames: TeamNames,
  side: 'A' | 'B'
): { players: Players; teamNames: TeamNames } => {
  const next: Players =
    side === 'A'
      ? { ...players, a1: players.a2, a2: players.a1 }
      : { ...players, b1: players.b2, b2: players.b1 };

  const key = side === 'A' ? 'a' : 'b';
  const [was1, was2] =
    side === 'A' ? [players.a1, players.a2] : [players.b1, players.b2];
  const [now1, now2] = side === 'A' ? [next.a1, next.a2] : [next.b1, next.b2];

  const wasJoined = teamNames[key]?.trim() === joinNames(was1, was2);

  return {
    players: next,
    teamNames: wasJoined
      ? { ...teamNames, [key]: joinNames(now1, now2) }
      : teamNames,
  };
};
