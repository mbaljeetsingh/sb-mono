<script setup lang="ts">
// Renders a theme component at full broadcast size (1920×1080) inside a
// fixed-aspect container, scaled down via CSS transform so it fits the card.
// Uses VueUse useElementSize so the scale follows the container's actual width
// — looks crisp from a 320px thumbnail to a 600px hero card.

import { type RacquetConfig, type RacquetState, badminton21 } from '@sb/engine';
import { useElementSize } from '@vueuse/core';
import { computed, useTemplateRef } from 'vue';

const props = defineProps<{
  /** Theme component (already imported from @sb/themes registry). */
  component: unknown;
  /** Surface — overlay themes need a transparent backdrop, scoreboard themes need black. */
  surface: 'overlay' | 'scoreboard';
  /** Optional override; defaults to a realistic mid-match badminton state. */
  state?: RacquetState;
  /** Optional override; defaults to badminton21. */
  config?: RacquetConfig;
}>();

const wrapper = useTemplateRef<HTMLDivElement>('wrapper');
const { width } = useElementSize(wrapper);

// Source size that the themes were authored against (per docs/PRD §3.10 +
// theme manifests). Themes use absolute positioning at this size, so we
// render the canvas verbatim and scale to whatever the card is.
const SOURCE_W = 1920;
const SOURCE_H = 1080;
const scale = computed(() => (width.value > 0 ? width.value / SOURCE_W : 0.2));

// Default sample state — partway through a competitive match. Keeps things
// honest: scores, games-won pips, server indicator, partner positions all
// reflect what an operator actually sees on day-of.
const defaultState: RacquetState = {
  games: [
    { a: 21, b: 18 },
    { a: 14, b: 11 },
  ],
  gamesWon: { a: 1, b: 0 },
  servingSide: 'A',
  matchInitialServer: 'A',
  serverCourt: 'right',
  betweenGames: false,
  matchOver: false,
  winner: null,
  atInterval: true,
  isGamePoint: false,
  isMatchPoint: false,
  gamePoint: { a: false, b: false },
  matchPoint: { a: false, b: false },
  // 14–11 isn't level, so the sample is not at deuce. The preview deliberately
  // shows the INTERVAL pill (atInterval above) as its status-pill example.
  isDeuce: false,
  names: { a: 'Team A', b: 'Team B' },
  sidesSwapped: false,
  endReason: null,
  timeout: null,
  suspended: false,
  partnerOnRight: { a: 1, b: 1 },
  cards: {
    a: { yellow: 0, red: 0, black: 0 },
    b: { yellow: 0, red: 0, black: 0 },
  },
};

const previewState = computed(() => props.state ?? defaultState);
const previewConfig = computed(() => props.config ?? badminton21);
const teamNames = { a: 'Team A', b: 'Team B' };
const meta = {
  courtLabel: 'COURT 3',
  round: 'QF',
  category: 'MD U-19',
  venue: null,
  sponsorName: null,
};
</script>

<template>
  <div
    ref="wrapper"
    class="relative aspect-video w-full overflow-hidden rounded-md"
    :class="
      surface === 'overlay'
        ? 'bg-[linear-gradient(135deg,#1f2937_0%,#0f172a_100%)]'
        : 'bg-black'
    "
  >
    <div
      class="absolute top-0 left-0 origin-top-left"
      :style="{
        width: `${SOURCE_W}px`,
        height: `${SOURCE_H}px`,
        transform: `scale(${scale})`,
      }"
    >
      <component
        :is="component"
        :state="previewState"
        :config="previewConfig"
        :team-names="teamNames"
        :meta="meta"
      />
    </div>
  </div>
</template>
