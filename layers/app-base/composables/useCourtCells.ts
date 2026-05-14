import { computed, type ComputedRef, type Ref } from "vue";

// Court cell layout for the control surface. Each team gets two cells (left
// service court | right service court). The PLAYER NAME displayed in each
// cell is derived from `partnerOnRight` — names visibly swap between cells
// whenever the team scores on serve, matching the BWF rule that partners
// swap courts each time their team wins on serve. The Serves pill follows
// `serverCourt` directly because the cell IS the court.

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

// Display-only title case. Storage keeps user input as-is.
const titleCase = (s: string) =>
  s ? s.replace(/(^|[^\p{L}])(\p{L})/gu, (_, p, c) => p + c.toUpperCase()) : s;

export function useCourtCells(state: StateRef, meta: MetaRef) {
  const displayNameA = computed(() => titleCase(meta.value.teamNames.a.trim()));
  const displayNameB = computed(() => titleCase(meta.value.teamNames.b.trim()));

  const playerLabels = computed(() => {
    const p = meta.value.players;
    return {
      a1: titleCase(p.a1.trim()),
      a2: titleCase(p.a2.trim()),
      b1: titleCase(p.b1.trim()),
      b2: titleCase(p.b2.trim()),
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
