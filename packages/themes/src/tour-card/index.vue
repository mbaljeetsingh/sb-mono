<script setup lang="ts">
// Tour Card — lower-third built to world-tour broadcast convention. This is the
// layout a badminton or tennis feed actually uses, and it differs from a
// generic "score panel" in four specific ways:
//
//  1. Hard edges, flat fill, no blur. Broadcast graphics are keyed over live
//     video and composited at 1080p; a translucent blur costs legibility and
//     encodes whatever happens to be behind it. Solid ink survives any footage.
//  2. Every column is fixed-width. Name column truncates, score columns never
//     move. A board whose numbers shift as the score crosses 10 reads as
//     amateur immediately, and it's the most common mistake.
//  3. Three tiers of score emphasis — completed games dimmed, current game in
//     team color, standing (BO5+) separate. See game-cells.vue.
//  4. The server is a dot, not the word SERVE.
//
// Layout: [color rail][code][name + cards][game cells][standing][live score]
// The rail and the code plate are what give each side a fixed identity, so the
// eye tracks rows rather than re-reading names.

import { computed, toRef } from 'vue';
import GameCells from '../game-cells.vue';
import GamesWonPlate from '../games-won-plate.vue';
import type { ThemeProps } from '../index';
import PenaltyCards from '../penalty-cards.vue';
import ServeMarker from '../serve-marker.vue';
import SportIcon from '../sport-icon.vue';
import TeamCode from '../team-code.vue';
import {
  endReasonLabel,
  showStanding,
  teamColor,
  useMetaLine,
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
const meta = useMetaLine(toRef(props, 'meta'), toRef(props, 'config'));
const status = useStatusPill(toRef(props, 'state'));
const endReason = computed(() => endReasonLabel(props.state.endReason));
const isLive = computed(() => props.meta?.isLive !== false);
const withStanding = computed(() => showStanding(props.config));

// In a single-game match the cell row degenerates to one cell holding the live
// score — the same number already set in big numerals two columns right. There
// is no history to tabulate, so the column is dropped from the template AND the
// row together (both read this flag, so the track count and the child count can
// never disagree).
const withCells = computed(() => props.config.gamesToWin > 1);

const playersOf = (side: 'a' | 'b') =>
  side === 'a' ? playersA.value : playersB.value;
const nameOf = (side: 'a' | 'b') =>
  playersOf(side)[0]?.name || props.teamNames[side];
const codeOf = (side: 'a' | 'b') => props.meta?.codes?.[side] ?? null;

// Column template is computed once per format rather than per side, so both
// rows are guaranteed to share it — the thing that keeps the cells in a true
// vertical column instead of two independently-sized rows.
const columns = computed(() =>
  [
    '6px', // team rail
    'auto', // code plate
    'minmax(0,1fr)', // name — the only column allowed to shrink
    withCells.value ? 'auto' : null, // game cells (BO3+)
    withStanding.value ? 'auto' : null, // standing (BO5+)
    '92px', // live score
  ]
    .filter(Boolean)
    .join(' ')
);
</script>

<template>
  <div
    class="absolute bottom-12 left-12 w-[780px] overflow-hidden rounded-[8px] border border-white/[0.07] bg-[#0b0e14] font-sans text-white shadow-[0_28px_70px_-24px_rgba(0,0,0,0.85)]"
  >
    <!-- Event strip. Broadcast puts the competition line above the scores and
         keeps it quiet — it's context, read once, not something to track. -->
    <div
      class="flex items-center justify-between gap-3 border-b border-white/[0.07] bg-white/[0.03] px-5 py-2.5"
    >
      <span
        class="inline-flex min-w-0 flex-1 items-center gap-2 text-[13px] font-bold tracking-[0.16em] text-white/55 uppercase"
      >
        <SportIcon :sport="config.sport" class="shrink-0 text-[16px]" />
        <span class="truncate">{{ meta || '&nbsp;' }}</span>
      </span>
      <span
        v-if="state.matchOver"
        class="ml-2 inline-flex shrink-0 items-center gap-2 text-[13px] font-bold tracking-[0.18em] text-white"
      >
        {{ config.gamesToWin > 1 ? 'FINAL' : unitWord }}
        <span
          v-if="endReason"
          class="text-[11px] font-semibold tracking-[0.12em] text-white/55 uppercase"
        >
          · {{ endReason }}
        </span>
      </span>
      <span
        v-else-if="isLive"
        class="ml-2 inline-flex shrink-0 items-center gap-1.5 text-[13px] font-bold tracking-[0.16em] text-white/80"
      >
        <span
          class="size-2 rounded-full animate-pulse-soft"
          style="background: var(--color-live, #ff5347)"
        />
        LIVE
        <span v-if="config.gamesToWin > 1" class="font-semibold text-white/45"
          >· {{ unitInitial }}{{ state.games.length }}</span
        >
      </span>
    </div>

    <!-- No G1/G2/G3 column header here, deliberately. A tour lower third labels
         nothing: the cells are self-evident in context, the strip costs vertical
         space this format doesn't have, and a header in its own grid cannot share
         `auto` track sizes with the rows below it (see cell-metrics.ts). The
         labelled-column treatment belongs on arena-board, where the board *is* a
         table and has the room to do it properly. -->

    <!-- Team rows -->
    <div>
      <div
        v-for="side in ['a', 'b'] as const"
        :key="side"
        class="grid items-center gap-x-4 border-t border-white/[0.05] pr-5 first:border-t-0"
        :style="{
          gridTemplateColumns: columns,
          // A flat left-anchored wash, not a full-row tint: it marks the
          // serving row without lifting that row's contrast above the other.
          background: isServingSide(side)
            ? `linear-gradient(90deg, color-mix(in srgb, ${teamColor(side)} 20%, transparent), transparent 55%)`
            : undefined,
        }"
      >
        <!-- Team rail: full-bleed, so the two rows read as two lanes -->
        <div
          class="h-full self-stretch"
          :style="{ background: teamColor(side) }"
        />

        <div class="py-2.5">
          <TeamCode
            :name="nameOf(side)"
            :code="codeOf(side)"
            :color="teamColor(side)"
            size="md"
          />
        </div>

        <!-- Name column. The one flexible column, so it absorbs long names
             instead of pushing the score columns around. -->
        <div class="flex min-w-0 items-center gap-2.5 py-2.5">
          <span
            class="min-w-0 truncate text-[21px] leading-tight font-semibold tracking-tight"
          >
            <template v-for="(p, idx) in playersOf(side)" :key="idx">
              <span v-if="idx > 0" class="mx-1 font-normal text-white/30"
                >/</span
              >
              <!-- Server emphasis is weight, not hue. Recoloring the name to
                   the team color (as the older themes do) fights the rail
                   that already carries that identity, and drops contrast on
                   the one name you most want to read. -->
              <span
                :class="
                  p.isServer
                    ? 'font-bold text-white'
                    : p.isPartner
                      ? 'font-medium text-white/50'
                      : 'font-semibold text-white/90'
                "
                >{{ p.name }}</span
              >
            </template>
          </span>
          <ServeMarker
            v-if="isServingSide(side)"
            :color="teamColor(side)"
            size="md"
          />
          <span
            v-else-if="isMatchWinner(side)"
            class="shrink-0 rounded-[3px] px-2 py-0.5 text-[11px] font-bold tracking-[0.16em] text-white"
            :style="{ background: teamColor(side) }"
            >WINNER</span
          >
          <span
            v-else-if="isLastGameWinner(side)"
            class="shrink-0 rounded-[3px] border px-2 py-0.5 text-[11px] font-bold tracking-[0.14em] text-white/85"
            :style="{
              borderColor: teamColor(side),
              background: `color-mix(in srgb, ${teamColor(side)} 16%, transparent)`,
            }"
            >{{ wonLabel }}</span
          >
          <PenaltyCards :cards="cards(side)" size="sm" class="shrink-0" />
        </div>

        <!-- Completed + current games as boxed cells -->
        <GameCells
          v-if="withCells"
          :state="state"
          :side="side"
          :color="teamColor(side)"
          size="md"
        />

        <GamesWonPlate
          v-if="withStanding"
          :value="gamesWon[side]"
          :color="teamColor(side)"
          size="md"
        />

        <!-- Live score. Widest type on the card, hard right, fixed column. -->
        <span
          class="score text-right text-[48px] leading-none text-white tabular-nums"
        >
          {{ primaryScore(side) }}
        </span>
      </div>
    </div>

    <!-- Status bar. Only drawn when something is actually happening, so its
         appearance is itself the signal. -->
    <div
      v-if="status"
      class="flex items-center gap-2 px-5 py-2"
      :style="
        status.tone === 'accent' && status.side
          ? {
              background: `linear-gradient(90deg, ${teamColor(status.side)}, color-mix(in srgb, ${teamColor(status.side)} 25%, transparent) 70%)`,
            }
          : status.tone === 'warn'
            ? { background: 'rgba(180,83,9,0.9)' }
            : { background: 'rgba(255,255,255,0.06)' }
      "
    >
      <span class="text-[13px] font-bold tracking-[0.2em] text-white">
        {{ status.label }}
      </span>
      <span
        v-if="status.side"
        class="truncate text-[13px] font-semibold tracking-[0.12em] text-white/80"
      >
        · {{ status.side === 'A' ? teamNames.a : teamNames.b }}
      </span>
    </div>
  </div>
</template>
