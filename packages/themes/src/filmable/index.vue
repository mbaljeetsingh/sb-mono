<script setup lang="ts">
// Filmable — default scoreboard. Split-halves layout with massive numerals,
// designed to be read across the venue and to be filmed by a camera at the
// back of the hall. The hardest constraint is contrast at distance, so the
// active server is marked with a glyph beside the name and the name itself goes
// to the heaviest weight — hue is left alone, because tinting the one name you
// most need to read spends contrast to repeat what the team badge already says.
//
// Sizing is fluid (clamp + vmin/vh/vw) and the layout reflows to stacked rows
// in portrait so the same theme reads well on phone, tablet, TV, and stream.

import { formatHeadline } from '@sb/engine';
import { computed, toRef } from 'vue';
import GameCells from '../game-cells.vue';
import GamesWonPlate from '../games-won-plate.vue';
import type { ThemeProps } from '../index';
import PenaltyCards from '../penalty-cards.vue';
import ServeMarker from '../serve-marker.vue';
import SportIcon from '../sport-icon.vue';
import {
  endReasonLabel,
  showStanding,
  teamColor,
  useStatusPill,
  useThemeState,
} from '../use-theme-state';

const props = defineProps<ThemeProps>();

const {
  playersA,
  playersB,
  primaryScore,
  unitInitial,
  wonLabel,
  showsPointTier,
  gamesWon,
  isServingSide,
  isLastGameWinner,
  isMatchWinner,
  cards,
} = useThemeState(
  toRef(props, 'state'),
  toRef(props, 'teamNames'),
  toRef(props, 'players'),
  toRef(props, 'config')
);
const status = useStatusPill(toRef(props, 'state'));
const endReason = computed(() => endReasonLabel(props.state.endReason));
const withStanding = computed(() => showStanding(props.config));

const playersOf = (side: 'a' | 'b') =>
  side === 'a' ? playersA.value : playersB.value;

// Singles = each side has exactly one player. In that case the "TEAM A" /
// "TEAM B" badge is just noise — the player's name (which is also the team
// name) is right next to it. Hide the badge unless we're in doubles.
const isDoubles = computed(
  () => playersA.value.length > 1 || playersB.value.length > 1
);

const topMeta = computed(() => {
  const m = props.meta ?? {};
  return [
    m.sportLabel,
    `BO${(props.config.gamesToWin - 1) * 2 + 1}`,
    m.category,
    m.round,
  ]
    .filter(Boolean)
    .join(' · ');
});

const formatLine = computed(() => {
  const c = props.config;
  const heading =
    c.gamesToWin === 1
      ? `Single ${unitInitial.value === 'S' ? 'set' : 'game'}`
      : `Best of ${c.gamesToWin * 2 - 1}`;
  return `${heading} · ${formatHeadline(c)}`;
});
</script>

<template>
  <div
    class="absolute inset-0 bg-black text-neutral-50 overflow-hidden flex flex-col"
  >
    <!-- Top meta strip -->
    <div
      class="shrink-0 flex justify-between items-center gap-3 px-[clamp(12px,3vw,36px)] pt-[clamp(8px,2.5vh,24px)]"
    >
      <div
        class="inline-flex items-center gap-2 text-[clamp(10px,1.4vmin,13px)] tracking-[0.1em] font-bold text-neutral-400 uppercase min-w-0"
      >
        <SportIcon
          :sport="config.sport"
          class="text-[clamp(14px,2vmin,18px)] text-neutral-300 shrink-0"
        />
        <span class="truncate">{{ topMeta }}</span>
      </div>
      <span
        v-if="state.matchOver"
        class="inline-flex items-center gap-2 text-[clamp(11px,1.6vmin,16px)] font-bold tracking-[0.18em] text-neutral-200 shrink-0"
      >
        FINAL
        <span
          v-if="endReason"
          class="text-[clamp(9px,1.2vmin,11px)] font-semibold tracking-[0.14em] text-neutral-400 uppercase"
        >
          · {{ endReason }}
        </span>
      </span>
      <span
        v-else-if="meta?.isLive !== false"
        class="inline-flex items-center gap-2 text-[clamp(10px,1.4vmin,13px)] font-bold tracking-[0.16em] text-neutral-200 shrink-0"
      >
        <span class="size-2 rounded-full bg-white animate-pulse-soft" />
        LIVE
        <span
          v-if="config.gamesToWin > 1"
          class="text-neutral-500 font-semibold"
          >· {{ unitInitial }}{{ state.games.length }}</span
        >
      </span>
    </div>

    <!-- Big scoreboard: split-halves in landscape, stacked rows in portrait. -->
    <div
      class="flex-1 min-h-0 grid items-center gap-[clamp(8px,2vmin,36px)] px-[clamp(12px,3vw,36px)] py-[clamp(8px,2vh,16px)] landscape:grid-cols-[1fr_auto_1fr] portrait:grid-rows-[1fr_auto_1fr] portrait:justify-items-center"
    >
      <div
        v-for="side in ['a', 'b'] as const"
        :key="side"
        :class="[
          'rounded-xl transition-all duration-200 p-[clamp(4px,1vmin,12px)] min-w-0 min-h-0 portrait:text-center',
          side === 'a'
            ? 'text-left order-1'
            : 'text-left landscape:text-right order-3',
        ]"
        :style="
          isServingSide(side)
            ? {
                background: `linear-gradient(${side === 'a' ? '90deg' : '270deg'}, color-mix(in srgb, ${teamColor(side)} 12%, transparent), transparent 80%)`,
              }
            : undefined
        "
      >
        <!-- Chip row. flex-row-reverse on side B (landscape only) so the team
             badge always sits closest to the score column. Portrait centers
             the chips. -->
        <div
          :class="[
            'flex gap-2 mb-1.5 items-center flex-wrap portrait:justify-center',
            side === 'b' ? 'landscape:flex-row-reverse' : '',
          ]"
        >
          <span
            v-if="isDoubles"
            class="px-2 py-0.5 rounded text-white text-[clamp(8px,1.1vmin,10px)] font-bold tracking-[0.1em]"
            :style="{ background: teamColor(side) }"
            >{{ side === 'a' ? 'TEAM A' : 'TEAM B' }}</span
          >
          <span
            v-if="isMatchWinner(side)"
            class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-white text-[clamp(9px,1.3vmin,12px)] font-bold tracking-[0.16em]"
            :style="{ background: teamColor(side) }"
          >
            ★ WINNER
          </span>
          <span
            v-else-if="isLastGameWinner(side)"
            class="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[clamp(9px,1.3vmin,12px)] font-bold tracking-[0.16em] border"
            :style="{
              borderColor: teamColor(side),
              color: teamColor(side),
              background: `color-mix(in srgb, ${teamColor(side)} 12%, transparent)`,
            }"
          >
            {{ wonLabel }}
          </span>
          <PenaltyCards :cards="cards(side)" size="sm" />
        </div>
        <!-- Serve marker sits inline with the name, not in the chip row above.
             In singles there is no TEAM badge, so a marker up there rendered as
             a single dot floating over empty space with nothing to attach to. -->
        <div
          :class="[
            'flex items-center gap-[clamp(4px,1vmin,10px)] portrait:justify-center',
            side === 'b' ? 'landscape:flex-row-reverse' : '',
          ]"
        >
          <div
            class="text-[clamp(13px,2.2vmin,28px)] font-semibold leading-snug uppercase min-w-0"
          >
            <template v-for="(p, idx) in playersOf(side)" :key="idx">
              <span v-if="idx > 0" class="mx-1.5 text-neutral-600 font-normal"
                >/</span
              >
              <!-- Weight, not hue. On a camera-filmed board the serving player's
                 name is the one you most need legible, and tinting it to the
                 team colour traded contrast away for identity the badge and
                 marker already supply. -->
              <span
                :class="
                  p.isServer
                    ? 'font-extrabold text-white'
                    : p.isPartner
                      ? 'text-neutral-400 font-medium'
                      : 'text-neutral-50 font-semibold'
                "
                >{{ p.name }}</span
              >
            </template>
          </div>
          <ServeMarker
            v-if="isServingSide(side)"
            :color="teamColor(side)"
            size="md"
          />
        </div>
        <div
          v-if="meta?.venue"
          class="text-[clamp(9px,1.1vmin,11px)] tracking-[0.1em] text-neutral-500 font-medium mt-0.5 uppercase"
        >
          {{ meta.venue }}
        </div>
        <div
          class="score leading-[0.9] mt-1 text-[clamp(72px,min(24vh,30vw),200px)] portrait:text-[clamp(96px,min(28vh,38vw),260px)]"
        >
          {{ primaryScore(side) }}
        </div>
        <!-- Completed games as boxed cells, directly under this side's numeral.
             They used to live in a single shared "HISTORY G1 21–18" line in the
             footer, which meant reading a match standing required parsing a
             sentence and mentally splitting each pair. Per-side cells put each
             side's history under its own score, where it belongs. -->
        <!-- Cells keep left-to-right game order on BOTH sides (G1 first), and the
             standing plate stays last. Mirroring the row for side B — as the name
             and chip rows do — put its plate before its cells and reversed the
             reading order against side A, so comparing the two took a second
             look. Only the block's alignment mirrors, never the cell order. -->
        <div
          v-if="config.gamesToWin > 1"
          :class="[
            'mt-[clamp(4px,1.2vh,14px)] flex items-center gap-[clamp(4px,1vmin,10px)] portrait:justify-center',
            side === 'b' ? 'landscape:justify-end' : '',
          ]"
        >
          <GameCells
            :state="state"
            :side="side"
            :color="teamColor(side)"
            size="md"
            :include-current="showsPointTier"
          />
          <GamesWonPlate
            v-if="withStanding"
            :value="gamesWon[side]"
            :color="teamColor(side)"
            size="md"
          />
        </div>
      </div>

      <!-- Divider: "vs" text in landscape, thin rule in portrait. One grid
           child either way so the 3-row/col template stays clean. -->
      <div
        class="order-2 text-center text-neutral-700 font-semibold font-mono text-[clamp(16px,3vmin,32px)] portrait:flex portrait:items-center portrait:justify-center portrait:w-full"
      >
        <span class="portrait:hidden">vs</span>
        <span
          class="hidden portrait:block h-px w-1/3 bg-neutral-800"
          aria-hidden="true"
        ></span>
      </div>
    </div>

    <!-- Status flash bar (sits just above the bottom strip). -->
    <div
      v-if="status && !state.matchOver"
      class="shrink-0 text-white text-[clamp(10px,1.4vmin,13px)] font-bold tracking-[0.18em] flex items-center justify-center gap-3 py-[clamp(3px,0.8vh,6px)]"
      :style="
        status.tone === 'accent' && status.side
          ? {
              background: `linear-gradient(90deg, ${teamColor(status.side.toLowerCase() as 'a' | 'b')}, color-mix(in srgb, ${teamColor(status.side.toLowerCase() as 'a' | 'b')} 80%, black))`,
            }
          : status.tone === 'warn'
            ? { background: 'linear-gradient(90deg, #f59e0b, #b45309)' }
            : { background: '#27272a' }
      "
    >
      {{ status.tone === 'accent' ? '⚡' : status.tone === 'warn' ? '⏸' : '·' }}
      {{ status.label }}
      <span v-if="status.side">· TEAM {{ status.side }}</span>
    </div>

    <!-- Bottom strip: previous-game history on the left, sponsor or wordmark
         on the right. Always renders so the layout has a stable base line. -->
    <div
      class="shrink-0 bg-neutral-950 border-t border-neutral-900 px-[clamp(12px,3vw,36px)] py-[clamp(6px,1.5vh,18px)] flex items-center justify-between gap-3"
    >
      <span
        class="text-[clamp(9px,1.2vmin,11px)] text-neutral-500 tracking-[0.14em] font-semibold uppercase truncate"
        >{{ formatLine }}</span
      >
      <div
        v-if="meta?.sponsorName"
        class="flex items-center gap-2 shrink-0 min-w-0"
      >
        <span
          class="text-[clamp(8px,1vmin,9px)] text-neutral-600 tracking-[0.1em] font-semibold uppercase"
          >POWERED BY</span
        >
        <span
          class="text-[clamp(12px,1.8vmin,18px)] font-bold tracking-[0.04em] truncate"
          >{{ meta.sponsorName }}</span
        >
      </div>
      <span
        v-else
        class="shrink-0 text-[clamp(9px,1.2vmin,11px)] text-neutral-500 tracking-[0.14em] font-semibold uppercase"
        >SCOREBOARD APP</span
      >
    </div>
  </div>
</template>
