import { describe, expect, it } from "vitest";
import type { RacquetEvent, SideId } from "../../racquet-shared";
import { applyUndo, badminton15, badminton21, reduce } from "../index";

let nextId = 0;
const ev = (
  type: RacquetEvent["type"],
  extra: Record<string, unknown> = {},
): RacquetEvent =>
  ({
    id: `e${nextId++}`,
    ts: Date.now() + nextId,
    type,
    ...extra,
  }) as RacquetEvent;

const start = (server: SideId = "A"): RacquetEvent =>
  ev("match.start", { serverSide: server, serverCourt: "right" });
const point = (side: SideId): RacquetEvent => ev("point", { side });
const points = (sequence: SideId[]): RacquetEvent[] => sequence.map(point);

describe("match-state events", () => {
  it("walkover ends match with named winner", () => {
    const s = reduce(
      [start("A"), ev("walkover", { winner: "B" })],
      badminton21,
    );
    expect(s.matchOver).toBe(true);
    expect(s.winner).toBe("B");
    expect(s.endReason).toBe("walkover");
    expect(s.gamesWon).toEqual({ a: 0, b: 0 });
  });

  it("retirement awards win to the non-retiring side", () => {
    const seq = [
      start("A"),
      point("A"),
      point("A"),
      ev("retirement", { retiring: "A" }),
    ];
    const s = reduce(seq, badminton21);
    expect(s.matchOver).toBe(true);
    expect(s.winner).toBe("B");
    expect(s.endReason).toBe("retirement");
  });

  it("default awards win to the non-defaulted side", () => {
    const s = reduce(
      [start("A"), ev("default", { defaulted: "B" })],
      badminton21,
    );
    expect(s.matchOver).toBe(true);
    expect(s.winner).toBe("A");
    expect(s.endReason).toBe("default");
  });

  it("timeout.start sets timeout state; timeout.end clears it", () => {
    const seq: RacquetEvent[] = [
      start("A"),
      ev("timeout.start", { side: "A", kind: "standard" }),
    ];
    const mid = reduce(seq, badminton21);
    expect(mid.timeout).toEqual({ side: "A", kind: "standard" });
    const after = reduce(
      [...seq, ev("timeout.end", { side: "A" })],
      badminton21,
    );
    expect(after.timeout).toBeNull();
  });

  it("suspension flag toggles", () => {
    const seq: RacquetEvent[] = [
      start("A"),
      ev("suspension.start", { reason: "rain" }),
    ];
    expect(reduce(seq, badminton21).suspended).toBe(true);
    expect(reduce([...seq, ev("suspension.end")], badminton21).suspended).toBe(
      false,
    );
  });

  it("score.correct overwrites scores", () => {
    const seq: RacquetEvent[] = [
      start("A"),
      ev("score.correct", {
        games: [
          { a: 21, b: 19 },
          { a: 14, b: 11 },
        ],
        gamesWon: { a: 1, b: 0 },
      }),
    ];
    const s = reduce(seq, badminton21);
    expect(s.games).toEqual([
      { a: 21, b: 19 },
      { a: 14, b: 11 },
    ]);
    expect(s.gamesWon).toEqual({ a: 1, b: 0 });
    expect(s.matchOver).toBe(false);
  });

  it("score.correct can declare match over by setting gamesWon to threshold", () => {
    const seq: RacquetEvent[] = [
      start("A"),
      ev("score.correct", {
        games: [
          { a: 21, b: 19 },
          { a: 21, b: 17 },
        ],
        gamesWon: { a: 2, b: 0 },
      }),
    ];
    const s = reduce(seq, badminton21);
    expect(s.matchOver).toBe(true);
    expect(s.winner).toBe("A");
  });
});

describe("badminton 21-point — basic scoring", () => {
  it("starts 0-0 with A serving from right court", () => {
    const s = reduce([start("A")], badminton21);
    expect(s.games).toEqual([{ a: 0, b: 0 }]);
    expect(s.servingSide).toBe("A");
    expect(s.serverCourt).toBe("right");
    expect(s.matchOver).toBe(false);
  });

  it("awards points correctly and rotates server (rally scoring)", () => {
    const s = reduce(
      [start("A"), point("A"), point("B"), point("B")],
      badminton21,
    );
    expect(s.games[0]).toEqual({ a: 1, b: 2 });
    expect(s.servingSide).toBe("B");
    expect(s.serverCourt).toBe("right"); // B's score = 2 (even)
  });

  it("puts server on left court when server score is odd", () => {
    const s = reduce([start("A"), point("A")], badminton21);
    expect(s.servingSide).toBe("A");
    expect(s.serverCourt).toBe("left");
  });
});

describe("badminton 21-point — game win conditions", () => {
  it("wins at 21-19 (margin of 2)", () => {
    const seq: SideId[] = [];
    for (let i = 0; i < 19; i++) seq.push("A", "B");
    seq.push("A", "A"); // A reaches 21, B at 19
    const s = reduce([start("A"), ...points(seq)], badminton21);
    expect(s.games[0]).toEqual({ a: 21, b: 19 });
    expect(s.gamesWon).toEqual({ a: 1, b: 0 });
    expect(s.betweenGames).toBe(true);
    expect(s.matchOver).toBe(false);
  });

  it("does not win at 21-20 (must clear by 2)", () => {
    const seq: SideId[] = [];
    for (let i = 0; i < 20; i++) seq.push("A", "B");
    seq.push("A");
    const s = reduce([start("A"), ...points(seq)], badminton21);
    expect(s.games[0]).toEqual({ a: 21, b: 20 });
    expect(s.gamesWon).toEqual({ a: 0, b: 0 });
    expect(s.betweenGames).toBe(false);
  });

  it("continues past 21 in deuce (e.g., 22-20)", () => {
    const seq: SideId[] = [];
    for (let i = 0; i < 20; i++) seq.push("A", "B"); // 20-20
    seq.push("A", "A");
    const s = reduce([start("A"), ...points(seq)], badminton21);
    expect(s.games[0]).toEqual({ a: 22, b: 20 });
    expect(s.gamesWon).toEqual({ a: 1, b: 0 });
  });

  it("caps at 30: 30-29 wins regardless of margin rule", () => {
    const seq: SideId[] = [];
    for (let i = 0; i < 29; i++) seq.push("A", "B"); // 29-29
    seq.push("A");
    const s = reduce([start("A"), ...points(seq)], badminton21);
    expect(s.games[0]).toEqual({ a: 30, b: 29 });
    expect(s.gamesWon).toEqual({ a: 1, b: 0 });
  });
});

describe("badminton 21-point — interval flag", () => {
  it("flags interval the first time a side reaches 11", () => {
    const seq: SideId[] = [];
    for (let i = 0; i < 11; i++) seq.push("A");
    const s = reduce([start("A"), ...points(seq)], badminton21);
    expect(s.atInterval).toBe(true);
    expect(s.games[0]).toEqual({ a: 11, b: 0 });
  });

  it("does not re-flag interval on the next point", () => {
    const seq: SideId[] = [];
    for (let i = 0; i < 11; i++) seq.push("A");
    seq.push("B");
    const s = reduce([start("A"), ...points(seq)], badminton21);
    expect(s.atInterval).toBe(false);
  });
});

describe("badminton 21-point — game/match points", () => {
  it("flags game point at 20-x where x < 20", () => {
    const seq: SideId[] = [];
    for (let i = 0; i < 20; i++) seq.push("A");
    for (let i = 0; i < 5; i++) seq.push("B");
    const s = reduce([start("A"), ...points(seq)], badminton21);
    expect(s.games[0]).toEqual({ a: 20, b: 5 });
    expect(s.isGamePoint).toBe(true);
    expect(s.isMatchPoint).toBe(false);
  });

  it("flags match point when game-winning point would also clinch the match", () => {
    const g1: SideId[] = [];
    for (let i = 0; i < 21; i++) g1.push("A");
    const g2: SideId[] = [];
    for (let i = 0; i < 20; i++) g2.push("A");
    const s = reduce([start("A"), ...points([...g1, ...g2])], badminton21);
    expect(s.gamesWon.a).toBe(1);
    expect(s.isMatchPoint).toBe(true);
  });
});

describe("badminton 21-point — match win (best of 3)", () => {
  it("ends match when a side wins 2 games", () => {
    const winGameForA: SideId[] = [];
    for (let i = 0; i < 21; i++) winGameForA.push("A");
    const seq = [start("A"), ...points([...winGameForA, ...winGameForA])];
    const s = reduce(seq, badminton21);
    expect(s.matchOver).toBe(true);
    expect(s.winner).toBe("A");
    expect(s.gamesWon).toEqual({ a: 2, b: 0 });
  });

  it("ignores points after match is over", () => {
    const winGameForA: SideId[] = [];
    for (let i = 0; i < 21; i++) winGameForA.push("A");
    const events = [
      start("A"),
      ...points([...winGameForA, ...winGameForA, "A", "A"]),
    ];
    const s = reduce(events, badminton21);
    expect(s.matchOver).toBe(true);
    expect(s.gamesWon).toEqual({ a: 2, b: 0 });
  });

  it("handles a 3-game match (2-1) correctly", () => {
    const winA: SideId[] = [];
    for (let i = 0; i < 21; i++) winA.push("A");
    const winB: SideId[] = [];
    for (let i = 0; i < 21; i++) winB.push("B");
    const events = [start("A"), ...points([...winA, ...winB, ...winA])];
    const s = reduce(events, badminton21);
    expect(s.matchOver).toBe(true);
    expect(s.winner).toBe("A");
    expect(s.gamesWon).toEqual({ a: 2, b: 1 });
    expect(s.games.length).toBe(3);
  });
});

describe("badminton 15-point variant", () => {
  it("wins game at 15 with margin of 2 (deuce continues)", () => {
    const seq: SideId[] = [];
    for (let i = 0; i < 14; i++) seq.push("A", "B"); // 14-14
    seq.push("A", "A");
    const s = reduce([start("A"), ...points(seq)], badminton15);
    expect(s.games[0]).toEqual({ a: 16, b: 14 });
    expect(s.gamesWon).toEqual({ a: 1, b: 0 });
  });

  it("caps 15-pt variant at 21", () => {
    const seq: SideId[] = [];
    for (let i = 0; i < 20; i++) seq.push("A", "B"); // 20-20
    seq.push("B");
    const s = reduce([start("A"), ...points(seq)], badminton15);
    expect(s.games[0]).toEqual({ a: 20, b: 21 });
    expect(s.gamesWon).toEqual({ a: 0, b: 1 });
  });
});

describe("undo", () => {
  it("removes the last point and returns prior state", () => {
    const events = [start("A"), point("A"), point("B"), point("A")];
    const s = reduce(applyUndo(events), badminton21);
    expect(s.games[0]).toEqual({ a: 1, b: 1 });
  });

  it("peels multiple points with multiple undos", () => {
    let events = [start("A"), point("A"), point("B"), point("A")];
    events = applyUndo(events);
    events = applyUndo(events);
    const s = reduce(events, badminton21);
    expect(s.games[0]).toEqual({ a: 1, b: 0 });
  });

  it("does nothing when there are no point events", () => {
    const events = [start("A")];
    expect(applyUndo(events)).toEqual(events);
  });

  it("correctly undoes a game-winning point", () => {
    const g1: SideId[] = [];
    for (let i = 0; i < 21; i++) g1.push("A");
    const events = [start("A"), ...points(g1)];
    expect(reduce(events, badminton21).gamesWon.a).toBe(1);
    const after = reduce(applyUndo(events), badminton21);
    expect(after.gamesWon.a).toBe(0);
    expect(after.games[0]).toEqual({ a: 20, b: 0 });
    expect(after.betweenGames).toBe(false);
  });
});

describe("team rename and sides swap", () => {
  it("updates team names without touching score", () => {
    const events: RacquetEvent[] = [
      start("A"),
      point("A"),
      ev("team.rename", { side: "A", name: "Singh" }),
      ev("team.rename", { side: "B", name: "Kaur" }),
    ];
    const s = reduce(events, badminton21);
    expect(s.names).toEqual({ a: "Singh", b: "Kaur" });
    expect(s.games[0]).toEqual({ a: 1, b: 0 });
  });

  it("toggles sidesSwapped flag", () => {
    const s = reduce([start("A"), ev("sides.swap")], badminton21);
    expect(s.sidesSwapped).toBe(true);
    const s2 = reduce(
      [start("A"), ev("sides.swap"), ev("sides.swap")],
      badminton21,
    );
    expect(s2.sidesSwapped).toBe(false);
  });
});
