<script setup lang="ts">
// Short code plate — the "INA" / "DEN" of a BWF graphic, the "MUN" / "LIV" of
// a football bug. Corner bugs and ribbon centres have no room for full names,
// and broadcast graphics solve that with a code rather than by truncating a
// name mid-word ("Christ…"), which is what makes a small board look homemade.
//
// The code is derived from the name (see `teamCodeOf`) and overridable per side
// via `meta.codes`, so an operator can correct a bad guess.

import { computed } from 'vue';
import { CELL_RADIUS, CODE_W, type CellSize, PLATE_H } from './cell-metrics';
import { teamCodeOf } from './use-theme-state';

const props = withDefaults(
  defineProps<{
    /** Display name for the side — team name or lead player. */
    name: string;
    /** Operator override from `meta.codes`, when set. */
    code?: string | null;
    /** Team color, used as the plate fill. */
    color: string;
    size?: CellSize;
  }>(),
  { size: 'sm' }
);

const label = computed(() => teamCodeOf(props.name, props.code));

// Width comes from the shared CODE_W, not from padding around the text. Letting
// the text size the plate meant "AXE" and "VIT" came out a few px apart in Inter
// bold — and since each team row is its own grid, that difference landed in the
// row's `auto` code track and started the two names at different x. Same failure
// the score columns had; same fix.
const TEXT: Record<CellSize, string> = {
  xs: 'text-[11px] tracking-[0.06em]',
  sm: 'text-[14px] tracking-[0.06em]',
  md: 'text-[20px] tracking-[0.05em]',
  lg: 'text-[clamp(16px,3vmin,34px)] tracking-[0.05em]',
};

const box = computed(
  () =>
    `${CODE_W[props.size]} ${PLATE_H[props.size]} ${TEXT[props.size]} ${CELL_RADIUS[props.size]}`
);
</script>

<template>
  <span
    class="inline-flex shrink-0 items-center justify-center font-bold text-white uppercase leading-none"
    :class="box"
    :style="{ background: color }"
  >
    {{ label }}
  </span>
</template>
