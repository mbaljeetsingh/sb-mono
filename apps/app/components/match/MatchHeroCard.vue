<script setup lang="ts">
import type { GameScore } from '@sb/engine';
import { computed } from 'vue';

const props = defineProps<{
  matchOver: boolean;
  displayName: string;
  statusLabel: string;
  teamNames: { a: string; b: string };
  totalSlots: number;
  scoreA: number;
  scoreB: number;
  gamesWonA: number;
  gamesWonB: number;
  games: GameScore[];
  gamesToWin: number;
}>();

const isSingleGame = computed(() => props.gamesToWin <= 1);

// BO1: when the match is over, "games won" is 0/1 which conveys nothing —
// the meaningful number is the final game's point score (e.g. 21–15).
const headlineA = computed(() => {
  if (props.matchOver && isSingleGame.value) {
    return props.games[0]?.a ?? props.scoreA;
  }
  return props.matchOver ? props.gamesWonA : props.scoreA;
});
const headlineB = computed(() => {
  if (props.matchOver && isSingleGame.value) {
    return props.games[0]?.b ?? props.scoreB;
  }
  return props.matchOver ? props.gamesWonB : props.scoreB;
});

// For BO-n, show the per-game point breakdown beneath the headline so prior
// games are visible too. Live: only completed games (the in-progress one is
// already the headline live score). Final: all games are complete.
const completedGames = computed<GameScore[]>(() => {
  if (isSingleGame.value) return [];
  if (props.matchOver) return props.games;
  return props.games.slice(0, -1);
});
</script>

<template>
  <div
    class="rounded-lg p-4 border transition-colors"
    :class="
      matchOver
        ? 'bg-foreground text-background border-foreground'
        : 'bg-surface text-foreground border-border'
    "
  >
    <div class="flex justify-between items-center mb-3">
      <span class="inline-flex gap-1.5 items-center">
        <span
          v-if="matchOver"
          class="px-2 py-0.5 rounded text-[10px] font-bold tracking-[0.06em] uppercase bg-success-soft text-success"
        >
          Final
        </span>
        <!-- LIVE is a status, not a competitor: it used to be painted with
             team-a, which read as "team A is live" next to team B's score. -->
        <span
          v-else
          class="inline-flex items-center gap-1 text-[10px] font-bold tracking-[0.1em] uppercase text-live"
        >
          <span class="size-1.5 rounded-full bg-live animate-pulse-soft" />
          LIVE
        </span>
        <span class="text-sm text-fg-muted">{{ displayName }}</span>
      </span>
      <span v-if="!matchOver" class="text-sm text-fg-subtle">
        {{ statusLabel }}
      </span>
    </div>
    <div class="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
      <div>
        <div
          class="text-sm mb-0.5"
          :class="matchOver ? 'text-background/70' : 'text-fg-muted'"
        >
          {{ teamNames.a }}
        </div>
        <div class="score text-[40px]">
          {{ headlineA }}
        </div>
        <div v-if="!isSingleGame" class="flex gap-1 mt-1">
          <span
            v-for="i in totalSlots"
            :key="`a-${i}`"
            class="size-1.5 rounded-full"
            :style="{
              background:
                i <= gamesWonA
                  ? 'var(--color-team-a)'
                  : 'var(--color-border-strong)',
            }"
          />
        </div>
      </div>
      <span class="text-sm text-fg-subtle">vs</span>
      <div class="text-right">
        <div
          class="text-sm mb-0.5"
          :class="matchOver ? 'text-background/70' : 'text-fg-muted'"
        >
          {{ teamNames.b }}
        </div>
        <div class="score text-[40px]">
          {{ headlineB }}
        </div>
        <div v-if="!isSingleGame" class="flex gap-1 mt-1 justify-end">
          <span
            v-for="i in totalSlots"
            :key="`b-${i}`"
            class="size-1.5 rounded-full"
            :style="{
              background:
                i <= gamesWonB
                  ? 'var(--color-team-b)'
                  : 'var(--color-border-strong)',
            }"
          />
        </div>
      </div>
    </div>
    <div
      v-if="completedGames.length > 0"
      class="mt-3 flex flex-wrap gap-1.5 text-[11px] font-medium tabular-nums"
      :class="matchOver ? 'text-background/70' : 'text-fg-muted'"
    >
      <span
        v-for="(g, i) in completedGames"
        :key="`g-${i}`"
        class="px-1.5 py-0.5 rounded border"
        :class="
          matchOver
            ? 'border-background/20 bg-background/10'
            : 'border-border bg-surface-2'
        "
      >
        G{{ i + 1 }} {{ g.a }}–{{ g.b }}
      </span>
    </div>
  </div>
</template>
