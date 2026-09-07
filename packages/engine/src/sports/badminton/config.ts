import type { RacquetConfig } from '../racquet-shared';

// BWF currently runs 21-point rally scoring (since 2006). A 3×15 proposal is
// pending a membership vote (April 2026) and would take effect 4 January 2027 if
// approved. We ship both presets so amateur leagues / experimental tournaments
// can pick either; default tracks today's BWF rule (21-point).
export const badminton21: RacquetConfig = {
  sport: 'badminton',
  displayName: 'Badminton (21-point, BWF)',
  scoring: 'rally',
  pointsPerGame: 21,
  winBy: 2,
  cap: 30,
  gamesToWin: 2,
  intervalAt: 11,
  serveRule: 'rally-winner',
};

export const badminton15: RacquetConfig = {
  sport: 'badminton',
  displayName: 'Badminton (15-point, BWF 2027 proposal)',
  scoring: 'rally',
  pointsPerGame: 15,
  winBy: 2,
  cap: 21,
  gamesToWin: 2,
  intervalAt: 8,
  serveRule: 'rally-winner',
};
