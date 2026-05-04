<script setup lang="ts">
import type { ThemeProps } from "../index";

const props = defineProps<ThemeProps>();

const score = (side: "a" | "b") => {
  const last = props.state.games[props.state.games.length - 1];
  return last ? last[side] : 0;
};

const meta = computed(() => {
  const m = props.meta ?? {};
  return [m.sportLabel ?? "BADMINTON", m.round, m.category, m.courtLabel]
    .filter(Boolean)
    .join(" · ");
});
</script>

<template>
  <div
    class="absolute left-9 bottom-9 min-w-[460px] rounded-lg overflow-hidden border border-neutral-800 shadow-[0_24px_48px_-16px_rgba(0,0,0,0.55)] bg-[linear-gradient(135deg,#0a0a0a_0%,#171717_100%)]"
  >
    <!-- Top stripe — meta -->
    <div
      class="px-4 py-2 bg-neutral-900 border-b border-neutral-800 flex items-center justify-between"
    >
      <span
        class="text-[10px] font-bold tracking-[0.1em] text-neutral-400 uppercase"
        >{{ meta }}</span
      >
      <span
        v-if="state.matchOver"
        class="text-[10px] font-bold tracking-[0.1em] text-amber-400"
        >FINAL</span
      >
      <span
        v-else
        class="inline-flex items-center gap-1 text-[10px] font-bold tracking-[0.1em] text-red-500"
      >
        <span class="size-1.5 rounded-full bg-red-500 animate-pulse-soft" />
        LIVE
      </span>
    </div>

    <!-- Body — two team rows -->
    <div class="p-4 flex flex-col gap-2.5">
      <div
        v-for="side in ['a', 'b'] as const"
        :key="side"
        class="grid grid-cols-[auto_1fr_auto_auto] gap-3.5 items-center px-2 py-1.5 rounded transition-all duration-200"
        :class="[
          (state.isGamePoint || state.isMatchPoint) &&
          state.servingSide.toLowerCase() === side
            ? side === 'a'
              ? 'bg-red-500/15'
              : 'bg-blue-500/15'
            : '',
        ]"
      >
        <div
          class="w-1 h-8 rounded-sm"
          :style="{
            background:
              side === 'a' ? 'var(--color-team-a)' : 'var(--color-team-b)',
          }"
        />
        <div>
          <div class="text-sm font-semibold text-neutral-50 tracking-tight">
            {{ teamNames[side] }}
            <span
              v-if="state.matchOver && state.winner?.toLowerCase() === side"
              class="ml-1.5 text-[10px] font-bold tracking-[0.1em] text-amber-400"
            >
              WINNER
            </span>
          </div>
          <div class="inline-flex gap-1 mt-0.5">
            <span
              v-for="i in config.gamesToWin + 1"
              :key="i"
              class="size-1.5 rounded-full"
              :style="{
                background:
                  i <= state.gamesWon[side]
                    ? side === 'a'
                      ? 'var(--color-team-a)'
                      : 'var(--color-team-b)'
                    : '#262626',
              }"
            />
          </div>
        </div>
        <div class="w-7 flex justify-center">
          <span
            v-if="state.servingSide.toLowerCase() === side && !state.matchOver"
            class="size-[22px] rounded-full inline-flex items-center justify-center text-white text-[9px] font-bold"
            :style="{
              background:
                side === 'a' ? 'var(--color-team-a)' : 'var(--color-team-b)',
            }"
            >S</span
          >
        </div>
        <div
          class="score min-w-[56px] text-right text-neutral-50"
          style="font-size: 38px"
        >
          {{ score(side) }}
        </div>
      </div>
    </div>

    <!-- Bottom flag — game point / match point -->
    <div
      v-if="state.isGamePoint || state.isMatchPoint"
      class="px-4 py-1.5 text-white text-[11px] font-bold tracking-[0.12em] flex justify-between items-center"
      :style="{
        background:
          state.servingSide === 'A'
            ? 'linear-gradient(90deg, var(--color-team-a), color-mix(in srgb, var(--color-team-a) 80%, black))'
            : 'linear-gradient(90deg, var(--color-team-b), color-mix(in srgb, var(--color-team-b) 80%, black))',
      }"
    >
      <span class="inline-flex items-center gap-1.5">
        ⚡ {{ state.isMatchPoint ? "MATCH POINT" : "GAME POINT" }} · TEAM
        {{ state.servingSide }}
      </span>
    </div>
  </div>
</template>
