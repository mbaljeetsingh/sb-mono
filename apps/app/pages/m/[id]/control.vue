<script setup lang="ts">
import { useStorage, useVibrate, useWakeLock } from "@vueuse/core";
import {
  ArrowLeft,
  Columns3,
  Minus,
  MoreHorizontal,
  Plus,
  Rows3,
  Undo2,
} from "lucide-vue-next";
import {
  type RacquetConfig,
  type RacquetEvent,
  type SideId,
  type SportPresetId,
  applyRacquetUndo,
  getPreset,
  reduceRacquet,
  sportPresets,
} from "@sb/engine";
import { Button } from "@sb/layer-ui/components/ui/button";
import { Input } from "@sb/layer-ui/components/ui/input";
import { Label } from "@sb/layer-ui/components/ui/label";

definePageMeta({ layout: false });

const route = useRoute();
const matchId = computed(() => String(route.params.id ?? ""));

// Format = which points-per-game preset + how many games make a match.
// Backed by VueUse useStorage — auto-syncs across same-domain tabs (operator
// changes format on phone → laptop overlay sees it). Engine recomputes
// match-over from the event log on every reduce, so flipping these mid-match
// — including extending a single match into BO5 — is safe.
//   gamesToWin = 1 → single match (first game decides).
//   gamesToWin = 2 → best of 3 (first to 2 games wins).
//   gamesToWin = 3 → best of 5, etc.
const { meta: matchMeta, teamNames: metaTeamNames } = useMatchMeta(matchId);

// useStorage defaults must be plain values (not computeds) — it tries to
// write back during init to apply mergeDefaults, which fails on readonly
// computeds. /new writes both keys at match creation; the literal fallbacks
// only fire if the user lands here without going through /new.
const formatPreset = useStorage<SportPresetId>(
  computed(() => `sb:format:preset:${matchId.value}`),
  "badminton-21",
);
const gamesToWin = useStorage<number>(
  computed(() => `sb:format:gamesToWin:${matchId.value}`),
  1,
);

const config = computed<RacquetConfig>(() => {
  const base = getPreset(formatPreset.value).config;
  return { ...base, gamesToWin: gamesToWin.value };
});

// Sport family of the active preset — used to choose which format options to show.
const activeSport = computed(() => getPreset(formatPreset.value).sport);
// Presets in the same sport family as the active preset, for the points-per-game
// selector. Other sports usually have one preset (we just show the current one).
const sportPresetOptions = computed(() =>
  Object.values(sportPresets).filter((p) => p.sport === activeSport.value),
);

// Explicit navigation helper — using `${matchId.value}` instead of relying on
// template-literal auto-unwrap inside @click expressions. Avoids any edge case
// where the ref doesn't unwrap and we end up with a stale or wrong match id.
const goToMatchHome = () => navigateTo(`/m/${matchId.value}`);

// Team names + doubles flag + per-player names come from useMatchMeta (which
// is itself a useStorage-backed reactive read of `sb:meta:{matchId}`).
const teamNames = computed(() => matchMeta.value.teamNames ?? { a: "", b: "" });
const isDoubles = computed(() => matchMeta.value.isDoubles ?? false);
const players = computed(
  () => matchMeta.value.players ?? { a1: "", a2: "", b1: "", b2: "" },
);

const { events, append, replace } = useEvents(matchId);

onMounted(() => {
  if (events.value.length === 0) {
    append({
      type: "match.start",
      serverSide: "A",
      serverCourt: "right",
    } as Omit<RacquetEvent, "id" | "ts">);
  }
});

const state = computed(() => reduceRacquet(events.value, config.value));

// Starting-server swap. Only valid before the first rally — once a point is
// scored, server identity is derived by the reducer from the event log, so we
// shouldn't rewrite history. Gate strictly on "only the bootstrap match.start
// exists." Replaces the existing match.start (clear + append) so the event log
// stays clean and Supabase reflects the swap.
const canSwapStartingServer = computed(
  () => events.value.length === 1 && events.value[0]?.type === "match.start",
);
const swapStartingServer = () => {
  const first = events.value[0];
  if (!first || first.type !== "match.start") return;
  const opposite: SideId = first.serverSide === "A" ? "B" : "A";
  vibrate(10);
  replace([]);
  append({
    type: "match.start",
    serverSide: opposite,
    serverCourt: "right",
  } as Omit<RacquetEvent, "id" | "ts">);
};

const score = (side: SideId) => {
  const last = state.value.games[state.value.games.length - 1];
  if (!last) return 0;
  return side === "A" ? last.a : last.b;
};

// Haptic feedback via VueUse — short pulse on score, longer on undo.
const { vibrate } = useVibrate();

const onTap = (side: SideId) => {
  if (state.value.matchOver) return;
  vibrate(10);
  append({ type: "point", side } as Omit<RacquetEvent, "id" | "ts">);
};

const onUndo = () => {
  vibrate(20);
  replace(applyRacquetUndo(events.value));
};

const onReset = () => replace([]);

const isGlowing = computed<SideId | null>(() => {
  if (!state.value.isGamePoint && !state.value.isMatchPoint) return null;
  return state.value.servingSide;
});

const games = computed(() => state.value.games);
const gamesWon = computed(() => state.value.gamesWon);

const seriesLabel = computed(() =>
  gamesToWin.value === 1 ? "Single" : `BO${gamesToWin.value * 2 - 1}`,
);
// Compact preset label ("BWF 21", "15 (2027)", "T 6", "PB 11", "TT 11") for the
// chip in the format strip. Falls back to "P{N}" for unknown presets.
const presetLabel = computed(() => {
  switch (formatPreset.value) {
    case "badminton-21":
      return "BWF 21";
    case "badminton-15":
      return "15 (2027)";
    case "tennis-basic":
      return "Tennis · 6";
    case "pickleball-classic":
      return "PB 11";
    case "pickleball-rally":
      return "PB 21";
    case "table-tennis":
      return "TT 11";
    default:
      return `P${config.value.pointsPerGame}`;
  }
});

const headerLabel = computed(() => {
  const cur = games.value.length;
  if (state.value.matchOver) return "Match complete";
  if (state.value.betweenGames)
    return `Between games · ${gamesWon.value.a}–${gamesWon.value.b}`;
  return `Game ${cur} · ${presetLabel.value} · ${seriesLabel.value}`;
});

// Display names with placeholder fallback when blank.
const displayNameA = computed(() => teamNames.value.a?.trim() || "Player 1");
const displayNameB = computed(() => teamNames.value.b?.trim() || "Player 2");

// Per-player labels for the grid view.
// Source order:
//   1. Per-player fields persisted by /new (`players.a1` etc).
//   2. Split joined `teamNames.a` ("Player 1 / Player 2" → ["Player 1", "Player 2"]) — covers older
//      matches created before /new started writing the per-player split, plus the
//      common case where the user typed a doubles team as one string.
//   3. "Player N" placeholder fallback.
const splitTeam = (joined: string): [string, string] => {
  if (!joined) return ["", ""];
  const parts = joined
    .split(/\s*\/\s*/)
    .map((s) => s.trim())
    .filter(Boolean);
  return [parts[0] ?? "", parts[1] ?? ""];
};

const playerLabels = computed(() => {
  const [aP1, aP2] = splitTeam(teamNames.value.a);
  const [bP1, bP2] = splitTeam(teamNames.value.b);
  return {
    a1: players.value.a1?.trim() || aP1 || "Player 1",
    a2: players.value.a2?.trim() || aP2 || "Player 2",
    b1:
      players.value.b1?.trim() ||
      bP1 ||
      (isDoubles.value ? "Player 3" : "Player 2"),
    b2: players.value.b2?.trim() || bP2 || (isDoubles.value ? "Player 4" : ""),
  };
});

// Per-cell layout for doubles. Cells in the team's row are fixed to service-court
// positions: cell index 0 is the LEFT service court, cell index 1 is the RIGHT.
// The PLAYER NAME displayed in each cell is derived from `partnerOnRight` — names
// visibly swap between cells whenever the team scores on serve, matching the BWF
// rule that partners swap courts each time their team wins on serve. The Serves
// pill follows `serverCourt` directly because the cell IS the court.
//
// Trace: A=0, partnerOnRight.a=1 → right cell (1) shows Player 1, left cell (0)
// shows Player 2, pill on right cell. A wins → A=1, partnerOnRight.a=2 → right
// cell shows Player 2, left cell shows Player 1, pill moves to left cell. Player 1
// is now visually on the left side of the screen, still serving. ✓ Matches BWF.
//
// Cell layout differs between singles and doubles:
//   - Doubles: 2 cells per team (left court | right court). Each cell shows
//     whichever partner is currently in that court (per `partnerOnRight`).
//     Cell highlighted + Serves pill on the cell whose court matches `serverCourt`.
//   - Singles: 1 cell per team with the only player's name. Spatial info (which
//     court the serve comes from) is encoded via CONTENT ALIGNMENT inside the
//     single cell — items-start when serving from left, items-end when serving
//     from right, items-center when receiving. Avoids redundantly showing the
//     same name in two cells.
type CellInfo = {
  key: string;
  court: "left" | "right" | null;
  label: string;
};

const cellsForTeam = (team: "A" | "B"): CellInfo[] => {
  const teamKey = team === "A" ? "a" : "b";
  if (!isDoubles.value) {
    // Singles: still 2 cells (left | right) so the operator sees the court split,
    // but the player's name appears only in the ACTIVE cell. For the serving team
    // that's the cell matching `serverCourt`; for the receiving team it's the
    // diagonal opposite (BWF: receiver stands diagonally across from server).
    // The other cell is empty (no label) but still tappable.
    const name = team === "A" ? displayNameA.value : displayNameB.value;
    const serverCourt = state.value.serverCourt;
    // BWF: at 0-0 server is in their right court, receiver stands in THEIR
    // OWN right court (the diagonal — both teams' right courts sit on
    // opposite sides of the overall court because the teams face each other).
    // So the receiver's court matches the server's court name. With Team A
    // rendered reversed and Team B normal, this correctly puts the players
    // on opposite screen sides (visually diagonal).
    const activeCourt: "left" | "right" = serverCourt;
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
  const slotKey = (n: 1 | 2) => `${teamKey}${n}` as "a1" | "a2" | "b1" | "b2";
  return [
    {
      key: `${teamKey}-left`,
      court: "left",
      label: labels[slotKey(onRight === 1 ? 2 : 1)],
    },
    {
      key: `${teamKey}-right`,
      court: "right",
      label: labels[slotKey(onRight)],
    },
  ];
};

const cellsA = computed(() => cellsForTeam("A"));
const cellsB = computed(() => cellsForTeam("B"));

// Doubles: highlight + pill on the cell whose court matches serverCourt.
// Singles: cell is single, court is null, highlight whenever team is serving.
const cellIsServer = (
  team: "A" | "B",
  court: "left" | "right" | null,
): boolean => {
  if (state.value.servingSide !== team) return false;
  if (court === null) return true;
  return state.value.serverCourt === court;
};

// Cell content (player name + serves pill) is centered both horizontally and
// vertically in every cell. Singles draws a decorative center hairline inside
// the single cell to keep the left/right court split visible without moving
// the name around. Spatial info (which court is on serve) is conveyed by the
// serves pill being present and the team-row's score parity in the header strip.

// Most-recent point event → which side scored last. Drives the brief "+1" pulse.
const lastPointWinner = computed<SideId | null>(() => {
  for (let i = events.value.length - 1; i >= 0; i--) {
    const ev = events.value[i] as { type: string; side?: SideId };
    if (ev.type === "point") return ev.side ?? null;
  }
  return null;
});

const wakeLock = useWakeLock();
onMounted(() => wakeLock.request("screen"));
onUnmounted(() => wakeLock.release());

// ─────────── Sheets ───────────
type SheetKind = "events" | "matchState" | "scoreCorrect" | "format" | null;
const openSheet = ref<SheetKind>(null);
const closeSheet = () => {
  openSheet.value = null;
  confirmReset.value = false;
};

// Two-tap confirm for the destructive "reset match" action in the match-state
// sheet. First tap arms it, second tap fires. Auto-disarms when the sheet closes.
const confirmReset = ref(false);
const onResetTap = () => {
  if (!confirmReset.value) {
    confirmReset.value = true;
    return;
  }
  vibrate(20);
  onReset();
  closeSheet();
};

// useStorage refs auto-persist on assignment — these helpers stay for clarity
// at the call sites.
const setPreset = (preset: SportPresetId) => {
  formatPreset.value = preset;
};

// Court layout — operator picks based on where they sit relative to the court.
//   'stacked'    — phone held portrait, Team A on top / Team B on bottom (default).
//                  Each row splits left|right service courts.
//   'sideBySide' — phone held landscape (or scorer at the umpire's chair), Team A
//                  on the LEFT half / Team B on the RIGHT half, each splitting the
//                  service courts top|bottom.
//
// useStorage gives us a reactive ref that auto-syncs to localStorage and across
// same-domain tabs — flipping the toggle on the phone updates the laptop too.
type ControlLayout = "stacked" | "sideBySide";
const layout = useStorage<ControlLayout>(
  computed(() => `sb:control-layout:${matchId.value}`),
  "stacked",
);
const setLayout = (v: ControlLayout) => {
  layout.value = v;
};
const setGamesToWin = (n: number) => {
  gamesToWin.value = n;
};

// Long-press on Undo opens events sheet.
const undoTimer = ref<ReturnType<typeof setTimeout> | null>(null);
const onUndoPointerDown = () => {
  undoTimer.value = setTimeout(() => {
    undoTimer.value = null;
    openSheet.value = "events";
  }, 400);
};
const onUndoPointerUp = () => {
  if (undoTimer.value) {
    clearTimeout(undoTimer.value);
    undoTimer.value = null;
    onUndo();
  }
};

// Format event for events sheet display.
const recentEvents = computed(() => {
  return events.value
    .slice()
    .reverse()
    .slice(0, 20)
    .map((e, i) => {
      const ageMs = Date.now() - e.ts;
      const ago =
        ageMs < 1000
          ? "now"
          : ageMs < 60_000
            ? `-${Math.floor(ageMs / 1000)}s`
            : `-${Math.floor(ageMs / 60_000)}m`;
      let label = "";
      let isSystem = false;
      switch (e.type) {
        case "point":
          label = `Team ${e.side} scored`;
          break;
        case "match.start":
          label = "Match started";
          isSystem = true;
          break;
        case "walkover":
          label = `Walkover · ${e.winner} wins`;
          isSystem = true;
          break;
        case "retirement":
          label = `Retirement · ${e.retiring}`;
          isSystem = true;
          break;
        case "default":
          label = `Default · ${e.defaulted}`;
          isSystem = true;
          break;
        case "timeout.start":
          label = `Timeout · ${e.side}`;
          isSystem = true;
          break;
        case "timeout.end":
          label = `Timeout ended · ${e.side}`;
          isSystem = true;
          break;
        case "score.correct":
          label = "Score corrected";
          isSystem = true;
          break;
        case "team.rename":
          label = `${e.side} renamed`;
          isSystem = true;
          break;
        default:
          label = e.type;
          isSystem = true;
      }
      return {
        id: e.id,
        ago,
        label,
        isSystem,
        idx: events.value.length - 1 - i,
      };
    });
});

const undoTo = (idx: number) => {
  // Trim everything after idx (inclusive of idx).
  replace(events.value.slice(0, idx));
  closeSheet();
};

// Match-state actions
const onWalkover = (winner: SideId) => {
  append({ type: "walkover", winner } as Omit<RacquetEvent, "id" | "ts">);
  closeSheet();
};
const onRetirement = (retiring: SideId) => {
  append({ type: "retirement", retiring } as Omit<RacquetEvent, "id" | "ts">);
  closeSheet();
};
const onDefault = (defaulted: SideId) => {
  append({ type: "default", defaulted } as Omit<RacquetEvent, "id" | "ts">);
  closeSheet();
};
const onTimeout = (side: SideId, kind: "standard" | "medical" | "injury") => {
  append({ type: "timeout.start", side, kind } as Omit<
    RacquetEvent,
    "id" | "ts"
  >);
  closeSheet();
};
const onClearTimeout = () => {
  const t = state.value.timeout;
  if (!t) return;
  append({ type: "timeout.end", side: t.side } as Omit<
    RacquetEvent,
    "id" | "ts"
  >);
};

// Score correction
const correctGames = ref<{ a: string; b: string }[]>([]);
const correctGamesWon = ref({ a: 0, b: 0 });
const openScoreCorrect = () => {
  correctGames.value = state.value.games.map((g) => ({
    a: String(g.a),
    b: String(g.b),
  }));
  correctGamesWon.value = { ...state.value.gamesWon };
  openSheet.value = "scoreCorrect";
};
const applyScoreCorrect = () => {
  const games = correctGames.value
    .map((g) => ({ a: parseInt(g.a, 10) || 0, b: parseInt(g.b, 10) || 0 }))
    .filter((g) => g.a > 0 || g.b > 0);
  append({
    type: "score.correct",
    games,
    gamesWon: correctGamesWon.value,
  } as Omit<RacquetEvent, "id" | "ts">);
  closeSheet();
};
</script>

<template>
  <!-- Outer scrim: full-screen on phone (just the bg color); on desktop adds a subtle
       backdrop so the centered "court" stands out. -->
  <div class="fixed inset-0 bg-muted/40 sm:bg-muted">
    <!-- Court frame: capped to phone-portrait width on desktop. mx-auto centers it.
         Side borders on >sm give a TV-bezel feel. -->
    <div
      class="mx-auto flex h-full max-w-md flex-col bg-background text-foreground font-sans sm:border-x sm:border-border sm:shadow-2xl"
    >
      <!-- Top chrome -->
      <header
        class="h-12 flex-shrink-0 px-3 flex items-center justify-between border-b border-border"
      >
        <Button
          variant="ghost"
          size="icon"
          aria-label="Back"
          @click="goToMatchHome()"
        >
          <ArrowLeft class="size-4" />
        </Button>
        <span
          class="text-[11px] font-semibold tracking-wider text-fg-muted uppercase"
        >
          {{ headerLabel }}
        </span>
        <Button
          variant="ghost"
          size="icon"
          aria-label="More"
          @click="openSheet = 'matchState'"
        >
          <MoreHorizontal class="size-4" />
        </Button>
      </header>

      <!-- Active timeout banner -->
      <div
        v-if="state.timeout"
        class="px-4 py-2 bg-warning-soft text-warning text-xs font-bold tracking-wider uppercase flex justify-between items-center"
      >
        <span
          >⏸ TIMEOUT · TEAM {{ state.timeout.side }} ·
          {{ state.timeout.kind }}</span
        >
        <Button
          variant="link"
          size="sm"
          class="h-auto p-0 text-warning"
          @click="onClearTimeout"
        >
          End
        </Button>
      </div>

      <!-- Suspension banner -->
      <div
        v-if="state.suspended"
        class="px-4 py-2 bg-danger-soft text-danger text-xs font-bold tracking-wider uppercase"
      >
        ⏸ MATCH SUSPENDED
      </div>

      <!-- Format / previous-games / interval strip. Tap chip to change format. -->
      <div
        class="h-9 px-3 flex items-center justify-between border-b border-border bg-background/80 backdrop-blur-sm text-sm text-fg-muted"
      >
        <span class="flex items-center gap-2 text-xs">
          <template v-for="(g, i) in games" :key="i">
            <span
              class="font-mono tabular-nums inline-flex gap-1 items-baseline"
            >
              <span class="score">{{ g.a }}</span>
              <span class="opacity-40">–</span>
              <span class="score">{{ g.b }}</span>
              <span
                v-if="i < games.length - 1 || state.betweenGames"
                class="ml-1 text-success"
              >
                ✓
              </span>
            </span>
            <span v-if="i < games.length - 1" class="opacity-40">·</span>
          </template>
        </span>
        <div class="flex items-center gap-2">
          <span
            v-if="state.atInterval"
            class="text-[10px] font-bold tracking-wider uppercase text-warning bg-warning-soft px-2 py-0.5 rounded-sm"
          >
            INTERVAL
          </span>
          <!-- Pre-rally starting-server swap. Disappears once any point is scored. -->
          <Button
            v-if="canSwapStartingServer"
            variant="outline"
            size="sm"
            class="h-6 px-2 text-[10px] font-bold tracking-wider uppercase"
            @click="swapStartingServer"
          >
            {{ state.servingSide }} serves · swap
          </Button>
          <Button
            variant="link"
            size="sm"
            class="h-auto p-0 text-[11px] text-fg-muted hover:text-foreground"
            @click="openSheet = 'format'"
          >
            {{ presetLabel }} · {{ seriesLabel }}
          </Button>
          <!-- Layout toggle. Click to flip between stacked (portrait, A above B)
               and side-by-side (landscape / umpire-chair, A left of B). -->
          <Button
            variant="ghost"
            size="icon-sm"
            class="size-6"
            :title="
              layout === 'stacked'
                ? 'Switch to side-by-side (umpire view)'
                : 'Switch to stacked (portrait phone)'
            "
            :aria-label="
              layout === 'stacked'
                ? 'Switch to side-by-side layout'
                : 'Switch to stacked layout'
            "
            @click="setLayout(layout === 'stacked' ? 'sideBySide' : 'stacked')"
          >
            <component
              :is="layout === 'stacked' ? Rows3 : Columns3"
              class="size-3.5"
            />
          </Button>
        </div>
      </div>

      <!-- Court frame.
           Two team rows separated by a 1px line (`gap-px` over the dark wrapper bg).
           Each row owns its own state — outer ring for game/match point or last-point
           winner — so the highlight is on the WHOLE row, not duplicated per cell.
           Internal vertical hairline between cells uses `border-l` on cell 1 (only
           reaches inside the row, doesn't compound with the row's outer ring).
           Singles AND doubles use 2 cells per team (left court | right court). -->
      <div
        class="m-2 flex flex-1 gap-px overflow-hidden rounded-lg bg-foreground/30 ring-1 ring-foreground/30"
        :class="layout === 'sideBySide' ? 'flex-row' : 'flex-col'"
      >
        <!-- Team A row -->
        <div
          class="relative flex flex-1 flex-col bg-team-a-soft transition-shadow duration-200"
          :class="[
            isGlowing === 'A'
              ? 'shadow-[inset_0_0_0_3px_var(--color-team-a)] animate-glow-a'
              : lastPointWinner === 'A' && !state.matchOver
                ? 'shadow-[inset_0_0_0_2px_var(--color-team-a)] opacity-100'
                : '',
          ]"
        >
          <!-- Header strip: team label + score + pips + MATCH PT, centered. -->
          <div
            class="flex items-center justify-center gap-3 border-b border-team-a/20 px-3 py-2.5"
          >
            <span
              class="text-[10px] font-bold uppercase tracking-[0.08em] text-team-a"
            >
              Team A
            </span>
            <span
              class="score text-[clamp(32px,6vh,52px)] font-bold leading-none tabular-nums text-foreground"
            >
              {{ score("A") }}
            </span>
            <div class="flex gap-1">
              <span
                v-for="i in config.gamesToWin + 1"
                :key="`a-${i}`"
                class="size-[7px] rounded-full"
                :class="i <= gamesWon.a ? 'bg-team-a' : 'bg-border-strong'"
              />
            </div>
            <span
              v-if="
                state.servingSide === 'A' &&
                (state.isMatchPoint || state.isGamePoint)
              "
              class="rounded-sm bg-team-a px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-team-a-foreground"
            >
              {{ state.isMatchPoint ? "MATCH PT" : "GAME PT" }}
            </span>
          </div>

          <!-- Cells. Content is vertically AND horizontally centered in the cell.
               Direction follows the outer layout: cells split left|right when the
               teams are stacked, top|bottom when teams are side-by-side. -->
          <div
            class="flex flex-1"
            :class="
              layout === 'sideBySide' ? 'flex-col-reverse' : 'flex-row-reverse'
            "
          >
            <button
              v-for="(cell, idx) in cellsA"
              :key="cell.key"
              type="button"
              :disabled="state.matchOver"
              :aria-label="`Tap to score for ${cell.label || 'team A'}`"
              class="relative flex flex-1 flex-col items-center justify-center gap-2 px-4 py-4 transition-[background-color] duration-150 active:brightness-95 disabled:cursor-not-allowed disabled:opacity-65"
              :class="[
                // Both layouts reverse so the right service court (cells[1])
                // is visually first (screen-LEFT in stacked, TOP in
                // side-by-side). idx 0 is therefore the visually-SECOND cell;
                // the centerline divider lives on its leading edge:
                //   stacked     → border-l (left edge of the right-side cell)
                //   sideBySide  → border-t (top edge of the bottom cell)
                idx === 0
                  ? layout === 'sideBySide'
                    ? 'border-t border-team-a/20'
                    : 'border-l border-team-a/20'
                  : '',
              ]"
              @click="onTap('A')"
            >
              <span
                v-if="cell.label"
                class="max-w-full truncate text-[15px] font-semibold leading-tight text-foreground"
              >
                {{ cell.label }}
              </span>
              <div
                v-if="cellIsServer('A', cell.court)"
                class="inline-flex items-center gap-1 rounded-full bg-team-a px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-team-a-foreground"
              >
                <span
                  class="size-[5px] rounded-full bg-white animate-pulse-soft"
                />
                Serves
              </div>
            </button>
          </div>
        </div>

        <!-- Team B row — mirrors Team A's colors. In stacked view the column
             is `flex-col-reverse` so the score header anchors to the BOTTOM
             (Team B's "back of court" in a top-down layout, mirroring Team A
             at the top). Side-by-side keeps the header on top. -->
        <div
          class="relative flex flex-1 bg-team-b-soft transition-shadow duration-200"
          :class="[
            layout === 'sideBySide' ? 'flex-col' : 'flex-col-reverse',
            isGlowing === 'B'
              ? 'shadow-[inset_0_0_0_3px_var(--color-team-b)] animate-glow-b'
              : lastPointWinner === 'B' && !state.matchOver
                ? 'shadow-[inset_0_0_0_2px_var(--color-team-b)] opacity-100'
                : '',
          ]"
        >
          <div
            class="flex items-center justify-center gap-3 px-3 py-2.5"
            :class="
              layout === 'sideBySide'
                ? 'border-b border-team-b/20'
                : 'border-t border-team-b/20'
            "
          >
            <span
              class="text-[10px] font-bold uppercase tracking-[0.08em] text-team-b"
            >
              Team B
            </span>
            <span
              class="score text-[clamp(32px,6vh,52px)] font-bold leading-none tabular-nums text-foreground"
            >
              {{ score("B") }}
            </span>
            <div class="flex gap-1">
              <span
                v-for="i in config.gamesToWin + 1"
                :key="`b-${i}`"
                class="size-[7px] rounded-full"
                :class="i <= gamesWon.b ? 'bg-team-b' : 'bg-border-strong'"
              />
            </div>
            <span
              v-if="
                state.servingSide === 'B' &&
                (state.isMatchPoint || state.isGamePoint)
              "
              class="rounded-sm bg-team-b px-1.5 py-0.5 text-[10px] font-bold tracking-wider text-team-b-foreground"
            >
              {{ state.isMatchPoint ? "MATCH PT" : "GAME PT" }}
            </span>
          </div>

          <!-- Team B cells. In a top-down BWF court view, B is shown from
               BWF's perspective without mirroring — B's left court reads as
               screen-LEFT, right court as screen-RIGHT. So in stacked mode
               we use the natural `flex-row` (no reverse). When B serves with
               an odd score they're in their LEFT court (screen-left bottom);
               with an even score they're in their RIGHT court (screen-right
               bottom). Either way the SERVES pill lands on the matching cell
               diagonally opposite to A's server. Side-by-side keeps the
               column reversed for symmetry with Team A. -->
          <div
            class="flex flex-1"
            :class="layout === 'sideBySide' ? 'flex-col' : 'flex-row'"
          >
            <button
              v-for="(cell, idx) in cellsB"
              :key="cell.key"
              type="button"
              :disabled="state.matchOver"
              :aria-label="`Tap to score for ${cell.label || 'team B'}`"
              class="relative flex flex-1 flex-col items-center justify-center gap-2 px-4 py-4 transition-[background-color] duration-150 active:brightness-95 disabled:cursor-not-allowed disabled:opacity-65"
              :class="[
                // Centerline divider sits between the two cells. Both layouts
                // are non-reversed for Team B (left court first, right second),
                // so idx 1 is always the visually-second cell — its leading
                // edge is the centerline.
                idx > 0
                  ? layout === 'sideBySide'
                    ? 'border-t border-team-b/20'
                    : 'border-l border-team-b/20'
                  : '',
              ]"
              @click="onTap('B')"
            >
              <span
                v-if="cell.label"
                class="max-w-full truncate text-[15px] font-semibold leading-tight text-foreground"
              >
                {{ cell.label }}
              </span>
              <div
                v-if="cellIsServer('B', cell.court)"
                class="inline-flex items-center gap-1 rounded-full bg-team-b px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-team-b-foreground"
              >
                <span
                  class="size-[5px] rounded-full bg-white animate-pulse-soft"
                />
                Serves
              </div>
            </button>
          </div>
        </div>
      </div>

      <!-- Bottom action bar -->
      <footer
        class="h-14 flex-shrink-0 px-3 flex items-center justify-between border-t border-border"
      >
        <Button
          variant="outline"
          size="sm"
          class="select-none"
          @pointerdown="onUndoPointerDown"
          @pointerup="onUndoPointerUp"
          @pointerleave="onUndoPointerUp"
        >
          <Undo2 class="size-4" />
          Undo
        </Button>
        <span class="text-[11px] text-fg-subtle">long-press for events</span>
        <Button variant="outline" size="sm" @click="openSheet = 'matchState'">
          Events
        </Button>
      </footer>

      <!-- Match-over modal -->
      <div
        v-if="state.matchOver"
        class="absolute inset-0 z-50 flex items-center justify-center bg-overlay"
      >
        <div
          class="w-[min(90%,360px)] bg-surface text-foreground rounded-2xl p-8 shadow-2xl text-center"
        >
          <div
            class="text-[11px] font-bold tracking-[0.08em] uppercase text-brand mb-2"
          >
            {{
              state.endReason === "walkover"
                ? "WALKOVER"
                : state.endReason === "retirement"
                  ? "RETIREMENT"
                  : state.endReason === "default"
                    ? "DEFAULT"
                    : "MATCH COMPLETE"
            }}
          </div>
          <div class="text-[28px] font-semibold mb-4">
            {{ state.winner === "A" ? displayNameA : displayNameB }} wins
          </div>
          <div
            v-if="state.endReason === 'normal'"
            class="score text-[90px] font-bold flex items-baseline justify-center gap-2 mb-6"
          >
            <span>{{ gamesWon.a }}</span>
            <span class="opacity-40 text-[60px]">–</span>
            <span>{{ gamesWon.b }}</span>
          </div>
          <div class="flex flex-col gap-2">
            <Button
              size="lg"
              class="h-12 w-full font-semibold"
              @click="onReset"
            >
              New match
            </Button>
            <Button variant="ghost" class="w-full" @click="goToMatchHome()">
              Back to dashboard
            </Button>
          </div>
        </div>
      </div>

      <!-- Bottom sheet backdrop -->
      <div
        v-if="openSheet"
        class="absolute inset-0 z-40 bg-overlay"
        @click="closeSheet"
      />

      <!-- Events sheet -->
      <div
        v-if="openSheet === 'events'"
        class="absolute inset-x-0 bottom-0 z-50 max-h-[70vh] bg-surface text-foreground rounded-t-2xl px-4 pt-3 pb-6 flex flex-col shadow-[0_-12px_40px_rgba(0,0,0,0.18)]"
      >
        <div class="size-1 w-10 bg-border-strong rounded-full mx-auto mb-3" />
        <div class="flex justify-between items-baseline mb-3">
          <h2 class="text-lg font-semibold">Recent events</h2>
          <span class="text-[11px] text-fg-subtle"
            >tap to undo back to here</span
          >
        </div>
        <div class="flex-1 overflow-y-auto">
          <div
            v-for="e in recentEvents"
            :key="e.id"
            class="flex items-center gap-2.5 py-2 border-b border-dashed border-border"
            :class="e.isSystem ? 'opacity-60' : ''"
          >
            <div class="font-mono text-[11px] w-8 text-fg-subtle">
              {{ e.ago }}
            </div>
            <div class="flex-1 text-sm">{{ e.label }}</div>
            <Button
              v-if="!e.isSystem"
              variant="ghost"
              size="icon-sm"
              class="text-team-a"
              aria-label="Undo to here"
              @click="undoTo(e.idx)"
            >
              <Undo2 class="size-4" />
            </Button>
          </div>
          <div
            v-if="recentEvents.length === 0"
            class="text-fg-subtle text-sm py-4 text-center"
          >
            No events yet
          </div>
        </div>
        <div
          class="flex justify-between gap-2 mt-3 pt-3 border-t border-border"
        >
          <Button variant="outline" size="sm" @click="openScoreCorrect">
            Score correction →
          </Button>
          <Button
            size="sm"
            class="bg-team-a text-team-a-foreground hover:bg-team-a/90"
            @click="
              () => {
                onUndo();
                closeSheet();
              }
            "
          >
            <Undo2 class="size-4" />
            Undo last
          </Button>
        </div>
      </div>

      <!-- Match-state sheet -->
      <div
        v-if="openSheet === 'matchState'"
        class="absolute inset-x-0 bottom-0 z-50 bg-surface text-foreground rounded-t-2xl px-4 pt-3 pb-6 shadow-[0_-12px_40px_rgba(0,0,0,0.18)]"
      >
        <div class="size-1 w-10 bg-border-strong rounded-full mx-auto mb-3" />
        <h2 class="text-lg font-semibold">Match events</h2>
        <p class="text-[11px] text-fg-subtle mb-4">
          All recorded as events · undoable
        </p>

        <div
          class="text-[11px] font-bold tracking-wider uppercase text-fg-subtle mb-2"
        >
          Pause
        </div>
        <div class="grid grid-cols-2 gap-2 mb-3">
          <Button
            variant="outline"
            size="sm"
            @click="onTimeout('A', 'standard')"
          >
            ⏸ Timeout · A
          </Button>
          <Button
            variant="outline"
            size="sm"
            @click="onTimeout('B', 'standard')"
          >
            ⏸ Timeout · B
          </Button>
        </div>
        <div class="grid grid-cols-2 gap-2 mb-5">
          <Button
            variant="outline"
            size="sm"
            @click="onTimeout('A', 'medical')"
          >
            + Medical · A
          </Button>
          <Button
            variant="outline"
            size="sm"
            @click="onTimeout('B', 'medical')"
          >
            + Medical · B
          </Button>
        </div>

        <div
          class="text-[11px] font-bold tracking-wider uppercase text-fg-subtle mb-2"
        >
          End match
        </div>
        <div class="flex flex-col gap-2 mb-3">
          <Button
            variant="outline"
            class="h-auto justify-start gap-3 p-3 whitespace-normal"
            @click="onWalkover('A')"
          >
            <span class="text-team-a text-lg">⚑</span>
            <span class="flex-1 text-left">
              <span class="block text-sm font-semibold">Walkover · A wins</span>
              <span class="block text-[11px] text-fg-subtle font-normal"
                >B didn't show</span
              >
            </span>
            <span>›</span>
          </Button>
          <Button
            variant="outline"
            class="h-auto justify-start gap-3 p-3 whitespace-normal"
            @click="onWalkover('B')"
          >
            <span class="text-team-b text-lg">⚑</span>
            <span class="flex-1 text-left">
              <span class="block text-sm font-semibold">Walkover · B wins</span>
              <span class="block text-[11px] text-fg-subtle font-normal"
                >A didn't show</span
              >
            </span>
            <span>›</span>
          </Button>
          <Button
            variant="outline"
            class="h-auto justify-start gap-3 p-3 whitespace-normal"
            @click="onRetirement('A')"
          >
            <span class="text-team-a text-lg">✕</span>
            <span class="flex-1 text-left">
              <span class="block text-sm font-semibold">Retirement · A</span>
              <span class="block text-[11px] text-fg-subtle font-normal"
                >A injured · B wins</span
              >
            </span>
            <span>›</span>
          </Button>
          <Button
            variant="outline"
            class="h-auto justify-start gap-3 p-3 whitespace-normal"
            @click="onRetirement('B')"
          >
            <span class="text-team-b text-lg">✕</span>
            <span class="flex-1 text-left">
              <span class="block text-sm font-semibold">Retirement · B</span>
              <span class="block text-[11px] text-fg-subtle font-normal"
                >B injured · A wins</span
              >
            </span>
            <span>›</span>
          </Button>
        </div>

        <Button
          variant="outline"
          size="sm"
          class="w-full mt-2"
          @click="openScoreCorrect"
        >
          Score correction…
        </Button>

        <!-- Danger zone. Two-tap confirm so a stray tap can't wipe a live match. -->
        <div
          class="mt-5 pt-4 border-t border-dashed border-border flex flex-col gap-2"
        >
          <div
            class="text-[11px] font-bold tracking-wider uppercase text-danger"
          >
            Danger
          </div>
          <Button
            :variant="confirmReset ? 'destructive' : 'outline'"
            size="sm"
            class="w-full"
            @click="onResetTap"
          >
            {{
              confirmReset
                ? "Tap again to confirm — clears all events"
                : "Reset match to 0–0"
            }}
          </Button>
        </div>
      </div>

      <!-- Format sheet — change target points / series mid-match. -->
      <div
        v-if="openSheet === 'format'"
        class="absolute inset-x-0 bottom-0 z-50 bg-surface text-foreground rounded-t-2xl px-4 pt-3 pb-6 shadow-[0_-12px_40px_rgba(0,0,0,0.18)]"
      >
        <div class="size-1 w-10 bg-border-strong rounded-full mx-auto mb-3" />
        <h2 class="text-lg font-semibold">Match format</h2>
        <p class="text-[11px] text-fg-subtle mb-4">
          Change anytime — engine recomputes from the event log.
        </p>

        <div
          class="text-[11px] font-bold tracking-wider uppercase text-fg-subtle mb-2"
        >
          Points per game
        </div>
        <div
          class="grid gap-2 mb-4"
          :class="sportPresetOptions.length > 1 ? 'grid-cols-2' : 'grid-cols-1'"
        >
          <Button
            v-for="p in sportPresetOptions"
            :key="p.id"
            variant="outline"
            class="h-11 flex-col gap-0 px-3 whitespace-normal"
            :class="
              formatPreset === p.id
                ? 'bg-foreground text-background hover:bg-foreground/90 border-foreground'
                : ''
            "
            @click="setPreset(p.id)"
          >
            <span class="text-sm font-semibold">
              {{ p.config.pointsPerGame }} · {{ p.displayName }}
            </span>
            <span class="block text-[10px] font-medium opacity-60 mt-0.5">
              {{
                p.config.cap
                  ? `cap ${p.config.cap}`
                  : `win-by ${p.config.winBy}`
              }}{{
                p.config.intervalAt ? ` · interval ${p.config.intervalAt}` : ""
              }}
            </span>
          </Button>
        </div>

        <div
          class="text-[11px] font-bold tracking-wider uppercase text-fg-subtle mb-2"
        >
          Match length
        </div>
        <div class="grid grid-cols-2 gap-2 mb-2">
          <Button
            variant="outline"
            class="h-11 font-semibold"
            :class="
              gamesToWin === 1
                ? 'bg-foreground text-background hover:bg-foreground/90 border-foreground'
                : ''
            "
            @click="setGamesToWin(1)"
          >
            Single match
          </Button>
          <Button
            variant="outline"
            class="h-11 font-semibold"
            :class="
              gamesToWin >= 2
                ? 'bg-foreground text-background hover:bg-foreground/90 border-foreground'
                : ''
            "
            @click="setGamesToWin(gamesToWin >= 2 ? gamesToWin : 2)"
          >
            Best of {{ gamesToWin >= 2 ? gamesToWin * 2 - 1 : 3 }}
          </Button>
        </div>
        <!-- Best-of stepper, visible only when 'best-of' is selected. -->
        <div v-if="gamesToWin >= 2" class="flex items-center gap-3 mb-2 px-1">
          <Button
            variant="outline"
            size="icon"
            aria-label="Decrease best-of"
            :disabled="gamesToWin <= 2"
            @click="setGamesToWin(Math.max(2, gamesToWin - 1))"
          >
            <Minus class="size-4" />
          </Button>
          <div class="flex-1 text-center">
            <span class="text-base font-semibold text-foreground">
              Best of {{ gamesToWin * 2 - 1 }}
            </span>
            <span class="block text-[11px] text-fg-subtle mt-0.5">
              first to {{ gamesToWin }} games
            </span>
          </div>
          <Button
            variant="outline"
            size="icon"
            aria-label="Increase best-of"
            :disabled="gamesToWin >= 6"
            @click="setGamesToWin(Math.min(6, gamesToWin + 1))"
          >
            <Plus class="size-4" />
          </Button>
        </div>

        <Button variant="ghost" class="w-full mt-3" @click="closeSheet">
          Done
        </Button>
      </div>

      <!-- Score correction modal -->
      <div
        v-if="openSheet === 'scoreCorrect'"
        class="absolute inset-x-4 top-20 bottom-20 z-50 bg-surface text-foreground rounded-2xl p-5 shadow-[0_24px_60px_rgba(0,0,0,0.2)] flex flex-col"
      >
        <h2 class="text-lg font-semibold">Fix the score</h2>
        <p class="text-[11px] text-fg-subtle mb-3">
          Recorded as a score.correct event · audit-logged
        </p>

        <div
          class="text-[11px] font-bold tracking-wider uppercase text-fg-subtle mb-2"
        >
          Set correct scores
        </div>
        <div class="flex flex-col gap-2 mb-3 flex-1 overflow-y-auto">
          <div
            v-for="(g, i) in correctGames"
            :key="i"
            class="flex items-center gap-2"
          >
            <div class="w-8 text-[11px] font-semibold text-fg-subtle">
              G{{ i + 1 }}
            </div>
            <Input
              v-model="g.a"
              type="number"
              inputmode="numeric"
              class="flex-1 h-10 text-center font-mono text-base font-semibold tabular-nums"
            />
            <span class="text-fg-muted">—</span>
            <Input
              v-model="g.b"
              type="number"
              inputmode="numeric"
              class="flex-1 h-10 text-center font-mono text-base font-semibold tabular-nums"
            />
          </div>
        </div>

        <Label
          class="text-[11px] font-bold tracking-wider uppercase text-fg-subtle mb-2"
        >
          Games won
        </Label>
        <div class="flex gap-2 mb-4">
          <Input
            v-model.number="correctGamesWon.a"
            type="number"
            inputmode="numeric"
            min="0"
            class="flex-1 h-10 text-center font-mono text-base font-semibold tabular-nums"
          />
          <span class="text-fg-muted self-center">vs</span>
          <Input
            v-model.number="correctGamesWon.b"
            type="number"
            inputmode="numeric"
            min="0"
            class="flex-1 h-10 text-center font-mono text-base font-semibold tabular-nums"
          />
        </div>

        <div class="flex gap-2">
          <Button variant="outline" class="flex-1 h-10" @click="closeSheet">
            Cancel
          </Button>
          <Button
            class="flex-[2] h-10 font-semibold"
            @click="applyScoreCorrect"
          >
            Apply correction
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>
