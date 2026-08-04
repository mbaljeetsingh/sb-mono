<script setup lang="ts">
// Per-game score cells — the single strongest "this is a real scoreboard"
// signal, and the reason broadcast graphics never just list bare numbers.
//
// Each game gets its own fixed-width window. Completed games show the winner
// emphasized and the loser dimmed, so a viewer reads the match standing without
// counting. The in-progress game gets the team-color fill, which is what moves
// as points are scored — everything left of it is settled history and stays put.
//
// Fixed width matters: cells are sized for two digits from the start, so a
// score crossing 9 → 10 (or a badminton cap run to 30) never reflows the row
// and nudges the name column. Metrics live in cell-metrics.ts — see the note
// there for why they're shared rather than local.

import type { RacquetState } from '@sb/engine';
import { computed } from 'vue';
import {
  CELL_GAP,
  CELL_RADIUS,
  CELL_TEXT,
  CELL_W,
  type CellSize,
  LABEL_OVERRIDE,
} from './cell-metrics';
import { type SideKey, gameCellsOf } from './use-theme-state';

const props = withDefaults(
  defineProps<{
    state: RacquetState;
    side: SideKey;
    /** Team color for the current-game fill — normally `teamColor(side)`. */
    color: string;
    size?: CellSize;
    /**
     * Include the in-progress game. Themes that already render the live score
     * in big numerals pass false, so the cell row is completed games only and
     * the live number isn't duplicated two inches away.
     */
    includeCurrent?: boolean;
    /** Board background this row sits on, so the dim/emphasis tiers invert. */
    tone?: 'dark' | 'light';
    /**
     * `labels` renders G1 / G2 / G3 captions in place of the scores, using the
     * identical boxes and gaps. Themes that draw a column header use this rather
     * than hand-rolling a label row: a duplicated set of widths drifts out of
     * alignment the moment either side changes (the header sat ~25px right of
     * its own cells before this existed), and the drift is invisible in code
     * review because both numbers look right in isolation.
     */
    mode?: 'scores' | 'labels';
  }>(),
  { size: 'sm', includeCurrent: true, tone: 'dark', mode: 'scores' }
);

const cells = computed(() => {
  const all = gameCellsOf(props.state);
  return props.includeCurrent ? all : all.filter((c) => !c.isCurrent);
});

const box = computed(
  () =>
    `${CELL_W[props.size]} ${CELL_TEXT[props.size]} ${CELL_RADIUS[props.size]}`
);

// Three tiers, not two: won / lost / in-play. Dropping to two (highlight vs
// not) is what makes an amateur board unreadable — you can see which game is
// live but not who took the ones before it.
const cellClass = (won: boolean) => {
  if (props.tone === 'light') {
    return won
      ? 'bg-neutral-900 text-white'
      : 'bg-neutral-200/80 text-neutral-500';
  }
  return won ? 'bg-white/15 text-white' : 'bg-white/[0.05] text-white/45';
};
</script>

<template>
  <!-- Always renders, even with zero cells (game 1, `include-current` off).
       Most callers place this as a grid child, and a v-if here would drop the
       child entirely and shift every column after it left by one — the score
       column would sit under the standing column until game 2 started. An empty
       inline-flex collapses to zero width, which is the intended effect. -->
  <div class="inline-flex items-center" :class="CELL_GAP">
    <!-- Label mode keeps the box geometry and drops the fill, so a caption lands
         dead-centre over the cell it names. -->
    <template v-for="c in cells" :key="c.n">
      <span
        v-if="mode === 'labels'"
        class="inline-flex items-center justify-center leading-none font-bold uppercase tracking-[0.1em]"
        :class="[
          box,
          LABEL_OVERRIDE[size],
          tone === 'light' ? 'text-neutral-500' : 'text-white/35',
        ]"
      >
        G{{ c.n }}
      </span>
      <span
        v-else
        class="score inline-flex items-center justify-center leading-none tabular-nums font-bold"
        :class="[
          box,
          c.isCurrent ? 'text-white' : cellClass(c.winner === side),
        ]"
        :style="c.isCurrent ? { background: color } : undefined"
      >
        {{ c[side] }}
      </span>
    </template>
  </div>
</template>
