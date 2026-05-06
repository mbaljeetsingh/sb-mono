import { computed, type ComputedRef, type Ref } from "vue";

// Court cell layout for the control surface. Each team gets two cells (left
// service court | right service court). The PLAYER NAME displayed in each
// cell is derived from `partnerOnRight` — names visibly swap between cells
// whenever the team scores on serve, matching the BWF rule that partners
// swap courts each time their team wins on serve. The Serves pill follows
// `serverCourt` directly because the cell IS the court.
//
// Trace (doubles): A=0, partnerOnRight.a=1 → right cell shows Player 1, left
// cell shows Player 2, pill on right cell. A wins → A=1, partnerOnRight.a=2 →
// right cell shows Player 2, left cell shows Player 1, pill moves to left
// cell. Player 1 is now visually on the left side, still serving. ✓
//
// Singles: still 2 cells so the operator sees the court split, but the name
// only appears in the active cell. For the serving team that's the cell
// matching `serverCourt`; for the receiving team it's the diagonal opposite
// (BWF: receiver stands diagonally across from server, which lands on the
// same court name because the teams face each other).

export type Cell = {
  key: string;
  court: "left" | "right";
  label: string;
};

type StateRef = Ref<{
  servingSide: "A" | "B";
  serverCourt: "left" | "right";
  partnerOnRight: { a: 1 | 2; b: 1 | 2 };
}>;

type MetaRef = ComputedRef<{
  isDoubles: boolean;
  teamNames: { a: string; b: string };
  players: { a1: string; a2: string; b1: string; b2: string };
}>;

const splitTeam = (joined: string): [string, string] => {
  if (!joined) return ["", ""];
  const parts = joined
    .split(/\s*\/\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  return [parts[0] ?? "", parts[1] ?? ""];
};

export function useCourtCells(state: StateRef, meta: MetaRef) {
  const displayNameA = computed(
    () => meta.value.teamNames.a?.trim() || "Player 1",
  );
  const displayNameB = computed(
    () => meta.value.teamNames.b?.trim() || "Player 2",
  );

  // Per-player labels (doubles).
  // Source order:
  //   1. Per-player fields persisted by /new (`players.a1` etc).
  //   2. Split joined `teamNames.a` ("Foo / Bar") — covers older matches and
  //      the case where the user typed a doubles team as one string.
  //   3. "Player N" placeholder.
  const playerLabels = computed(() => {
    const [aP1, aP2] = splitTeam(meta.value.teamNames.a);
    const [bP1, bP2] = splitTeam(meta.value.teamNames.b);
    const p = meta.value.players;
    const isDoubles = meta.value.isDoubles;
    return {
      a1: p.a1?.trim() || aP1 || "Player 1",
      a2: p.a2?.trim() || aP2 || "Player 2",
      b1: p.b1?.trim() || bP1 || (isDoubles ? "Player 3" : "Player 2"),
      b2: p.b2?.trim() || bP2 || (isDoubles ? "Player 4" : ""),
    };
  });

  const cellsForTeam = (team: "A" | "B"): Cell[] => {
    const teamKey = team === "A" ? "a" : "b";
    if (!meta.value.isDoubles) {
      const name = team === "A" ? displayNameA.value : displayNameB.value;
      const activeCourt = state.value.serverCourt;
      return [
        {
          key: `${teamKey}-left`,
          court: "left",
          label: activeCourt === "left" ? name : "",
        },
        {
          key: `${teamKey}-right`,
          court: "right",
          label: activeCourt === "right" ? name : "",
        },
      ];
    }
    const onRight = state.value.partnerOnRight[teamKey];
    const labels = playerLabels.value;
    const slot = (n: 1 | 2) => `${teamKey}${n}` as "a1" | "a2" | "b1" | "b2";
    return [
      {
        key: `${teamKey}-left`,
        court: "left",
        label: labels[slot(onRight === 1 ? 2 : 1)],
      },
      {
        key: `${teamKey}-right`,
        court: "right",
        label: labels[slot(onRight)],
      },
    ];
  };

  const cellsA = computed(() => cellsForTeam("A"));
  const cellsB = computed(() => cellsForTeam("B"));

  const cellIsServer = (team: "A" | "B", court: "left" | "right") =>
    state.value.servingSide === team && state.value.serverCourt === court;

  return { cellsA, cellsB, cellIsServer, displayNameA, displayNameB };
}
