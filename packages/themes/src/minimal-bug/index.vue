<script setup lang="ts">
import type { ThemeProps } from "../index";

const props = defineProps<ThemeProps>();

const score = (side: "a" | "b") => {
  const last = props.state.games[props.state.games.length - 1];
  return last ? last[side] : 0;
};
</script>

<template>
  <div
    class="absolute top-9 right-9 rounded-md px-3.5 py-2.5 flex items-center gap-3.5 border border-white/10 backdrop-blur-md bg-neutral-950/90"
  >
    <div class="flex items-center gap-1.5">
      <span
        class="size-2 rounded-sm"
        :style="{ background: 'var(--color-team-a)' }"
      />
      <span class="text-xs font-semibold text-neutral-50">
        {{ teamNames.a.split(" ")[0]?.toUpperCase() }}
      </span>
      <span class="score text-lg text-neutral-50 min-w-[24px] text-right">{{
        score("a")
      }}</span>
    </div>
    <span class="w-px h-4 bg-neutral-700" />
    <div class="flex items-center gap-1.5">
      <span class="score text-lg text-neutral-50 min-w-[24px] text-left">{{
        score("b")
      }}</span>
      <span class="text-xs font-semibold text-neutral-50">
        {{ teamNames.b.split(" ")[0]?.toUpperCase() }}
      </span>
      <span
        class="size-2 rounded-sm"
        :style="{ background: 'var(--color-team-b)' }"
      />
    </div>
    <span
      v-if="state.matchOver"
      class="ml-1 text-[9px] tracking-[0.1em] font-bold text-amber-400"
      >FINAL</span
    >
    <span
      v-else
      class="ml-1 text-[9px] font-mono font-bold tracking-[0.06em] text-amber-400"
      >G{{ state.games.length }}</span
    >
  </div>
</template>
