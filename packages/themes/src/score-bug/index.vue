<script setup lang="ts">
// Score Bug — the stacked two-row corner bug every live sports feed uses.
// Deliberately tiny: 236px at 1080p, which is roughly what ESPN, Sky and Star
// Sports actually occupy. A corner bug earns its place by staying out of the
// way, so the design rule here is subtractive — no event line, no venue, no
// status wording, no player names.
//
// What survives the cut is exactly what a viewer joining mid-rally needs:
// which two sides, how the games have gone, and the live points. Codes instead
// of names is what buys the small footprint (see team-code.vue) — truncating
// "Christinna Pedersen" to fit is what makes a small board look homemade.
//
// Top-left by default: score bugs live opposite the broadcaster's own logo
// corner, and it keeps the lower third free for the overlay themes.

import { computed, toRef } from 'vue';
import GameCells from '../game-cells.vue';
import type { ThemeProps } from '../index';
import PenaltyCards from '../penalty-cards.vue';
import ServeMarker from '../serve-marker.vue';
import {
  showStanding,
  teamCodeOf,
  teamColor,
  useStatusPill,
  useThemeState,
} from '../use-theme-state';

const props = defineProps<ThemeProps>();

const {
  playersA,
  playersB,
  cards,
  currentGame,
  gamesWon,
  isServingSide,
  isMatchWinner,
} = useThemeState(
  toRef(props, 'state'),
  toRef(props, 'teamNames'),
  toRef(props, 'players')
);
const status = useStatusPill(toRef(props, 'state'));
const withStanding = computed(() => showStanding(props.config));

const nameOf = (side: 'a' | 'b') =>
  (side === 'a' ? playersA.value : playersB.value)[0]?.name ||
  props.teamNames[side];
const codeOf = (side: 'a' | 'b') => props.meta?.codes?.[side] ?? null;

// The code is rendered bare rather than via <TeamCode> because a bug needs
// tighter metrics: no plate fill (the rail already colors the row) and a fixed
// 34px column so both codes align to the pixel.
const code = (side: 'a' | 'b') => teamCodeOf(nameOf(side), codeOf(side));

// Only completed games get cells here — the live number is right beside them,
// and at this size a duplicate is the difference between readable and cluttered.
// `include-current` on GameCells is the whole mechanism; there is deliberately no
// extra "do we have history yet" guard. One was tried and was wrong: it computed
// `games.length - (matchOver ? 0 : 1)`, which assumes the last entry is always
// in-progress. Between games it isn't — the engine leaves the finished game as
// the last entry until the next game's first point lands — so the completed
// game's cell vanished for the whole rest interval and then popped in. GameCells
// collapses to zero width on its own when there is nothing to show.
</script>

<template>
  <div
    class="absolute top-8 left-8 w-[236px] overflow-hidden rounded-[5px] bg-[#0a0d12]/95 font-sans text-white shadow-[0_10px_30px_-8px_rgba(0,0,0,0.8)] ring-1 ring-white/[0.08]"
  >
    <div
      v-for="side in ['a', 'b'] as const"
      :key="side"
      class="grid items-center gap-x-2 border-t border-white/[0.06] pr-2 first:border-t-0"
      :style="{
        gridTemplateColumns: `3px 34px minmax(0,1fr) ${withStanding ? 'auto ' : ''}26px`,
        background: isServingSide(side)
          ? `linear-gradient(90deg, color-mix(in srgb, ${teamColor(side)} 22%, transparent), transparent 70%)`
          : undefined,
      }"
    >
      <!-- Rail carries side identity, so nothing else has to -->
      <span
        class="h-full self-stretch"
        :style="{ background: teamColor(side) }"
      />

      <span
        class="py-[7px] text-[12px] font-bold tracking-[0.04em] uppercase"
        :class="isServingSide(side) ? 'text-white' : 'text-white/75'"
        >{{ code(side) }}</span
      >

      <!-- Serve dot + history cells share the flexible middle. The dot sits
           left of the cells so it never moves as games accumulate. -->
      <span class="flex min-w-0 items-center gap-1.5">
        <ServeMarker
          v-if="isServingSide(side)"
          :color="teamColor(side)"
          size="xs"
        />
        <span
          v-else
          class="inline-block size-[5px] shrink-0"
          aria-hidden="true"
        />
        <GameCells
          :state="state"
          :side="side"
          :color="teamColor(side)"
          size="xs"
          :include-current="false"
        />
        <PenaltyCards :cards="cards(side)" size="xs" class="shrink-0" />
      </span>

      <span
        v-if="withStanding"
        class="score text-[13px] leading-none tabular-nums"
        :class="gamesWon[side] > 0 ? 'text-white/90' : 'text-white/35'"
        >{{ gamesWon[side] }}</span
      >

      <!-- Live points, hard right, fixed 26px so 9 → 10 doesn't shift the row -->
      <span
        class="score text-right text-[19px] leading-none tabular-nums"
        :class="isMatchWinner(side) ? 'text-white' : 'text-white/95'"
        >{{ currentGame[side] }}</span
      >
    </div>

    <!-- One-line footer, and only when there is something to say. FINAL wins,
         then GP/MP/pause. At 236px wide there is no room for a second line. -->
    <div
      v-if="state.matchOver || status"
      class="px-2 py-[3px] text-center text-[8px] font-bold tracking-[0.2em] text-white uppercase"
      :style="{
        background: state.matchOver
          ? 'rgba(255,255,255,0.1)'
          : status?.tone === 'accent' && status.side
            ? teamColor(status.side)
            : status?.tone === 'warn'
              ? 'rgba(180,83,9,0.95)'
              : 'rgba(255,255,255,0.08)',
      }"
    >
      {{ state.matchOver ? 'FINAL' : status?.label }}
    </div>
  </div>
</template>
