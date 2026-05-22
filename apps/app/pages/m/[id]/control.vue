<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { onLongPress, useStorage, useVibrate, useWakeLock } from "@vueuse/core";
import {
  ArrowLeft,
  ArrowLeftRight,
  ArrowUpDown,
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
import { toast } from "vue-sonner";
import { Button } from "@sb/layer-ui/components/ui/button";
import TeamRow from "~/components/control/TeamRow.vue";
import MatchStateSheet from "~/components/control/MatchStateSheet.vue";
import FormatSheet from "~/components/control/FormatSheet.vue";
import ScoreCorrectSheet from "~/components/control/ScoreCorrectSheet.vue";
import GameOverModal from "~/components/control/GameOverModal.vue";
import MatchOverModal from "~/components/control/MatchOverModal.vue";

definePageMeta({ layout: false, colorMode: "light" });

const route = useRoute();
const matchId = computed(() => String(route.params.id ?? ""));

// Resolve who can score here: owner, anon-match-anyone, or token holder.
// Token-only access routes writes through SECURITY DEFINER RPCs that
// validate the token server-side; owners and anon-match writers use the
// normal RLS-gated path (writeToken stays null for them).
const {
  loaded: accessLoaded,
  canScore,
  writeToken,
  isOwner,
  isAnonMatch,
  matchDeleted,
} = useWriteAccess(matchId);
// `canEditMeta` gates UI that writes directly to the `matches` row (format
// preset, gamesToWin, player swap in doubles). Co-scorer token writes are
// routed through the SECURITY DEFINER RPCs; direct UPDATEs fail under RLS
// for anyone who isn't the owner of an owned match, so we hide the chrome
// to avoid showing "successful" local edits that never sync.
const canEditMeta = computed(() => isOwner.value || isAnonMatch.value);
watch([accessLoaded, canScore], ([l, ok]) => {
  if (!l || ok) return;
  // The match was deleted while we were here — the scoreboard view would be
  // an empty shell, so send the user somewhere meaningful instead.
  if (matchDeleted.value) {
    toast.error("This match was deleted.");
    navigateTo("/", { replace: true });
    return;
  }
  toast.error("You don't have permission to score this match.");
  navigateTo(`/m/${matchId.value}/scoreboard`, { replace: true });
});

const { meta: matchMeta } = useMatchMeta(matchId);
const {
  preset,
  gamesToWin,
  config,
  sportPresetOptions,
  presetLabel,
  seriesLabel,
} = useFormat(matchId);
const { events, append, replace } = useEvents(matchId, { writeToken });

// Soft handoff lock: at most one device is the "active scorer" at a time.
// Other devices viewing /control land in read-only mode with a banner +
// "Score from this device" reclaim button. Bootstrap: when no one has
// claimed yet (first load on a fresh match), every device is active so the
// first tap registers. The trigger flips the column on first event INSERT.
const {
  isActive,
  activeDeviceId,
  claim: claimScoring,
} = useScorerActive(matchId, { writeToken });

const teamMeta = computed(() => ({
  isDoubles: matchMeta.value.isDoubles ?? false,
  teamNames: matchMeta.value.teamNames ?? { a: "", b: "" },
  players: matchMeta.value.players ?? { a1: "", a2: "", b1: "", b2: "" },
}));

const state = computed(() => reduceRacquet(events.value, config.value));
const { cellsA, cellsB, cellIsServer, displayNameA, displayNameB } =
  useCourtCells(state, teamMeta);

// Sync matches.ended_at to the engine's view of "match is finished". Going
// true → stamps the timestamp so the token RPCs auto-revoke co-scorer
// writes; going false → clears it so a score.correct that un-finishes the
// match re-opens token-path scoring. The watcher only fires on actual
// transitions, so we don't burn updates on every event. Owner-or-anon-match
// path (RLS gates this update); for token-only callers the write fails
// silently — they shouldn't be the ones ending matches anyway.
const supabaseClient = useSupabaseClient();
watch(
  () => state.value.matchOver,
  async (isOver, wasOver) => {
    if (isOver === wasOver) return;
    const { error } = await supabaseClient
      .from("matches")
      .update({ ended_at: isOver ? new Date().toISOString() : null })
      .eq("id", matchId.value);
    if (error) console.warn("[control] sync ended_at failed", error);
  },
);

// Seed the match.start event on first mount. Gated on canScore so a
// viewer who's about to be bounced (no access) doesn't write a phantom
// event into localStorage / try a forbidden insert before the redirect
// fires. Wait for accessLoaded too — during the optimistic load window
// canScore is also true but we shouldn't trust it.
onMounted(async () => {
  if (events.value.length !== 0) return;
  // Wait one tick so useWriteAccess has at least kicked off its fetch.
  await new Promise((r) => setTimeout(r, 0));
  if (!accessLoaded.value) {
    // Defer until the gate resolves.
    const stop = watch(accessLoaded, (ok) => {
      if (!ok) return;
      stop();
      if (canScore.value && events.value.length === 0) {
        append({
          type: "match.start",
          serverSide: "A",
          serverCourt: "right",
        } as Omit<RacquetEvent, "id" | "ts">);
      }
    });
    return;
  }
  if (canScore.value && events.value.length === 0) {
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

// Gate every event-emitting handler on the handoff lock. The overlay
// banner already disables pointer events on the score cells; this is a
// defensive backstop for code paths that fire through other entry points
// (more menu, undo button, modals).
const guardActive = (): boolean => {
  if (isActive.value) return true;
  toast.info("Another device is scoring. Tap 'Score from this device' first.");
  return false;
};

const onTap = (side: SideId) => {
  if (state.value.matchOver) return;
  // Active timeout or suspension pauses play — score taps no-op until the
  // operator clears them (Events sheet → "Clear timeout" / "Resume match").
  // Penalty cards don't pause play (BWF Law 16): yellow is a warning, red
  // awards a point already, black ends the match.
  if (state.value.timeout || state.value.suspended) return;
  if (state.value.betweenGames) return;
  if (!guardActive()) return;
  vibrate(10);
  append({ type: "point", side } as Omit<RacquetEvent, "id" | "ts">);
};

// Service-over haptic cue. Fires whenever the active server cell changes
// (team flip OR partner-swap on serve). The visual transition in TeamRow
// catches the eye; the soft second vibrate confirms the change to the
// operator without looking. Skip the first tick so opening a page doesn't
// buzz on initial server assignment.
const serveSignature = computed(
  () => `${state.value.servingSide}-${state.value.serverCourt}`,
);
let serveWatchSkippedFirst = false;
watch(serveSignature, () => {
  if (!serveWatchSkippedFirst) {
    serveWatchSkippedFirst = true;
    return;
  }
  vibrate(8);
});

const onUndo = () => {
  if (!guardActive()) return;
  vibrate(20);
  replace(applyRacquetUndo(events.value));
};

// Reset = restore a clean initial state. Wipes the event log AND clears the
// per-device visual sides-swap so the operator isn't left looking at a
// half-reset court (score 0–0 but ends still flipped from the previous run),
// then re-seeds `match.start` so the engine has a serving side again — without
// it the first post-reset tap appends a `point` with no preceding start event.
const onReset = () => {
  if (!guardActive()) return;
  sidesSwapped.value = false;
  replace([]);
  append({
    type: "match.start",
    serverSide: "A",
    serverCourt: "right",
  } as Omit<RacquetEvent, "id" | "ts">);
};

// Reset just the current game's score (mistake recovery without losing
// completed games). Uses the existing score.correct event so prior games
// + gamesWon stay intact and the engine recomputes flags from scratch.
const onResetCurrentGame = () => {
  const games = state.value.games;
  if (games.length === 0) return;
  if (!guardActive()) return;
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
  if (!guardActive()) return;
  vibrate(10);
  append({ type: "game.end" } as Omit<RacquetEvent, "id" | "ts">);
};

// Pre-rally swaps. Only valid before the first point — once a rally is
// scored, server identity is derived from the event log so we shouldn't
// rewrite history.
const canSwapInitial = computed(
  () => events.value.length === 1 && events.value[0]?.type === "match.start",
);

// Sides swap: mirrors the entire pre-match setup. Flips which screen edge
// each team occupies AND who serves first (operator realized they had it
// backwards). Replaces match.start so the log stays clean.
const sidesSwapped = useStorage<boolean>(
  computed(() => `sb:control-sides-swapped:${matchId.value}`),
  false,
);
// Visual-only ends swap. Used in GameOverModal between games and as the
// post-rally swap action — engine state untouched, only `sidesSwapped`
// flips. Operator decides per BWF Law 9.4 expectations vs. club practice.
const swapSidesVisualOnly = () => {
  vibrate(10);
  sidesSwapped.value = !sidesSwapped.value;
};

const swapSides = () => {
  const isPreMatch = canSwapInitial.value;
  // Visual-only flip is fine offline; the event rewrite below is the gated
  // part. We allow the visual flip even when inactive so the read-only
  // viewer can orient the court to their seat — only the match.start
  // rewrite needs the guard.
  vibrate(10);
  sidesSwapped.value = !sidesSwapped.value;
  // Pre-match swap also mirrors who serves first (operator setup was
  // backwards). Mid-game ends-change swap is visual only — server identity
  // is derived from the event log and shouldn't be rewritten.
  if (isPreMatch) {
    if (!guardActive()) return;
    const first = events.value[0];
    if (first && first.type === "match.start") {
      const opposite: SideId = first.serverSide === "A" ? "B" : "A";
      replace([]);
      append({
        type: "match.start",
        serverSide: opposite,
        serverCourt: "right",
      } as Omit<RacquetEvent, "id" | "ts">);
    }
  }
};

// Deciding-game ends-change. BWF Law 9.4: in the deciding game, players
// change ends when the leading score reaches 11. We don't enforce it —
// just expose the swap button again whenever it's relevant, since club
// players often skip ends-change. The button stays visible from 11 until
// the game ends so an operator who missed the moment can still act.
const isDecidingGame = computed(
  () =>
    state.value.gamesWon.a === config.value.gamesToWin - 1 &&
    state.value.gamesWon.b === config.value.gamesToWin - 1,
);
// Visible only at the interval moment in the deciding game (11 for BWF-21,
// 8 for BWF-15 — `state.atInterval` is engine-derived from `cfg.intervalAt`
// and is true only for the rally that crosses it, then false on the next
// score). If the operator doesn't act before the next point is scored, the
// button hides itself — matches club behavior where ends-change is often
// skipped.
const canSwapAtDecider = computed(
  () =>
    isDecidingGame.value &&
    !state.value.matchOver &&
    !state.value.betweenGames &&
    state.value.atInterval,
);
// Start of any in-progress game (score still 0-0) is also a valid swap
// moment — covers operators who clicked "Start Game N" without first
// hitting the swap button in the GameOverModal, or who change their mind.
const canSwapAtGameStart = computed(
  () =>
    !state.value.matchOver &&
    !state.value.betweenGames &&
    lastGame.value.a === 0 &&
    lastGame.value.b === 0,
);
const canSwapSidesVisible = computed(
  () =>
    canSwapInitial.value || canSwapAtGameStart.value || canSwapAtDecider.value,
);

// Per-team player swap (doubles only, pre-match). Swaps a1↔a2 (or b1↔b2)
// in meta — useCourtCells re-renders so the partner who was about to start
// on the right (server) court is now on the left and vice versa. Service
// still begins from the right court; this just picks which partner stands
// there.
const swapPlayers = (side: SideId) => {
  if (!canSwapInitial.value && !canSwapAtGameStart.value) return;
  const isDoubles = matchMeta.value.isDoubles ?? false;
  if (!isDoubles) return;
  vibrate(10);
  const current = matchMeta.value.players ?? {
    a1: "",
    a2: "",
    b1: "",
    b2: "",
  };
  matchMeta.value = {
    ...matchMeta.value,
    players:
      side === "A"
        ? { ...current, a1: current.a2, a2: current.a1 }
        : { ...current, b1: current.b2, b2: current.b1 },
  };
};

// Player swap writes to matches.players via useMatchMeta → only the owner
// (or anyone on an anon match) can persist it; co-scorers' edits would
// silently fail under RLS. Hide the arrow rather than letting them perform
// a local-only swap that never syncs to the owner.
const canSwapPlayersA = computed(
  () =>
    canEditMeta.value &&
    (canSwapInitial.value || canSwapAtGameStart.value) &&
    (matchMeta.value.isDoubles ?? false),
);
const canSwapPlayersB = canSwapPlayersA;

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
type SheetKind = "matchState" | "scoreCorrect" | "format" | null;
const openSheet = ref<SheetKind>(null);
const closeSheet = () => {
  openSheet.value = null;
};

// Long-press on Undo escalates to score correction — the natural next step
// when single-tap undo isn't enough. Short tap undoes the last point.
// VueUse `onLongPress` handles the timer + pointer cancel/move edge cases
// (small finger drift no longer fires the action). Threshold haptic fires
// when the long-press triggers so the operator feels the cross.
const undoBtn = ref<HTMLElement | null>(null);
onLongPress(
  undoBtn,
  () => {
    vibrate(15);
    openSheet.value = "scoreCorrect";
  },
  {
    delay: 400,
    onMouseUp: (_duration, _distance, isLongPress) => {
      if (!isLongPress) onUndo();
    },
  },
);

// Match-state actions
const onWalkover = (winner: SideId) => {
  if (!guardActive()) return;
  append({ type: "walkover", winner } as Omit<RacquetEvent, "id" | "ts">);
  closeSheet();
};
const onRetirement = (retiring: SideId) => {
  if (!guardActive()) return;
  append({ type: "retirement", retiring } as Omit<RacquetEvent, "id" | "ts">);
  closeSheet();
};
const onPenalty = (side: SideId, card: "yellow" | "red" | "black") => {
  if (!guardActive()) return;
  append({ type: "penalty", side, card } as Omit<RacquetEvent, "id" | "ts">);
  closeSheet();
};
const onTimeout = (side: SideId, kind: "standard" | "medical" | "injury") => {
  if (!guardActive()) return;
  append({ type: "timeout.start", side, kind } as Omit<
    RacquetEvent,
    "id" | "ts"
  >);
  closeSheet();
};
const onClearTimeout = () => {
  const t = state.value.timeout;
  if (!t) return;
  if (!guardActive()) return;
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
const onApplyScoreCorrect = (payload: {
  games: { a: number; b: number }[];
  gamesWon: { a: number; b: number };
}) => {
  if (!guardActive()) return;
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

// "New match" used to wipe events in-place via replace([]) — destructive,
// erased the finished match from history. Rematch now navigates to /new
// with the source id so the form pre-fills the same teams/format/court;
// submitting creates a new match row, preserving the just-played one.
const onRematch = () =>
  navigateTo({ path: "/new", query: { rematch: matchId.value } });

// Orientation prop for TeamRow: geometric edge each team occupies. Combines
// outer layout with the visual sides-swap toggle.
type Orientation = "top" | "bottom" | "left" | "right";
const orientationA = computed<Orientation>(() => {
  if (layout.value === "sideBySide")
    return sidesSwapped.value ? "right" : "left";
  return sidesSwapped.value ? "bottom" : "top";
});
const orientationB = computed<Orientation>(() => {
  if (layout.value === "sideBySide")
    return sidesSwapped.value ? "left" : "right";
  return sidesSwapped.value ? "top" : "bottom";
});
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
            v-if="canEditMeta"
            variant="link"
            size="sm"
            class="h-auto p-0 text-[11px] text-fg-muted hover:text-foreground"
            @click="openSheet = 'format'"
          >
            {{ presetLabel }} · {{ seriesLabel }}
          </Button>
          <span v-else class="text-[11px] text-fg-muted">
            {{ presetLabel }} · {{ seriesLabel }}
          </span>
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
           wrapper bg. Each row owns its own outer-ring highlight. Render
           order follows `sidesSwapped` so the swap is a real DOM reorder,
           not just a CSS reverse — TeamRow's orientation prop then anchors
           each team's header to the correct screen edge. -->
      <div
        class="relative m-2 flex flex-1 gap-px overflow-hidden rounded-lg bg-foreground/30 ring-1 ring-foreground/30"
        :class="layout === 'sideBySide' ? 'flex-row' : 'flex-col'"
      >
        <template
          v-for="team in sidesSwapped ? ['B', 'A'] : ['A', 'B']"
          :key="team"
        >
          <TeamRow
            v-if="team === 'A'"
            team="A"
            :orientation="orientationA"
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
            :can-swap-players="canSwapPlayersA"
            :cards="state.cards.a"
            :is-doubles="teamMeta.isDoubles"
            :display-name="displayNameA"
            @tap="onTap('A')"
            @swap-players="swapPlayers('A')"
          />
          <TeamRow
            v-else
            team="B"
            :orientation="orientationB"
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
            :can-swap-players="canSwapPlayersB"
            :cards="state.cards.b"
            :is-doubles="teamMeta.isDoubles"
            :display-name="displayNameB"
            @tap="onTap('B')"
            @swap-players="swapPlayers('B')"
          />
        </template>

        <!-- Sides swap. Sits centered on the line between the two team rows;
             icon orientation follows the outer layout. Visible:
              • pre-match (operator fixing setup — also mirrors server),
              • in the deciding game from 11 onward (BWF ends-change moment;
                visual only, optional — club play often skips it). -->
        <button
          v-if="canSwapSidesVisible"
          type="button"
          aria-label="Swap sides (put the other team on the other court)"
          class="absolute left-1/2 top-1/2 z-20 inline-flex -translate-x-1/2 -translate-y-1/2 items-center gap-1 rounded-full border border-border-strong bg-background/95 px-2 py-1 text-[9px] font-bold uppercase tracking-wider text-foreground shadow-lg backdrop-blur-sm hover:bg-background"
          @click="swapSides"
        >
          <component
            :is="layout === 'sideBySide' ? ArrowLeftRight : ArrowUpDown"
            class="size-3"
          />
          Swap sides
        </button>

        <!-- Take-over overlay. Sits above the court, dims it slightly, and
             intercepts taps with a "Score from this device" reclaim button.
             Pointer-events on the cells underneath are blocked by this
             layer; on-screen score stays visible so the read-only viewer
             still tracks the match. -->
        <div
          v-if="!isActive"
          class="absolute inset-0 z-30 flex items-center justify-center bg-background/55 backdrop-blur-[1px]"
        >
          <div
            class="flex flex-col items-center gap-3 rounded-lg border border-border-strong bg-background/95 px-4 py-3 shadow-xl"
          >
            <span
              class="text-[11px] font-bold uppercase tracking-wider text-fg-muted"
            >
              Another device is scoring
            </span>
            <Button type="button" size="sm" @click="claimScoring">
              Score from this device
            </Button>
            <span class="max-w-[16rem] text-center text-[10px] text-fg-subtle">
              Taking over disables scoring on the other device until they
              reclaim it.
            </span>
          </div>
        </div>
      </div>

      <!-- Bottom action bar. Single button — short tap undoes last point,
           long-press escalates to score correction. Wider audit / multi-step
           recovery lives in the 3-dot menu (match-state sheet). -->
      <footer
        class="h-14 flex-shrink-0 px-3 flex items-center justify-between border-t border-border"
      >
        <Button ref="undoBtn" variant="outline" size="sm" class="select-none">
          <Undo2 class="size-4" />
          Undo
        </Button>
        <span class="text-[11px] text-fg-subtle"
          >long-press to correct score</span
        >
      </footer>

      <MatchOverModal
        v-if="state.matchOver"
        :end-reason="state.endReason"
        :winner-name="winnerName"
        :games-won="gamesWon"
        @rematch="onRematch"
        @back="goHome"
      />

      <GameOverModal
        v-else-if="state.betweenGames && games.length > 0"
        :game-number="games.length"
        :winner-name="lastGameWinnerName"
        :game-score="lastGameScore"
        :match-score="gamesWon"
        :next-game-number="games.length + 1"
        :sides-swapped="sidesSwapped"
        @start-next="onStartNextGame"
        @swap-sides="swapSidesVisualOnly"
      />

      <!-- Sheet backdrop -->
      <div
        v-if="openSheet"
        class="absolute inset-0 z-40 bg-overlay"
        @click="closeSheet"
      />

      <MatchStateSheet
        v-if="openSheet === 'matchState'"
        :team-names="{ a: displayNameA, b: displayNameB }"
        :games-to-win="config.gamesToWin"
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
        :games-to-win="config.gamesToWin"
        :team-names="{ a: displayNameA, b: displayNameB }"
        @apply="onApplyScoreCorrect"
        @close="closeSheet"
      />
    </div>
  </div>
</template>
