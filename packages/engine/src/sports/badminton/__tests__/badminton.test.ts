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

// ─── BWF court geometry — server court flips, doubles partner rotation ────────
//
// Direct tests for the rules pasted from BWF:
//   1. Server's court alternates by their own score (even=right, odd=left).
//   2. Receiver stands diagonal to server (their right court when server's
//      right; their left court when server's left).
//   3. Service shifts to receiving team when they win.
//   4. Doubles ONLY: serving team's partners swap courts on each "won on
//      serve" point. Receiving team's partners NEVER swap on a single point;
//      whoever happens to be in the appropriate court at the moment service
//      shifts becomes the new server.

describe("badminton — server court rules (singles + doubles)", () => {
  it("server's court flips on every point won on serve (even score → right)", () => {
    let s = reduce([start("A")], badminton21);
    expect(s.serverCourt).toBe("right"); // 0-0 → right

    s = reduce([start("A"), point("A")], badminton21);
    expect(s.serverCourt).toBe("left"); // 1-0 → left (A's score odd)

    s = reduce([start("A"), point("A"), point("A")], badminton21);
    expect(s.serverCourt).toBe("right"); // 2-0 → right

    s = reduce([start("A"), point("A"), point("A"), point("A")], badminton21);
    expect(s.serverCourt).toBe("left"); // 3-0 → left
  });

  it("on service shift, new server's court is determined by THEIR score", () => {
    // 0-0: A serves from right.
    // B wins → service shifts to B. B's score is now 1 (odd) → B serves from LEFT.
    let s = reduce([start("A"), point("B")], badminton21);
    expect(s.servingSide).toBe("B");
    expect(s.serverCourt).toBe("left");

    // A then wins back. A's score is 1 (odd) → A serves from LEFT.
    s = reduce([start("A"), point("B"), point("A")], badminton21);
    expect(s.servingSide).toBe("A");
    expect(s.serverCourt).toBe("left");

    // B then wins back. B's score = 2 (even) → B serves from RIGHT.
    // Sequence: B, A, B → score 1-2, B serves with score 2 (even).
    s = reduce([start("A"), point("B"), point("A"), point("B")], badminton21);
    expect(s.servingSide).toBe("B");
    expect(s.serverCourt).toBe("right");
  });
});

describe("badminton doubles — partner rotation (BWF Law 8)", () => {
  it("starts with both teams' slot-1 in the right service court", () => {
    const s = reduce([start("A")], badminton21);
    expect(s.partnerOnRight).toEqual({ a: 1, b: 1 });
  });

  it("serving team swaps partners on a point won on serve; receiving team does NOT swap", () => {
    // A serves from right (0-0). A wins the rally — A's partners swap (slot 1
    // moves to left, slot 2 to right). Team B was receiving and DID NOT win,
    // so their partner positions stay put.
    const s = reduce([start("A"), point("A")], badminton21);
    expect(s.partnerOnRight.a).toBe(2); // A swapped
    expect(s.partnerOnRight.b).toBe(1); // B unchanged
    expect(s.servingSide).toBe("A");
    expect(s.serverCourt).toBe("left"); // A's score 1, odd
  });

  it("receiving team winning a point does NOT swap either team's partners", () => {
    // 0-0: A serves. B wins → service shifts to B. NEITHER team swaps.
    // Result: B is now server with score 1 (odd, so left court). A's partners
    // stay {a: 1}, B's partners stay {b: 1}.
    const s = reduce([start("A"), point("B")], badminton21);
    expect(s.partnerOnRight).toEqual({ a: 1, b: 1 });
    expect(s.servingSide).toBe("B");
    expect(s.serverCourt).toBe("left");
  });

  it("multi-point rally: only the team that wins on serve swaps", () => {
    // Sequence:
    //   0-0  A serves right; A wins   → partnerOnRight.a flips to 2 (A swaps)
    //   1-0  A serves left;  A wins   → partnerOnRight.a flips back to 1
    //   2-0  A serves right; B wins   → service shifts; NO swap
    //   2-1  B serves left;  B wins   → partnerOnRight.b flips to 2 (B swaps)
    //   2-2  B serves right; A wins   → service shifts; NO swap
    const seq = [
      start("A"),
      point("A"), // A wins on serve
      point("A"), // A wins on serve
      point("B"), // B wins on receive (service shift)
      point("B"), // B wins on serve
      point("A"), // A wins on receive (service shift)
    ];
    const s = reduce(seq, badminton21);
    expect(s.games[0]).toEqual({ a: 3, b: 2 });
    expect(s.servingSide).toBe("A"); // last winner
    // After 3 A-points: 0,1,2,3 ⇒ flipped on points 1 and 2 (won on serve),
    // not on point 3 (won as receiver). a starts at 1, flips to 2 (point 1),
    // flips back to 1 (point 2), unchanged for point 3 → a = 1.
    expect(s.partnerOnRight.a).toBe(1);
    // B started at 1, didn't flip on point 3 (won on receive), flipped to 2
    // on point 4 (won on serve), didn't flip on point 5 (won on receive) → b = 2.
    expect(s.partnerOnRight.b).toBe(2);
    // A's score is 3 (odd) → server in left court.
    expect(s.serverCourt).toBe("left");
  });

  it("partner positions reset to {a:1, b:1} at the start of a new game", () => {
    // Win game 1 with several "won on serve" points so a flips a few times.
    const game1: SideId[] = [];
    for (let i = 0; i < 21; i++) game1.push("A");
    const s = reduce([start("A"), ...points(game1)], badminton21);
    // Just before game.end, A had been winning on serve repeatedly.
    // After the game ends and game 2 starts (auto-bootstrap on next point):
    const s2 = reduce([start("A"), ...points([...game1, "B"])], badminton21);
    expect(s2.gamesWon.a).toBe(1);
    expect(s2.games.length).toBe(2);
    expect(s2.partnerOnRight).toEqual({ a: 1, b: 1 });
  });
});

describe("penalty cards (BWF Law 16)", () => {
  it("yellow card increments count without changing score", () => {
    const s = reduce(
      [start("A"), point("A"), ev("penalty", { side: "A", card: "yellow" })],
      badminton21,
    );
    expect(s.cards.a.yellow).toBe(1);
    expect(s.games[0]).toEqual({ a: 1, b: 0 });
  });

  it("red card awards a point to the opponent", () => {
    const s = reduce(
      [start("A"), ev("penalty", { side: "A", card: "red" })],
      badminton21,
    );
    expect(s.cards.a.red).toBe(1);
    expect(s.games[0]).toEqual({ a: 0, b: 1 });
    expect(s.servingSide).toBe("B");
  });

  it("red card at game point ends the game", () => {
    const points20toA: SideId[] = [];
    for (let i = 0; i < 20; i++) points20toA.push("B");
    // B is at 20-0; a red card on A gives B the 21st point and ends the game.
    const s = reduce(
      [
        start("A"),
        ...points(points20toA),
        ev("penalty", { side: "A", card: "red" }),
      ],
      badminton21,
    );
    expect(s.gamesWon.b).toBe(1);
    expect(s.betweenGames).toBe(true);
  });

  it("black card ends match with opponent as winner", () => {
    const s = reduce(
      [start("A"), point("A"), ev("penalty", { side: "A", card: "black" })],
      badminton21,
    );
    expect(s.matchOver).toBe(true);
    expect(s.winner).toBe("B");
    expect(s.endReason).toBe("default");
    expect(s.cards.a.black).toBe(1);
  });
});

describe("badminton — undo round-trips partnerOnRight + serverCourt", () => {
  it("undoing a 'won on serve' point reverts the partner swap", () => {
    const before = reduce([start("A")], badminton21);
    const after = reduce([start("A"), point("A")], badminton21);
    expect(after.partnerOnRight.a).toBe(2);
    const undone = reduce(applyUndo([start("A"), point("A")]), badminton21);
    expect(undone.partnerOnRight.a).toBe(before.partnerOnRight.a); // back to 1
    expect(undone.serverCourt).toBe(before.serverCourt); // back to right
    expect(undone.servingSide).toBe(before.servingSide); // still A
  });
});
