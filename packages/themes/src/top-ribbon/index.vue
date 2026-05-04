<script setup lang="ts">
import type { ThemeProps } from "../index";

const props = defineProps<ThemeProps>();

const score = (side: "a" | "b") => {
  const last = props.state.games[props.state.games.length - 1];
  return last ? last[side] : 0;
};

const subLabel = computed(() => {
  if (props.state.matchOver) return "FINAL";
  if (props.state.isMatchPoint)
    return `MATCH POINT · TEAM ${props.state.servingSide}`;
  if (props.state.isGamePoint)
    return `GAME POINT · TEAM ${props.state.servingSide}`;
  return `GAME ${props.state.games.length} · LIVE`;
});

const topMeta = computed(() => {
  const m = props.meta ?? {};
  return [m.sportLabel ?? "BADMINTON", m.round, m.category, m.courtLabel]
    .filter(Boolean)
    .join(" · ");
});
</script>

<template>
  <!-- Top full-width ribbon -->
  <div
    class="absolute top-0 inset-x-0 h-16 grid grid-cols-3 items-center px-6 border-b-2 border-amber-400 bg-[linear-gradient(180deg,rgba(10,10,10,0.95)_0%,rgba(23,23,23,0.95)_100%)]"
  >
    <!-- Left team -->
    <div class="flex items-center gap-3">
      <span class="w-1 h-9" :style="{ background: 'var(--color-team-a)' }" />
      <div>
        <div
          class="text-[13px] font-semibold text-neutral-50 leading-tight uppercase"
        >
          {{ teamNames.a }}
        </div>
        <div class="flex gap-0.5 mt-0.5">
          <span
            v-for="i in config.gamesToWin + 1"
            :key="`a-${i}`"
            class="size-[5px] rounded-full"
            :style="{
              background:
                i <= state.gamesWon.a ? 'var(--color-team-a)' : '#404040',
            }"
          />
        </div>
      </div>
      <span
        v-if="state.servingSide === 'A' && !state.matchOver"
        class="size-4 rounded-full inline-flex items-center justify-center text-white text-[8px] font-bold"
        :style="{ background: 'var(--color-team-a)' }"
        >S</span
      >
    </div>

    <!-- Center score -->
    <div class="flex items-center justify-center gap-3.5">
      <span class="score text-[40px] text-neutral-50">{{ score("a") }}</span>
      <span class="text-lg text-neutral-600 font-medium">—</span>
      <span class="score text-[40px] text-neutral-50">{{ score("b") }}</span>
    </div>

    <!-- Right team -->
    <div class="flex items-center gap-3 justify-end">
      <span
        v-if="state.servingSide === 'B' && !state.matchOver"
        class="size-4 rounded-full inline-flex items-center justify-center text-white text-[8px] font-bold"
        :style="{ background: 'var(--color-team-b)' }"
        >S</span
      >
      <div class="text-right">
        <div
          class="text-[13px] font-semibold text-neutral-50 leading-tight uppercase"
        >
          {{ teamNames.b }}
        </div>
        <div class="flex gap-0.5 mt-0.5 justify-end">
          <span
            v-for="i in config.gamesToWin + 1"
            :key="`b-${i}`"
            class="size-[5px] rounded-full"
            :style="{
              background:
                i <= state.gamesWon.b ? 'var(--color-team-b)' : '#404040',
            }"
          />
        </div>
      </div>
      <span class="w-1 h-9" :style="{ background: 'var(--color-team-b)' }" />
    </div>
  </div>

  <!-- Sub-ribbon: meta -->
  <div
    class="absolute top-16 inset-x-0 h-[22px] bg-amber-400/95 text-neutral-950 flex items-center justify-between px-6 text-[10px] font-bold tracking-[0.1em] uppercase"
  >
    <span>{{ topMeta }}</span>
    <span>{{ subLabel }}</span>
  </div>
</template>
