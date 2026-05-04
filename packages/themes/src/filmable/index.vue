<script setup lang="ts">
import type { ThemeProps } from "../index";

const props = defineProps<ThemeProps>();

const score = (side: "a" | "b") => {
  const last = props.state.games[props.state.games.length - 1];
  return last ? last[side] : 0;
};

const liveLabel = computed(() => {
  if (props.state.matchOver) return "FINAL";
  return "LIVE";
});

const topMeta = computed(() => {
  const m = props.meta ?? {};
  return [
    m.sportLabel ?? "BADMINTON",
    `BO${(props.config.gamesToWin - 1) * 2 + 1}`,
    m.category,
    m.round,
  ]
    .filter(Boolean)
    .join(" · ");
});

const previousGames = computed(() => {
  const finished = props.state.games.length - (props.state.matchOver ? 0 : 1);
  return props.state.games.slice(0, Math.max(finished, 0));
});
</script>

<template>
  <div class="absolute inset-0 bg-black text-neutral-50 overflow-hidden">
    <!-- Top meta strip -->
    <div
      class="absolute top-0 inset-x-0 px-9 pt-6 flex justify-between items-center"
    >
      <div
        class="text-[13px] tracking-[0.1em] font-bold text-neutral-400 uppercase"
      >
        {{ topMeta }}
      </div>
      <span
        v-if="state.matchOver"
        class="text-base font-bold tracking-[0.18em] text-amber-400"
        >FINAL</span
      >
      <span
        v-else
        class="inline-flex items-center gap-2 text-[13px] font-bold tracking-[0.16em]"
        :style="{ color: 'var(--color-team-a)' }"
      >
        <span
          class="size-2 rounded-full animate-pulse-soft"
          :style="{ background: 'var(--color-team-a)' }"
        />
        LIVE
      </span>
    </div>

    <!-- Big scoreboard -->
    <div
      class="absolute top-16 left-9 right-9 bottom-24 grid grid-cols-[1fr_auto_1fr] items-center gap-9"
    >
      <!-- Team A -->
      <div
        class="text-left rounded-xl transition-all duration-200 p-3"
        :class="{
          'bg-[var(--color-team-a-soft)]':
            (state.isMatchPoint || state.isGamePoint) &&
            state.servingSide === 'A',
        }"
      >
        <div class="flex gap-2 mb-2 items-center">
          <span
            class="px-2 py-0.5 rounded text-white text-[10px] font-bold tracking-[0.1em]"
            :style="{ background: 'var(--color-team-a)' }"
            >TEAM A</span
          >
          <span
            v-if="state.matchOver && state.winner === 'A'"
            class="text-[10px] font-bold tracking-[0.16em] text-amber-400"
            >★ WINNER</span
          >
          <span
            v-if="state.servingSide === 'A' && !state.matchOver"
            class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/5 text-[9px] font-bold tracking-[0.1em]"
            :style="{ color: 'var(--color-team-a)' }"
          >
            <span
              class="size-1.5 rounded-full animate-pulse-soft"
              :style="{ background: 'var(--color-team-a)' }"
            />
            SERVE
          </span>
        </div>
        <div class="text-2xl font-semibold leading-snug uppercase">
          {{ teamNames.a }}
        </div>
        <div
          class="text-[11px] tracking-[0.1em] text-neutral-500 font-medium mt-0.5 uppercase"
        >
          {{ meta?.venue || "" }}
        </div>
        <div class="score mt-1 text-[152px] leading-[0.9]">
          {{ score("a") }}
        </div>
        <div class="flex gap-1.5 mt-1">
          <span
            v-for="i in config.gamesToWin + 1"
            :key="`a-${i}`"
            class="size-3 rounded-full"
            :style="{
              background:
                i <= state.gamesWon.a ? 'var(--color-team-a)' : 'transparent',
              border: i <= state.gamesWon.a ? 'none' : '1px solid #404040',
            }"
          />
        </div>
      </div>

      <div
        class="text-center text-neutral-700 text-3xl font-semibold font-mono"
      >
        vs
      </div>

      <!-- Team B -->
      <div
        class="text-right rounded-xl transition-all duration-200 p-3"
        :class="{
          'bg-[var(--color-team-b-soft)]':
            (state.isMatchPoint || state.isGamePoint) &&
            state.servingSide === 'B',
        }"
      >
        <div class="flex gap-2 mb-2 items-center justify-end">
          <span
            v-if="state.servingSide === 'B' && !state.matchOver"
            class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/5 text-[9px] font-bold tracking-[0.1em]"
            :style="{ color: 'var(--color-team-b)' }"
          >
            <span
              class="size-1.5 rounded-full animate-pulse-soft"
              :style="{ background: 'var(--color-team-b)' }"
            />
            SERVE
          </span>
          <span
            v-if="state.matchOver && state.winner === 'B'"
            class="text-[10px] font-bold tracking-[0.16em] text-amber-400"
            >★ WINNER</span
          >
          <span
            class="px-2 py-0.5 rounded text-white text-[10px] font-bold tracking-[0.1em]"
            :style="{ background: 'var(--color-team-b)' }"
            >TEAM B</span
          >
        </div>
        <div class="text-2xl font-semibold leading-snug uppercase">
          {{ teamNames.b }}
        </div>
        <div
          class="text-[11px] tracking-[0.1em] text-neutral-500 font-medium mt-0.5 uppercase"
        >
          {{ meta?.venue || "" }}
        </div>
        <div class="score mt-1 text-[152px] leading-[0.9]">
          {{ score("b") }}
        </div>
        <div class="flex gap-1.5 mt-1 justify-end">
          <span
            v-for="i in config.gamesToWin + 1"
            :key="`b-${i}`"
            class="size-3 rounded-full"
            :style="{
              background:
                i <= state.gamesWon.b ? 'var(--color-team-b)' : 'transparent',
              border: i <= state.gamesWon.b ? 'none' : '1px solid #404040',
            }"
          />
        </div>
      </div>
    </div>

    <!-- Match-point flash bar -->
    <div
      v-if="state.isGamePoint || state.isMatchPoint"
      class="absolute bottom-20 inset-x-0 h-7 text-white text-[13px] font-bold tracking-[0.18em] flex items-center justify-center gap-3"
      :style="{
        background:
          state.servingSide === 'A'
            ? 'linear-gradient(90deg, var(--color-team-a), color-mix(in srgb, var(--color-team-a) 80%, black))'
            : 'linear-gradient(90deg, var(--color-team-b), color-mix(in srgb, var(--color-team-b) 80%, black))',
      }"
    >
      ⚡ {{ state.isMatchPoint ? "MATCH POINT" : "GAME POINT" }} · TEAM
      {{ state.servingSide }}
    </div>

    <!-- Bottom strip -->
    <div
      class="absolute bottom-0 inset-x-0 h-20 bg-neutral-950 border-t border-neutral-900 px-9 flex items-center justify-between"
    >
      <div class="flex gap-4 items-center">
        <span
          class="text-[11px] text-neutral-400 tracking-wider font-semibold uppercase"
          >HISTORY</span
        >
        <span
          class="font-mono text-base font-semibold tabular-nums tracking-wide"
        >
          <template v-for="(g, i) in previousGames" :key="i">
            G{{ i + 1 }} <span class="text-neutral-50">{{ g.a }}</span
            >–<span class="text-neutral-600">{{ g.b }}</span>
            <span v-if="i < previousGames.length - 1" class="mx-2">·</span>
          </template>
        </span>
      </div>
      <div v-if="meta?.sponsorName" class="flex items-center gap-2">
        <span
          class="text-[9px] text-neutral-600 tracking-[0.1em] font-semibold uppercase"
          >POWERED BY</span
        >
        <span class="text-lg font-bold tracking-[0.04em]">{{
          meta.sponsorName
        }}</span>
      </div>
    </div>
  </div>
</template>
