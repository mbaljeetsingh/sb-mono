<script setup lang="ts">
// Vertical Board — a full-bleed panel board for a phone or tablet propped up
// beside the court, which is how most club matches actually get a scoreboard
// (ROADMAP E1.38 kiosk mode). Portrait is the primary orientation, so the two
// sides stack as full-width panels; in landscape they become halves and the
// same board runs on a TV.
//
// The distinguishing move is that each side owns a *panel*, not a text block:
// its colour fills the whole area behind its score. Existing split-halves
// themes share one black field and mark sides with small colour accents, which
// works on a broadcast feed but loses at 20 metres in a bright hall. Filling
// the area means the side identity survives even when the digits are the only
// thing still legible.
//
// Serving side lifts its panel's fill; the other recedes. That single change —
// rather than a chip or a dot — is what a spectator reads from across the hall.

import { computed, toRef } from 'vue';
import GameCells from '../game-cells.vue';
import type { ThemeProps } from '../index';
import PenaltyCards from '../penalty-cards.vue';
import ServeMarker from '../serve-marker.vue';
import SportIcon from '../sport-icon.vue';
import {
  endReasonLabel,
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
  primaryScore,
  unitWord,
  unitInitial,
  wonLabel,
  showsPointTier,
  gamesWon,
  isServingSide,
  isLastGameWinner,
  isMatchWinner,
} = useThemeState(
  toRef(props, 'state'),
  toRef(props, 'teamNames'),
  toRef(props, 'players'),
  toRef(props, 'config')
);
const status = useStatusPill(toRef(props, 'state'));
const endReason = computed(() => endReasonLabel(props.state.endReason));
const isLive = computed(() => props.meta?.isLive !== false);
const withStanding = computed(() => showStanding(props.config));

const playersOf = (side: 'a' | 'b') =>
  side === 'a' ? playersA.value : playersB.value;
const nameOf = (side: 'a' | 'b') =>
  playersOf(side)[0]?.name || props.teamNames[side];
const code = (side: 'a' | 'b') =>
  teamCodeOf(nameOf(side), props.meta?.codes?.[side] ?? null);

const headMeta = computed(() => {
  const m = props.meta ?? {};
  const bo =
    props.config.gamesToWin === 1
      ? `SINGLE ${unitWord.value}`
      : `BO${props.config.gamesToWin * 2 - 1}`;
  return [m.sportLabel, bo, m.category, m.round, m.courtLabel]
    .filter(Boolean)
    .join('  ·  ');
});

// No 'SERVING' string here. The brightened panel fill is this theme's serve
// signal (see the header note), and the marker beside the name is the shared
// convention every other theme uses — a word on top of both is the third
// redundant encoding of one fact.
const sideCaption = (side: 'a' | 'b') => {
  if (isMatchWinner(side)) return 'WINNER';
  if (isLastGameWinner(side)) return wonLabel.value;
  return null;
};

// Panel fill: the serving side reads brighter. Kept as a colour-mix on the team
// colour rather than two hardcoded values so it tracks a palette change.
const panelStyle = (side: 'a' | 'b') => ({
  background: isServingSide(side)
    ? `linear-gradient(180deg, color-mix(in srgb, ${teamColor(side)} 34%, #07090c), color-mix(in srgb, ${teamColor(side)} 14%, #07090c))`
    : `linear-gradient(180deg, color-mix(in srgb, ${teamColor(side)} 10%, #07090c), #07090c)`,
});
</script>

<template>
  <div
    class="absolute inset-0 flex flex-col overflow-hidden bg-[#07090c] font-sans text-white"
  >
    <!-- Slim header. On a propped tablet this is the strip nobody looks at, so
         it gets the least ink and the least height. -->
    <div
      class="flex shrink-0 items-center justify-between gap-3 border-b border-white/10 px-[clamp(10px,3vw,32px)] py-[clamp(5px,1.2vh,14px)] text-[clamp(9px,1.3vmin,13px)] font-bold tracking-[0.18em] text-white/55 uppercase"
    >
      <span class="inline-flex min-w-0 items-center gap-2">
        <SportIcon
          :sport="config.sport"
          class="shrink-0 text-[clamp(13px,2vmin,19px)]"
        />
        <span class="truncate">{{ headMeta }}</span>
      </span>
      <span
        v-if="state.matchOver"
        class="inline-flex shrink-0 items-center gap-2 text-white"
      >
        FINAL
        <span
          v-if="endReason"
          class="text-[clamp(8px,1.1vmin,11px)] font-semibold text-white/50"
          >· {{ endReason }}</span
        >
      </span>
      <span
        v-else-if="isLive"
        class="inline-flex shrink-0 items-center gap-1.5 text-white/75"
      >
        <span
          class="size-[clamp(5px,0.9vmin,9px)] rounded-full animate-pulse-soft"
          style="background: var(--color-live, #ff5347)"
        />
        LIVE
        <span v-if="config.gamesToWin > 1" class="text-white/45"
          >· {{ unitInitial }}{{ state.games.length }}</span
        >
      </span>
    </div>

    <!-- Panels: stacked in portrait, halved in landscape -->
    <div class="grid min-h-0 flex-1 portrait:grid-rows-2 landscape:grid-cols-2">
      <div
        v-for="side in ['a', 'b'] as const"
        :key="side"
        class="relative flex min-h-0 min-w-0 flex-col justify-between px-[clamp(12px,3vw,40px)] py-[clamp(8px,2vh,28px)] transition-all duration-200 portrait:border-b portrait:border-white/10 portrait:last:border-b-0 landscape:border-r landscape:border-white/10 landscape:last:border-r-0"
        :style="panelStyle(side)"
      >
        <!-- Identity row: code plate + name. Fixed at the panel top so the
             numeral below always occupies the same place on both panels. -->
        <div class="flex min-w-0 items-center gap-[clamp(6px,1.4vmin,16px)]">
          <span
            class="score inline-flex shrink-0 items-center justify-center rounded-[clamp(3px,0.6vmin,6px)] px-[clamp(6px,1.3vmin,15px)] py-[clamp(2px,0.6vmin,7px)] text-[clamp(14px,2.4vmin,30px)] font-bold tracking-[0.05em] text-white uppercase"
            :style="{ background: teamColor(side) }"
            >{{ code(side) }}</span
          >
          <div class="min-w-0 flex-1">
            <div
              class="truncate text-[clamp(14px,2.4vmin,32px)] leading-tight font-semibold tracking-tight uppercase"
            >
              <template v-for="(p, idx) in playersOf(side)" :key="idx">
                <span
                  v-if="idx > 0"
                  class="mx-[0.4em] font-normal text-white/30"
                  >/</span
                >
                <span
                  :class="
                    p.isServer
                      ? 'font-extrabold text-white'
                      : p.isPartner
                        ? 'font-medium text-white/50'
                        : 'font-semibold text-white/90'
                  "
                  >{{ p.name }}</span
                >
              </template>
            </div>
            <div
              v-if="
                isServingSide(side) ||
                sideCaption(side) ||
                cards(side).yellow ||
                cards(side).red ||
                cards(side).black
              "
              class="mt-[clamp(1px,0.4vh,4px)] flex items-center gap-[clamp(4px,1vmin,10px)] text-[clamp(8px,1.1vmin,12px)] font-bold tracking-[0.2em] text-white/75 uppercase"
            >
              <ServeMarker
                v-if="isServingSide(side)"
                :color="teamColor(side)"
                size="md"
              />
              <span v-if="sideCaption(side)">{{ sideCaption(side) }}</span>
              <PenaltyCards :cards="cards(side)" size="md" class="shrink-0" />
            </div>
          </div>
        </div>

        <!-- The number. Sized off the smaller axis so it fills a portrait panel
             and a landscape half equally hard. -->
        <div
          class="score flex min-h-0 flex-1 items-center justify-center leading-[0.82] tabular-nums portrait:text-[clamp(110px,min(26vh,54vw),340px)] landscape:text-[clamp(96px,min(46vh,26vw),300px)]"
        >
          {{ primaryScore(side) }}
        </div>

        <!-- Per-game history pinned to the panel foot, with the standing number
             only when BO5+ makes it worth the space. -->
        <div class="flex items-center justify-between gap-3">
          <GameCells
            v-if="config.gamesToWin > 1"
            :state="state"
            :side="side"
            :color="teamColor(side)"
            size="lg"
            :include-current="showsPointTier"
          />
          <span v-else aria-hidden="true" />
          <span
            v-if="withStanding"
            class="inline-flex shrink-0 items-baseline gap-[clamp(3px,0.8vmin,8px)]"
          >
            <span
              class="text-[clamp(8px,1.1vmin,12px)] font-bold tracking-[0.18em] text-white/45 uppercase"
              >Games</span
            >
            <span
              class="score text-[clamp(20px,3.4vmin,42px)] leading-none tabular-nums text-white"
              >{{ gamesWon[side] }}</span
            >
          </span>
        </div>
      </div>
    </div>

    <!-- Status band across the full width, below both panels -->
    <div
      v-if="status && !state.matchOver"
      class="flex shrink-0 items-center justify-center gap-[clamp(6px,1.5vmin,16px)] py-[clamp(4px,1vh,12px)] text-[clamp(10px,1.6vmin,17px)] font-bold tracking-[0.24em] text-white uppercase"
      :style="{
        background:
          status.tone === 'accent' && status.side
            ? teamColor(status.side)
            : status.tone === 'warn'
              ? '#b45309'
              : 'rgba(255,255,255,0.07)',
      }"
    >
      {{ status.label }}
      <span v-if="status.side" class="font-semibold text-white/80"
        >· {{ status.side === 'A' ? teamNames.a : teamNames.b }}</span
      >
    </div>

    <div
      v-else-if="meta?.sponsorName || meta?.venue"
      class="flex shrink-0 items-center justify-center border-t border-white/10 py-[clamp(4px,1vh,12px)] text-[clamp(8px,1.1vmin,12px)] font-bold tracking-[0.2em] text-white/45 uppercase"
    >
      {{ meta.sponsorName || meta.venue }}
    </div>
  </div>
</template>
