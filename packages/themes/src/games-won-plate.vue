<script setup lang="ts">
// Games-won standing number (ROADMAP E1.27). Tennis coverage puts the sets
// count immediately left of the live game score, and badminton BO5 graphics do
// the same, because past three games nobody counts cells fast enough.
//
// Gate on `showStanding(config)` before rendering — in BO1/BO3 this column is
// pure noise and the per-game cells already say it.

import { computed } from 'vue';
import {
  CELL_RADIUS,
  CELL_TEXT,
  type CellSize,
  PLATE_H,
  PLATE_W,
} from './cell-metrics';

const props = withDefaults(
  defineProps<{
    value: number;
    /** Team color — used as the fill once the side has won a game. */
    color: string;
    size?: CellSize;
    tone?: 'dark' | 'light';
  }>(),
  { size: 'sm', tone: 'dark' }
);

const box = computed(
  () =>
    `${PLATE_W[props.size]} ${PLATE_H[props.size]} ${CELL_TEXT[props.size]} ${CELL_RADIUS[props.size]}`
);

// A zero stays neutral. Filling it with team color the moment the board renders
// would read as "this side is up" before a single game is decided.
const isLive = computed(() => props.value > 0);
</script>

<template>
  <span
    class="score inline-flex items-center justify-center font-bold leading-none tabular-nums"
    :class="[
      box,
      isLive
        ? 'text-white'
        : tone === 'light'
          ? 'bg-neutral-200/80 text-neutral-500'
          : 'bg-white/[0.05] text-white/40',
    ]"
    :style="isLive ? { background: color } : undefined"
  >
    {{ value }}
  </span>
</template>
