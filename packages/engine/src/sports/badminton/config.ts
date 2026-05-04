import type { RacquetConfig } from "../racquet-shared";

export const badminton21: RacquetConfig = {
  sport: "badminton",
  displayName: "Badminton (21-point, BWF)",
  pointsPerGame: 21,
  winBy: 2,
  cap: 30,
  gamesToWin: 2,
  intervalAt: 11,
};

export const badminton15: RacquetConfig = {
  sport: "badminton",
  displayName: "Badminton (15-point, traditional)",
  pointsPerGame: 15,
  winBy: 2,
  cap: 21,
  gamesToWin: 2,
  intervalAt: 8,
};
