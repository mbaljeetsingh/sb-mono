<script setup lang="ts">
// Arena Board — the fixed scoreboard bolted to the end wall of a sports hall,
// not a broadcast graphic. Row per team, columns for every quantity, framed
// digit windows. It is the layout an official scoring table uses, and it beats
// the split-halves boards (filmable, minimal-typographic) at one specific job:
// reading the *standing* of a long match from distance, because everything is
// in aligned columns instead of mirrored across a centre line.
//
// Distance legibility drives every decision:
//  - Digits sit in framed windows, so a number is findable before it's read.
//  - Columns are labelled once at the top, never per row.
//  - Only the live points column is oversized; the rest is deliberately smaller
//    so the hierarchy survives being squinted at from 30 metres.
//  - No blur, no gradient behind numerals, no animation except the serve lamp.
//    Camera-filmed boards (RECORDING-SETUPS tier 1a) lose thin, low-contrast
//    detail first, so contrast is spent on digits and nothing else.
//
// Fluid via clamp/vmin so the same board runs on a propped tablet and a wall TV.

import { computed, toRef } from 'vue';
import { CODE_W, PLATE_W, POINTS_TEXT_LG, POINTS_W_LG } from '../cell-metrics';
import GameCells from '../game-cells.vue';
import GamesWonPlate from '../games-won-plate.vue';
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
  currentGame,
  gamesWon,
  isServingSide,
  isLastGameWinner,
  isMatchWinner,
} = useThemeState(
  toRef(props, 'state'),
  toRef(props, 'teamNames'),
  toRef(props, 'players')
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
  return [m.sportLabel, m.category, m.round, m.courtLabel]
    .filter(Boolean)
    .join('  ·  ');
});

const formatLine = computed(() => {
  const c = props.config;
  const heading =
    c.gamesToWin === 1 ? 'SINGLE GAME' : `BEST OF ${c.gamesToWin * 2 - 1}`;
  return `${heading}  ·  FIRST TO ${c.pointsPerGame}`;
});

// Shared column template — both rows and the header read from one source, which
// is what keeps the digit windows in true vertical columns.
// Every track after the name column is a fixed width, and the code plate is too.
// That is what lets the label row — which is a separate grid, and so sizes its
// own `auto` tracks from its own content — land on the same column positions as
// the team rows. With `auto` there, the labels drifted ~22px right of the columns
// they named.
const columns = computed(() =>
  [
    'clamp(6px,1vmin,10px)', // team rail
    'auto', // code plate (fixed via CODE_W on the plate itself)
    'minmax(0,1fr)', // names — the only flexible track
    'auto', // per-game windows (fixed via CELL_W)
    withStanding.value ? 'auto' : null, // games won (fixed via PLATE_W)
    'auto', // live points (fixed via POINTS_W_LG)
  ]
    .filter(Boolean)
    .join(' ')
);

const gap = 'gap-x-[clamp(8px,1.8vmin,26px)]';
</script>

<template>
  <div
    class="absolute inset-0 flex flex-col overflow-hidden bg-[#07090c] font-sans text-white"
  >
    <!-- Header band. Dark plate, single rule under it: the visual language of a
         hall board's title strip. -->
    <div
      class="shrink-0 border-b border-white/[0.09] bg-white/[0.03] px-[clamp(12px,2.5vw,44px)] py-[clamp(6px,1.4vh,16px)]"
    >
      <div class="flex items-center justify-between gap-4">
        <span
          class="inline-flex min-w-0 items-center gap-[clamp(6px,1.2vmin,12px)] text-[clamp(10px,1.5vmin,15px)] font-bold tracking-[0.2em] text-white/60 uppercase"
        >
          <SportIcon
            :sport="config.sport"
            class="shrink-0 text-[clamp(15px,2.2vmin,22px)]"
          />
          <span class="truncate">{{ headMeta || formatLine }}</span>
        </span>
        <span
          v-if="state.matchOver"
          class="inline-flex shrink-0 items-center gap-[clamp(5px,1vmin,10px)] text-[clamp(11px,1.7vmin,18px)] font-bold tracking-[0.22em] text-white"
        >
          FINAL
          <span
            v-if="endReason"
            class="text-[clamp(9px,1.2vmin,12px)] font-semibold tracking-[0.14em] text-white/50 uppercase"
            >· {{ endReason }}</span
          >
        </span>
        <span
          v-else-if="isLive"
          class="inline-flex shrink-0 items-center gap-[clamp(5px,1vmin,10px)] text-[clamp(10px,1.5vmin,15px)] font-bold tracking-[0.2em] text-white/75"
        >
          <span
            class="size-[clamp(6px,1vmin,10px)] rounded-full animate-pulse-soft"
            style="background: var(--color-live, #ff5347)"
          />
          LIVE
        </span>
      </div>
    </div>

    <!-- Labels + rows share one vertically-centred block. Keeping the label strip
         outside it left the captions pinned near the title band with a large gap
         before the rows they described, which read as a stray line of text. -->
    <div class="flex min-h-0 flex-1 flex-col justify-center">
      <!-- Column labels. Written once, in the smallest type on the board — a hall
           board never repeats a label per row. -->
      <div
        class="grid shrink-0 items-end px-[clamp(12px,2.5vw,44px)] pb-[clamp(3px,0.8vh,8px)] text-[clamp(8px,1.1vmin,12px)] font-bold tracking-[0.18em] whitespace-nowrap text-white/35 uppercase"
        :class="gap"
        :style="{ gridTemplateColumns: columns }"
      >
        <span aria-hidden="true" />
        <!-- Reserves the code-plate track so "Player" starts where the names do. -->
        <span :class="CODE_W.lg" aria-hidden="true" />
        <span>Player</span>
        <!-- Label mode of the same component the rows use, so the captions cannot
             drift out of alignment with their columns. -->
        <GameCells
          v-if="config.gamesToWin > 1"
          :state="state"
          side="a"
          color="transparent"
          size="lg"
          mode="labels"
        />
        <span v-else aria-hidden="true" />
        <!-- Widths come from the same constants the row cells use. A header in a
             separate grid can only stay aligned if every track after the 1fr name
             column matches exactly — see cell-metrics.ts. -->
        <span
          v-if="withStanding"
          :class="[PLATE_W.lg, 'text-center']"
          style="white-space: nowrap"
          >Games</span
        >
        <span :class="[POINTS_W_LG, 'text-center']" style="white-space: nowrap"
          >Points</span
        >
      </div>
      <div
        v-for="side in ['a', 'b'] as const"
        :key="side"
        class="grid items-center border-t border-white/[0.07] px-[clamp(12px,2.5vw,44px)] py-[clamp(8px,2vh,26px)] last:border-b"
        :class="gap"
        :style="{
          gridTemplateColumns: columns,
          background: isServingSide(side)
            ? `linear-gradient(90deg, color-mix(in srgb, ${teamColor(side)} 16%, transparent), transparent 60%)`
            : undefined,
        }"
      >
        <!-- Rail: the full-height colour lane that makes a row scannable -->
        <span
          class="h-[clamp(34px,7vmin,80px)] self-center"
          :style="{ background: teamColor(side) }"
        />

        <span
          class="score inline-flex items-center justify-center rounded-[clamp(3px,0.6vmin,6px)] py-[clamp(2px,0.6vmin,7px)] text-[clamp(13px,2.4vmin,28px)] font-bold tracking-[0.05em] text-white uppercase"
          :class="CODE_W.lg"
          :style="{ background: teamColor(side) }"
          >{{ code(side) }}</span
        >

        <!-- Names + state. The flexible column, so long doubles pairs never
             push the digit windows out of alignment. -->
        <div class="flex min-w-0 flex-col gap-[clamp(2px,0.5vh,6px)]">
          <span
            class="truncate text-[clamp(14px,2.6vmin,34px)] leading-tight font-semibold tracking-tight uppercase"
          >
            <template v-for="(p, idx) in playersOf(side)" :key="idx">
              <span v-if="idx > 0" class="mx-[0.4em] font-normal text-white/30"
                >/</span
              >
              <span
                :class="
                  p.isServer
                    ? 'font-extrabold text-white'
                    : p.isPartner
                      ? 'font-medium text-white/45'
                      : 'font-semibold text-white/85'
                "
                >{{ p.name }}</span
              >
            </template>
          </span>
          <div
            class="flex items-center gap-[clamp(4px,1vmin,10px)] text-[clamp(8px,1.1vmin,12px)] font-bold tracking-[0.18em] uppercase"
          >
            <ServeMarker
              v-if="isServingSide(side)"
              :color="teamColor(side)"
              size="md"
            />
            <span
              v-if="isMatchWinner(side)"
              class="rounded-[2px] px-[clamp(4px,0.9vmin,10px)] py-[1px] text-white"
              :style="{ background: teamColor(side) }"
              >WINNER</span
            >
            <span
              v-else-if="isLastGameWinner(side)"
              class="rounded-[2px] border px-[clamp(4px,0.9vmin,10px)] py-[1px]"
              :style="{
                borderColor: teamColor(side),
                color: teamColor(side),
              }"
              >GAME WON</span
            >
            <PenaltyCards :cards="cards(side)" size="md" class="shrink-0" />
          </div>
        </div>

        <GameCells
          v-if="config.gamesToWin > 1"
          :state="state"
          :side="side"
          :color="teamColor(side)"
          size="lg"
        />
        <span v-else aria-hidden="true" />

        <GamesWonPlate
          v-if="withStanding"
          :value="gamesWon[side]"
          :color="teamColor(side)"
          size="lg"
        />

        <!-- Live points: the one oversized element on the board. Framed like
             the game windows so it reads as the same family, just louder. -->
        <span
          class="score inline-flex items-center justify-center rounded-[clamp(4px,0.9vmin,10px)] leading-none tabular-nums text-white"
          :class="[
            POINTS_W_LG,
            POINTS_TEXT_LG,
            isServingSide(side) ? '' : 'bg-white/[0.04]',
          ]"
          :style="{
            background: isServingSide(side)
              ? `color-mix(in srgb, ${teamColor(side)} 26%, transparent)`
              : undefined,
          }"
          >{{ currentGame[side] }}</span
        >
      </div>
    </div>

    <!-- Status band. Full-width and loud: on a venue board the audience is not
         watching a commentator tell them it's match point. -->
    <div
      v-if="status && !state.matchOver"
      class="flex shrink-0 items-center justify-center gap-[clamp(6px,1.5vmin,16px)] py-[clamp(4px,1vh,12px)] text-[clamp(11px,1.7vmin,18px)] font-bold tracking-[0.24em] text-white uppercase"
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

    <!-- Footer: format on the left, venue / sponsor on the right -->
    <div
      class="flex shrink-0 items-center justify-between gap-4 border-t border-white/[0.09] bg-white/[0.02] px-[clamp(12px,2.5vw,44px)] py-[clamp(5px,1.2vh,14px)] text-[clamp(8px,1.1vmin,12px)] font-bold tracking-[0.18em] text-white/40 uppercase"
    >
      <span class="truncate">{{ formatLine }}</span>
      <span v-if="meta?.sponsorName" class="shrink-0 truncate text-white/70">{{
        meta.sponsorName
      }}</span>
      <span v-else-if="meta?.venue" class="shrink-0 truncate">{{
        meta.venue
      }}</span>
    </div>
  </div>
</template>
