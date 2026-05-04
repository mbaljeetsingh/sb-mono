<script setup lang="ts">
import type { ThemeProps } from "../index";

const props = defineProps<ThemeProps>();

const score = (side: "a" | "b") => {
  const last = props.state.games[props.state.games.length - 1];
  return last ? last[side] : 0;
};

const topMeta = computed(() => {
  const m = props.meta ?? {};
  return [m.sportLabel ?? "BADMINTON", m.round, m.category, m.courtLabel]
    .filter(Boolean)
    .join(" · ");
});

const bottomLabel = computed(() => {
  if (props.state.matchOver) {
    const games = props.state.games.map((g) => `${g.a}–${g.b}`).join(", ");
    return `FINAL · ${games}`;
  }
  return `GAME ${props.state.games.length} · LIVE`;
});
</script>

<template>
  <div class="absolute inset-0 bg-stone-50 text-neutral-950 overflow-hidden">
    <div class="absolute inset-0 px-15 py-10 flex flex-col">
      <!-- Top label -->
      <div
        class="text-[11px] font-bold tracking-[0.16em] text-neutral-600 uppercase mb-auto"
      >
        {{ topMeta }}
      </div>

      <!-- Center grid -->
      <div class="grid grid-cols-[1fr_auto_1fr] gap-15 items-center">
        <!-- Left -->
        <div>
          <div
            class="text-sm font-semibold text-neutral-600 tracking-wide mb-1 uppercase"
          >
            {{ teamNames.a }}
          </div>
          <div class="score text-[220px] leading-[0.85]">{{ score("a") }}</div>
          <div class="flex gap-1.5 mt-2">
            <span
              v-for="i in config.gamesToWin + 1"
              :key="`a-${i}`"
              class="size-3 rounded-full"
              :class="
                i <= state.gamesWon.a ? 'bg-neutral-950' : 'bg-neutral-300'
              "
            />
          </div>
        </div>

        <div class="text-3xl text-neutral-400 font-normal">—</div>

        <!-- Right -->
        <div class="text-right">
          <div
            class="text-sm font-semibold text-neutral-600 tracking-wide mb-1 uppercase"
          >
            {{ teamNames.b }}
          </div>
          <div class="score text-[220px] leading-[0.85]">{{ score("b") }}</div>
          <div class="flex gap-1.5 mt-2 justify-end">
            <span
              v-for="i in config.gamesToWin + 1"
              :key="`b-${i}`"
              class="size-3 rounded-full"
              :class="
                i <= state.gamesWon.b ? 'bg-neutral-950' : 'bg-neutral-300'
              "
            />
          </div>
        </div>
      </div>

      <!-- Bottom row -->
      <div
        class="mt-auto flex justify-between items-end text-xs text-neutral-500 tracking-[0.1em] font-semibold uppercase"
      >
        <span>{{ bottomLabel }}</span>
        <span>SCOREBOARD.APP</span>
      </div>
    </div>
  </div>
</template>
