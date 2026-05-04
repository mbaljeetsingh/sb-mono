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
        aria-label="Settings"
      >
        ⚙
      </button>
    </header>

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
              >✓</span
            >
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
        class="h-9 px-3 rounded-md border border-border bg-surface text-foreground text-sm font-medium hover:bg-surface-2"
        @click="onUndo"
      >
        ↶ Undo
      </button>
      <span class="text-[11px] text-fg-subtle">long-press for events</span>
      <button
        type="button"
        class="h-9 px-3 rounded-md border border-border bg-surface text-foreground text-sm font-medium hover:bg-surface-2"
        @click="onReset"
      >
        Reset
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
          MATCH COMPLETE
        </div>
        <div class="text-[28px] font-semibold mb-4">
          {{ state.winner === "A" ? teamNames.a : teamNames.b }} wins
        </div>
        <div
          class="score text-[90px] font-bold flex items-baseline justify-center gap-2 mb-6"
        >
          <span>{{ gamesWon.a }}</span>
          <span class="opacity-40 text-[60px]">–</span>
          <span>{{ gamesWon.b }}</span>
        </div>
        <button
          type="button"
          class="h-12 w-full rounded-md bg-brand text-brand-foreground font-semibold hover:bg-brand-hover transition-colors"
          @click="onReset"
        >
          New match
        </button>
      </div>
    </div>
  </div>
</template>
