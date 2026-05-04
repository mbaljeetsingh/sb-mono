<script setup lang="ts">
import {
  type RacquetEvent,
  type SideId,
  badminton21,
  reduceBadminton,
  applyBadmintonUndo,
} from "@sb/engine";

definePageMeta({ layout: false });

const route = useRoute();
const matchId = computed(() => String(route.params.id ?? ""));
const config = badminton21;
const teamNames = ref({ a: "Priya / Anu", b: "Karan / Jay" });

// Pick up team names persisted by /new
onMounted(() => {
  if (typeof localStorage === "undefined") return;
  try {
    const raw = localStorage.getItem(`sb:meta:${matchId.value}`);
    if (raw) {
      const meta = JSON.parse(raw);
      if (meta?.teamNames) teamNames.value = meta.teamNames;
    }
  } catch {}
});

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

const state = computed(() => reduceBadminton(events.value, config));

const score = (side: SideId) => {
  const last = state.value.games[state.value.games.length - 1];
  if (!last) return 0;
  return side === "A" ? last.a : last.b;
};

const onTap = (side: SideId) => {
  if (state.value.matchOver) return;
  if (typeof navigator !== "undefined" && "vibrate" in navigator)
    navigator.vibrate?.(10);
  append({ type: "point", side } as Omit<RacquetEvent, "id" | "ts">);
};

const onUndo = () => {
  if (typeof navigator !== "undefined" && "vibrate" in navigator)
    navigator.vibrate?.(20);
  replace(applyBadmintonUndo(events.value));
};

const onReset = () => replace([]);

const isGlowing = computed<SideId | null>(() => {
  if (!state.value.isGamePoint && !state.value.isMatchPoint) return null;
  return state.value.servingSide;
});

const serverArrow = computed(() =>
  state.value.serverCourt === "right" ? "↘" : "↙",
);

const games = computed(() => state.value.games);
const gamesWon = computed(() => state.value.gamesWon);

const headerLabel = computed(() => {
  const cur = games.value.length;
  if (state.value.matchOver) return "Match complete";
  if (state.value.betweenGames)
    return `Between games · ${gamesWon.value.a}–${gamesWon.value.b}`;
  return `Game ${cur} · BWF 21 · BO3`;
});

const wakeLock = useWakeLock();
onMounted(() => wakeLock.request("screen"));
onUnmounted(() => wakeLock.release());

// ─────────── Sheets ───────────
type SheetKind = "events" | "matchState" | "scoreCorrect" | null;
const openSheet = ref<SheetKind>(null);
const closeSheet = () => (openSheet.value = null);

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
  <div
    class="fixed inset-0 flex flex-col bg-background text-foreground font-sans"
  >
    <!-- Top chrome -->
    <header
      class="h-12 flex-shrink-0 px-3 flex items-center justify-between border-b border-border"
    >
      <button
        type="button"
        class="size-11 rounded-md text-fg-muted hover:bg-surface-2 hover:text-foreground text-xl"
        aria-label="Back"
        @click="navigateTo(`/m/${matchId}`)"
      >
        ←
      </button>
      <span
        class="text-[11px] font-semibold tracking-wider text-fg-muted uppercase"
      >
        {{ headerLabel }}
      </span>
      <button
        type="button"
        class="size-11 rounded-md text-fg-muted hover:bg-surface-2 hover:text-foreground text-xl"
        aria-label="More"
        @click="openSheet = 'matchState'"
      >
        ⋯
      </button>
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
      <button
        type="button"
        class="text-xs font-semibold underline"
        @click="onClearTimeout"
      >
        End
      </button>
    </div>

    <!-- Suspension banner -->
    <div
      v-if="state.suspended"
      class="px-4 py-2 bg-danger-soft text-danger text-xs font-bold tracking-wider uppercase"
    >
      ⏸ MATCH SUSPENDED
    </div>

    <!-- Team A tap zone -->
    <button
      type="button"
      class="flex-1 m-2 rounded-lg p-5 flex flex-col justify-between text-left text-team-a bg-team-a-soft border-[1.5px] disabled:cursor-not-allowed disabled:opacity-65 active:brightness-95 transition-[border-color] duration-200"
      :class="[
        isGlowing === 'A'
          ? 'border-team-a animate-glow-a'
          : 'border-transparent',
      ]"
      :disabled="state.matchOver"
      :aria-label="`Team A score ${score('A')}, tap to add point`"
      @click="onTap('A')"
    >
      <div class="flex justify-between items-start w-full">
        <div class="flex flex-col gap-1 text-left">
          <div
            class="text-[11px] font-bold tracking-[0.06em] uppercase text-team-a"
          >
            TEAM A
          </div>
          <div
            class="text-[17px] font-semibold text-foreground leading-snug max-w-[200px]"
          >
            {{ teamNames.a }}
          </div>
        </div>
        <div
          v-if="
            state.servingSide === 'A' &&
            (state.isMatchPoint || state.isGamePoint)
          "
          class="px-2 py-1 rounded-sm text-[11px] font-bold tracking-[0.06em] bg-team-a text-team-a-foreground"
        >
          {{ state.isMatchPoint ? "MATCH PT" : "GAME PT" }}
        </div>
      </div>

      <div class="flex items-end justify-between gap-3">
        <span
          class="score text-[clamp(96px,22vh,168px)] font-bold tracking-[-0.05em] leading-[0.85]"
        >
          {{ score("A") }}
        </span>
        <div class="flex flex-col items-end gap-2 pb-2">
          <div class="flex gap-1">
            <span
              v-for="i in config.gamesToWin + 1"
              :key="`a-${i}`"
              class="size-[10px] rounded-full"
              :class="i <= gamesWon.a ? 'bg-team-a' : 'bg-border-strong'"
            />
          </div>
          <div
            v-if="state.servingSide === 'A'"
            class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-bold tracking-[0.06em] bg-team-a text-team-a-foreground"
          >
            <span class="size-[5px] rounded-full bg-white animate-pulse-soft" />
            SERVE {{ serverArrow }}
          </div>
        </div>
      </div>
    </button>

    <!-- Centerbar -->
    <div
      class="h-9 px-3 flex items-center justify-between border-y border-border bg-background/80 backdrop-blur-sm text-sm text-fg-muted"
    >
      <span class="flex items-center gap-2">
        <template v-for="(g, i) in games" :key="i">
          <span class="font-mono tabular-nums inline-flex gap-1 items-baseline">
            <span class="score text-sm">{{ g.a }}</span>
            <span class="opacity-40">–</span>
            <span class="score text-sm">{{ g.b }}</span>
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
      <span
        v-if="state.atInterval"
        class="text-[11px] font-bold tracking-[0.06em] uppercase text-warning bg-warning-soft px-2 py-0.5 rounded-sm"
      >
        INTERVAL
      </span>
    </div>

    <!-- Team B tap zone -->
    <button
      type="button"
      class="flex-1 m-2 rounded-lg p-5 flex flex-col justify-between text-left text-team-b bg-team-b-soft border-[1.5px] disabled:cursor-not-allowed disabled:opacity-65 active:brightness-95 transition-[border-color] duration-200"
      :class="[
        isGlowing === 'B'
          ? 'border-team-b animate-glow-b'
          : 'border-transparent',
      ]"
      :disabled="state.matchOver"
      :aria-label="`Team B score ${score('B')}, tap to add point`"
      @click="onTap('B')"
    >
      <div class="flex justify-between items-start w-full">
        <div class="flex flex-col gap-1 text-left">
          <div
            class="text-[11px] font-bold tracking-[0.06em] uppercase text-team-b"
          >
            TEAM B
          </div>
          <div
            class="text-[17px] font-semibold text-foreground leading-snug max-w-[200px]"
          >
            {{ teamNames.b }}
          </div>
        </div>
        <div
          v-if="
            state.servingSide === 'B' &&
            (state.isMatchPoint || state.isGamePoint)
          "
          class="px-2 py-1 rounded-sm text-[11px] font-bold tracking-[0.06em] bg-team-b text-team-b-foreground"
        >
          {{ state.isMatchPoint ? "MATCH PT" : "GAME PT" }}
        </div>
      </div>

      <div class="flex items-end justify-between gap-3">
        <span
          class="score text-[clamp(96px,22vh,168px)] font-bold tracking-[-0.05em] leading-[0.85]"
        >
          {{ score("B") }}
        </span>
        <div class="flex flex-col items-end gap-2 pb-2">
          <div class="flex gap-1">
            <span
              v-for="i in config.gamesToWin + 1"
              :key="`b-${i}`"
              class="size-[10px] rounded-full"
              :class="i <= gamesWon.b ? 'bg-team-b' : 'bg-border-strong'"
            />
          </div>
          <div
            v-if="state.servingSide === 'B'"
            class="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-bold tracking-[0.06em] bg-team-b text-team-b-foreground"
          >
            <span class="size-[5px] rounded-full bg-white animate-pulse-soft" />
            SERVE {{ serverArrow }}
          </div>
        </div>
      </div>
    </button>

    <!-- Bottom action bar -->
    <footer
      class="h-14 flex-shrink-0 px-3 flex items-center justify-between border-t border-border"
    >
      <button
        type="button"
        class="h-9 px-3 rounded-md border border-border bg-surface text-foreground text-sm font-medium hover:bg-surface-2 select-none"
        @pointerdown="onUndoPointerDown"
        @pointerup="onUndoPointerUp"
        @pointerleave="onUndoPointerUp"
      >
        ↶ Undo
      </button>
      <span class="text-[11px] text-fg-subtle">long-press for events</span>
      <button
        type="button"
        class="h-9 px-3 rounded-md border border-border bg-surface text-foreground text-sm font-medium hover:bg-surface-2"
        @click="openSheet = 'matchState'"
      >
        Events
      </button>
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
          {{ state.winner === "A" ? teamNames.a : teamNames.b }} wins
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
          <button
            type="button"
            class="h-12 w-full rounded-md bg-brand text-brand-foreground font-semibold hover:bg-brand-hover transition-colors"
            @click="onReset"
          >
            New match
          </button>
          <button
            type="button"
            class="h-9 w-full rounded-md text-foreground text-sm hover:bg-surface-2"
            @click="navigateTo(`/m/${matchId}`)"
          >
            Back to dashboard
          </button>
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
        <span class="text-[11px] text-fg-subtle">tap to undo back to here</span>
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
          <button
            v-if="!e.isSystem"
            type="button"
            class="text-team-a text-sm font-semibold"
            @click="undoTo(e.idx)"
          >
            ↶
          </button>
        </div>
        <div
          v-if="recentEvents.length === 0"
          class="text-fg-subtle text-sm py-4 text-center"
        >
          No events yet
        </div>
      </div>
      <div class="flex justify-between gap-2 mt-3 pt-3 border-t border-border">
        <button
          type="button"
          class="h-9 px-3 rounded-md border border-border bg-surface text-sm font-medium hover:bg-surface-2"
          @click="openScoreCorrect"
        >
          Score correction →
        </button>
        <button
          type="button"
          class="h-9 px-3 rounded-md bg-team-a text-team-a-foreground text-sm font-semibold inline-flex items-center gap-1"
          @click="
            () => {
              onUndo();
              closeSheet();
            }
          "
        >
          ↶ Undo last
        </button>
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
        <button
          type="button"
          class="h-9 px-3 rounded-md border border-border bg-surface text-sm font-medium hover:bg-surface-2"
          @click="onTimeout('A', 'standard')"
        >
          ⏸ Timeout · A
        </button>
        <button
          type="button"
          class="h-9 px-3 rounded-md border border-border bg-surface text-sm font-medium hover:bg-surface-2"
          @click="onTimeout('B', 'standard')"
        >
          ⏸ Timeout · B
        </button>
      </div>
      <div class="grid grid-cols-2 gap-2 mb-5">
        <button
          type="button"
          class="h-9 px-3 rounded-md border border-border bg-surface text-sm font-medium hover:bg-surface-2"
          @click="onTimeout('A', 'medical')"
        >
          + Medical · A
        </button>
        <button
          type="button"
          class="h-9 px-3 rounded-md border border-border bg-surface text-sm font-medium hover:bg-surface-2"
          @click="onTimeout('B', 'medical')"
        >
          + Medical · B
        </button>
      </div>

      <div
        class="text-[11px] font-bold tracking-wider uppercase text-fg-subtle mb-2"
      >
        End match
      </div>
      <div class="flex flex-col gap-2 mb-3">
        <button
          type="button"
          class="p-3 rounded-md border border-border bg-surface flex items-center gap-3 text-left hover:bg-surface-2"
          @click="onWalkover('A')"
        >
          <span class="text-team-a text-lg">⚑</span>
          <span class="flex-1">
            <span class="block text-sm font-semibold">Walkover · A wins</span>
            <span class="block text-[11px] text-fg-subtle">B didn't show</span>
          </span>
          <span>›</span>
        </button>
        <button
          type="button"
          class="p-3 rounded-md border border-border bg-surface flex items-center gap-3 text-left hover:bg-surface-2"
          @click="onWalkover('B')"
        >
          <span class="text-team-b text-lg">⚑</span>
          <span class="flex-1">
            <span class="block text-sm font-semibold">Walkover · B wins</span>
            <span class="block text-[11px] text-fg-subtle">A didn't show</span>
          </span>
          <span>›</span>
        </button>
        <button
          type="button"
          class="p-3 rounded-md border border-border bg-surface flex items-center gap-3 text-left hover:bg-surface-2"
          @click="onRetirement('A')"
        >
          <span class="text-team-a text-lg">✕</span>
          <span class="flex-1">
            <span class="block text-sm font-semibold">Retirement · A</span>
            <span class="block text-[11px] text-fg-subtle"
              >A injured · B wins</span
            >
          </span>
          <span>›</span>
        </button>
        <button
          type="button"
          class="p-3 rounded-md border border-border bg-surface flex items-center gap-3 text-left hover:bg-surface-2"
          @click="onRetirement('B')"
        >
          <span class="text-team-b text-lg">✕</span>
          <span class="flex-1">
            <span class="block text-sm font-semibold">Retirement · B</span>
            <span class="block text-[11px] text-fg-subtle"
              >B injured · A wins</span
            >
          </span>
          <span>›</span>
        </button>
      </div>

      <button
        type="button"
        class="w-full h-9 rounded-md border border-border bg-surface text-sm font-medium hover:bg-surface-2 mt-2"
        @click="openScoreCorrect"
      >
        Score correction…
      </button>
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
          <input
            v-model="g.a"
            type="number"
            inputmode="numeric"
            class="flex-1 h-10 text-center font-mono text-base font-semibold tabular-nums bg-surface border border-border-strong rounded-md outline-none focus-visible:border-ring"
          />
          <span class="text-fg-muted">—</span>
          <input
            v-model="g.b"
            type="number"
            inputmode="numeric"
            class="flex-1 h-10 text-center font-mono text-base font-semibold tabular-nums bg-surface border border-border-strong rounded-md outline-none focus-visible:border-ring"
          />
        </div>
      </div>

      <div
        class="text-[11px] font-bold tracking-wider uppercase text-fg-subtle mb-2"
      >
        Games won
      </div>
      <div class="flex gap-2 mb-4">
        <input
          v-model.number="correctGamesWon.a"
          type="number"
          inputmode="numeric"
          min="0"
          class="flex-1 h-10 text-center font-mono text-base font-semibold tabular-nums bg-surface border border-border-strong rounded-md outline-none focus-visible:border-ring"
        />
        <span class="text-fg-muted self-center">vs</span>
        <input
          v-model.number="correctGamesWon.b"
          type="number"
          inputmode="numeric"
          min="0"
          class="flex-1 h-10 text-center font-mono text-base font-semibold tabular-nums bg-surface border border-border-strong rounded-md outline-none focus-visible:border-ring"
        />
      </div>

      <div class="flex gap-2">
        <button
          type="button"
          class="flex-1 h-10 rounded-md border border-border bg-surface text-sm font-medium hover:bg-surface-2"
          @click="closeSheet"
        >
          Cancel
        </button>
        <button
          type="button"
          class="flex-[2] h-10 rounded-md bg-brand text-brand-foreground text-sm font-semibold hover:bg-brand-hover"
          @click="applyScoreCorrect"
        >
          Apply correction
        </button>
      </div>
    </div>
  </div>
</template>
