<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useStorage, useVibrate, useWakeLock } from "@vueuse/core";
import {
  ArrowLeft,
  Columns3,
  MoreHorizontal,
  Rows3,
  Undo2,
} from "lucide-vue-next";
import {
  type RacquetEvent,
  type SideId,
  applyRacquetUndo,
  reduceRacquet,
} from "@sb/engine";
import { Button } from "@sb/layer-ui/components/ui/button";
import TeamRow from "~/components/control/TeamRow.vue";
import EventsSheet from "~/components/control/EventsSheet.vue";
import MatchStateSheet from "~/components/control/MatchStateSheet.vue";
import FormatSheet from "~/components/control/FormatSheet.vue";
import ScoreCorrectSheet from "~/components/control/ScoreCorrectSheet.vue";
import GameOverModal from "~/components/control/GameOverModal.vue";
import MatchOverModal from "~/components/control/MatchOverModal.vue";

definePageMeta({ layout: false });

const route = useRoute();
const matchId = computed(() => String(route.params.id ?? ""));

const { meta: matchMeta } = useMatchMeta(matchId);
const {
  preset,
  gamesToWin,
  config,
  sportPresetOptions,
  presetLabel,
  seriesLabel,
} = useFormat(matchId);
const { events, append, replace } = useEvents(matchId);

const teamMeta = computed(() => ({
  isDoubles: matchMeta.value.isDoubles ?? false,
  teamNames: matchMeta.value.teamNames ?? { a: "", b: "" },
  players: matchMeta.value.players ?? { a1: "", a2: "", b1: "", b2: "" },
}));

const state = computed(() => reduceRacquet(events.value, config.value));
const { cellsA, cellsB, cellIsServer, displayNameA, displayNameB } =
  useCourtCells(state, teamMeta);

onMounted(() => {
  if (events.value.length === 0) {
    append({
      type: "match.start",
      serverSide: "A",
      serverCourt: "right",
    } as Omit<RacquetEvent, "id" | "ts">);
  }
});

const score = (side: SideId) => {
  const last = state.value.games[state.value.games.length - 1];
  return last ? (side === "A" ? last.a : last.b) : 0;
};

const { vibrate } = useVibrate();

const onTap = (side: SideId) => {
  if (state.value.matchOver) return;
  // Active timeout or suspension pauses play — score taps no-op until the
  // operator clears them (Events sheet → "Clear timeout" / "Resume match").
  // Penalty cards don't pause play (BWF Law 16): yellow is a warning, red
  // awards a point already, black ends the match.
  if (state.value.timeout || state.value.suspended) return;
  if (state.value.betweenGames) return;
  vibrate(10);
  append({ type: "point", side } as Omit<RacquetEvent, "id" | "ts">);
};

const onUndo = () => {
  vibrate(20);
  replace(applyRacquetUndo(events.value));
};

const onReset = () => replace([]);

// Reset just the current game's score (mistake recovery without losing
// completed games). Uses the existing score.correct event so prior games
// + gamesWon stay intact and the engine recomputes flags from scratch.
const onResetCurrentGame = () => {
  const games = state.value.games;
  if (games.length === 0) return;
  vibrate(20);
  append({
    type: "score.correct",
    games: [...games.slice(0, -1), { a: 0, b: 0 }],
    gamesWon: state.value.gamesWon,
    reason: "Reset current game",
  } as Omit<RacquetEvent, "id" | "ts">);
};

// Between-games dialog: explicit transition into the next game. Engine
// `game.end` appends a fresh {a:0,b:0} game to state.games and clears
// betweenGames; the operator's next score tap then increments G(N+1)
// directly without the auto-create path.
const onStartNextGame = () => {
  vibrate(10);
  append({ type: "game.end" } as Omit<RacquetEvent, "id" | "ts">);
};

// Pre-rally starting-server swap. Only valid before the first point — once a
// rally is scored, server identity is derived from the event log so we
// shouldn't rewrite history. Replaces match.start (clear + append) so the
// log stays clean and Supabase reflects the swap.
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

const isGlowing = computed<SideId | null>(() => {
  if (!state.value.isGamePoint && !state.value.isMatchPoint) return null;
  return state.value.servingSide;
});

const lastPointWinner = computed<SideId | null>(() => {
  for (let i = events.value.length - 1; i >= 0; i--) {
    const ev = events.value[i] as { type: string; side?: SideId };
    if (ev.type === "point") return ev.side ?? null;
  }
  return null;
});

const games = computed(() => state.value.games);
const gamesWon = computed(() => state.value.gamesWon);
const lastGame = computed(
  () => games.value[games.value.length - 1] ?? { a: 0, b: 0 },
);
const lastGameWinnerName = computed(() =>
  lastGame.value.a > lastGame.value.b ? displayNameA.value : displayNameB.value,
);
const lastGameScore = computed(() => ({
  winner: Math.max(lastGame.value.a, lastGame.value.b),
  loser: Math.min(lastGame.value.a, lastGame.value.b),
}));

const headerLabel = computed(() => {
  if (state.value.matchOver) return "Match complete";
  if (state.value.betweenGames)
    return `Between games · ${gamesWon.value.a}–${gamesWon.value.b}`;
  return `Game ${games.value.length} · ${presetLabel.value} · ${seriesLabel.value}`;
});

// Wake-lock keeps the phone screen on during a match.
const wakeLock = useWakeLock();
onMounted(() => wakeLock.request("screen"));
onUnmounted(() => wakeLock.release());

// Layout — operator picks based on where they sit relative to the court.
//   stacked    — phone portrait, A on top / B on bottom (default).
//   sideBySide — phone landscape (or umpire's chair), A left / B right.
type ControlLayout = "stacked" | "sideBySide";
const layout = useStorage<ControlLayout>(
  computed(() => `sb:control-layout:${matchId.value}`),
  "stacked",
);

// Sheets ────────────────────────────────────────────────────────────────────
type SheetKind = "events" | "matchState" | "scoreCorrect" | "format" | null;
const openSheet = ref<SheetKind>(null);
const closeSheet = () => {
  openSheet.value = null;
};

// Long-press on Undo opens the events sheet; short tap undoes last point.
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

// Match-state actions
const onWalkover = (winner: SideId) => {
  append({ type: "walkover", winner } as Omit<RacquetEvent, "id" | "ts">);
  closeSheet();
};
const onRetirement = (retiring: SideId) => {
  append({ type: "retirement", retiring } as Omit<RacquetEvent, "id" | "ts">);
  closeSheet();
};
const onPenalty = (side: SideId, card: "yellow" | "red" | "black") => {
  append({ type: "penalty", side, card } as Omit<RacquetEvent, "id" | "ts">);
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
const onResetFromSheet = () => {
  vibrate(20);
  onReset();
  closeSheet();
};
const onResetGameFromSheet = () => {
  onResetCurrentGame();
  closeSheet();
};
const onUndoTo = (idx: number) => {
  replace(events.value.slice(0, idx));
  closeSheet();
};
const onUndoLast = () => {
  onUndo();
  closeSheet();
};
const onApplyScoreCorrect = (payload: {
  games: { a: number; b: number }[];
  gamesWon: { a: number; b: number };
}) => {
  append({
    type: "score.correct",
    games: payload.games,
    gamesWon: payload.gamesWon,
  } as Omit<RacquetEvent, "id" | "ts">);
  closeSheet();
};

const winnerName = computed(() =>
  state.value.winner === "A" ? displayNameA.value : displayNameB.value,
);
const goHome = () => navigateTo(`/m/${matchId.value}`);

// Position prop for TeamRow: combines team identity + outer layout.
const positionA = computed(() =>
  layout.value === "sideBySide" ? "a-side" : "a-stacked",
);
const positionB = computed(() =>
  layout.value === "sideBySide" ? "b-side" : "b-stacked",
);
</script>

<template>
  <div class="fixed inset-0 bg-muted/40 sm:bg-muted">
    <div
      class="mx-auto flex h-full max-w-2xl flex-col bg-background text-foreground font-sans sm:border-x sm:border-border sm:shadow-2xl"
    >
      <!-- Top chrome -->
      <header
        class="h-12 flex-shrink-0 px-3 flex items-center justify-between border-b border-border"
      >
        <Button variant="ghost" size="icon" aria-label="Back" @click="goHome">
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

      <!-- Active timeout / suspension banners -->
      <div
        v-if="state.timeout"
        class="px-4 py-2 bg-warning-soft text-warning text-xs font-bold tracking-wider uppercase flex justify-between items-center"
      >
        <span>
          ⏸ TIMEOUT · TEAM {{ state.timeout.side }} ·
          {{ state.timeout.kind }}
        </span>
        <Button
          variant="link"
          size="sm"
          class="h-auto p-0 text-warning"
          @click="onClearTimeout"
        >
          End
        </Button>
      </div>
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
            @click="layout = layout === 'stacked' ? 'sideBySide' : 'stacked'"
          >
            <component
              :is="layout === 'stacked' ? Rows3 : Columns3"
              class="size-3.5"
            />
          </Button>
        </div>
      </div>

      <!-- Court frame. Two team rows separated by a 1px line over the dark
           wrapper bg. Each row owns its own outer-ring highlight. -->
      <div
        class="m-2 flex flex-1 gap-px overflow-hidden rounded-lg bg-foreground/30 ring-1 ring-foreground/30"
        :class="layout === 'sideBySide' ? 'flex-row' : 'flex-col'"
      >
        <TeamRow
          team="A"
          :position="positionA"
          :score="score('A')"
          :games-won="gamesWon.a"
          :total-slots="config.gamesToWin + 1"
          :is-serving-team="state.servingSide === 'A'"
          :is-match-point="state.isMatchPoint"
          :is-game-point="state.isGamePoint"
          :cells="cellsA"
          :match-over="state.matchOver"
          :is-glowing="isGlowing === 'A'"
          :last-winner="lastPointWinner === 'A'"
          :cell-is-server="(court) => cellIsServer('A', court)"
          @tap="onTap('A')"
        />
        <TeamRow
          team="B"
          :position="positionB"
          :score="score('B')"
          :games-won="gamesWon.b"
          :total-slots="config.gamesToWin + 1"
          :is-serving-team="state.servingSide === 'B'"
          :is-match-point="state.isMatchPoint"
          :is-game-point="state.isGamePoint"
          :cells="cellsB"
          :match-over="state.matchOver"
          :is-glowing="isGlowing === 'B'"
          :last-winner="lastPointWinner === 'B'"
          :cell-is-server="(court) => cellIsServer('B', court)"
          @tap="onTap('B')"
        />
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

      <MatchOverModal
        v-if="state.matchOver"
        :end-reason="state.endReason"
        :winner-name="winnerName"
        :games-won="gamesWon"
        @new-match="onReset"
        @back="goHome"
      />

      <GameOverModal
        v-else-if="state.betweenGames && games.length > 0"
        :game-number="games.length"
        :winner-name="lastGameWinnerName"
        :game-score="lastGameScore"
        :match-score="gamesWon"
        :next-game-number="games.length + 1"
        @start-next="onStartNextGame"
      />

      <!-- Sheet backdrop -->
      <div
        v-if="openSheet"
        class="absolute inset-0 z-40 bg-overlay"
        @click="closeSheet"
      />

      <EventsSheet
        v-if="openSheet === 'events'"
        :events="events"
        @undo-to="onUndoTo"
        @undo-last="onUndoLast"
        @open-score-correct="openSheet = 'scoreCorrect'"
      />
      <MatchStateSheet
        v-if="openSheet === 'matchState'"
        :team-names="{ a: displayNameA, b: displayNameB }"
        @timeout="onTimeout"
        @penalty="onPenalty"
        @walkover="onWalkover"
        @retirement="onRetirement"
        @open-score-correct="openSheet = 'scoreCorrect'"
        @reset="onResetFromSheet"
        @reset-game="onResetGameFromSheet"
        @close="closeSheet"
      />
      <FormatSheet
        v-if="openSheet === 'format'"
        :preset="preset"
        :games-to-win="gamesToWin"
        :options="sportPresetOptions"
        @update:preset="(id) => (preset = id)"
        @update:games-to-win="(n) => (gamesToWin = n)"
        @close="closeSheet"
      />
      <ScoreCorrectSheet
        v-if="openSheet === 'scoreCorrect'"
        :initial-games="state.games"
        :initial-games-won="state.gamesWon"
        @apply="onApplyScoreCorrect"
        @close="closeSheet"
      />
    </div>
  </div>
</template>
