<script setup lang="ts">
// Scorecard — scoreboard styled like a printed tournament program. Tabulates
// every game in a column-per-game grid (G1 / G2 / G3 / TOTAL), with rows for
// each team. Reads like a paper scoresheet on the clubhouse TV.
//
// Calm + structured: no LIVE pulse, no animations. Active state surfaces as
// a small caption strip above the table.
//
// Sizing is fluid (clamp + vmin/vw/vh) so the table fits any viewport from a
// portrait phone to a wall TV without horizontal scroll.

import { computed, toRef } from 'vue';
import type { ThemeProps } from '../index';
import PenaltyCards from '../penalty-cards.vue';
import ServeMarker from '../serve-marker.vue';
import SportIcon from '../sport-icon.vue';
import {
  endReasonLabel,
  gameCellsOf,
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
  games,
  gamesWon,
  isServingSide,
  isLastGameWinner,
  isMatchWinner,
} = useThemeState(
  toRef(props, 'state'),
  toRef(props, 'teamNames'),
  toRef(props, 'players')
);
const meta = useMetaLine(toRef(props, 'meta'), toRef(props, 'config'));
const isLive = computed(() => props.meta?.isLive !== false);
const status = useStatusPill(toRef(props, 'state'));
const endReason = computed(() => endReasonLabel(props.state.endReason));

const playersOf = (side: 'a' | 'b') =>
  side === 'a' ? playersA.value : playersB.value;

// One column per game actually played (or in progress). No empty placeholders
// — the layout grows as games roll in instead of pre-allocating empty G3 slots.
const gameColumns = computed(() => games.value);

// SERVING drops out — the marker next to the name carries it, the way a printed
// scoresheet marks service with a tick rather than a word.
const sideStatus = (side: 'a' | 'b') => {
  if (isMatchWinner(side)) return 'WINNER';
  if (isLastGameWinner(side)) return 'GAME WON';
  return null;
};

const cells = computed(() => gameCellsOf(props.state));
const isCurrentGameCol = (idx: number) => cells.value[idx]?.isCurrent ?? false;
// A completed game this side took. Emphasising the winner per cell is what
// turns the grid from "numbers in boxes" into a readable scoresheet — the old
// version only distinguished the live column, so a finished BO5 was flat.
const wonGame = (idx: number, side: 'a' | 'b') =>
  cells.value[idx]?.winner === side;

const withStanding = computed(() => showStanding(props.config));

// Score columns are fluid: shrink to ~52px on a phone, grow to 90px on a TV.
// The trailing column is the games-won total, present only in BO5+.
const gridTemplate = computed(
  () =>
    `minmax(0,1fr) repeat(${gameColumns.value.length}, clamp(52px,10vw,90px))${
      withStanding.value ? ' clamp(56px,11vw,100px)' : ''
    }`
);
</script>

<template>
  <div
    class="absolute inset-0 bg-stone-50 text-neutral-950 overflow-hidden font-sans"
  >
    <div
      class="absolute inset-0 flex flex-col px-[clamp(14px,4vw,64px)] py-[clamp(12px,3vh,48px)]"
    >
      <!-- Header -->
      <div
        class="flex items-start justify-between gap-3 text-[clamp(9px,1.2vmin,11px)] font-bold tracking-[0.16em] text-neutral-600 uppercase shrink-0"
      >
        <span class="inline-flex items-center gap-2 min-w-0">
          <SportIcon
            :sport="config.sport"
            class="text-[clamp(14px,2vmin,18px)] text-neutral-700 shrink-0"
          />
          <span class="truncate">{{ meta }}</span>
        </span>
        <span
          v-if="state.matchOver"
          class="inline-flex items-center gap-2 text-neutral-900 shrink-0"
        >
          FINAL
          <span
            v-if="endReason"
            class="text-[clamp(8px,1vmin,10px)] text-neutral-500"
          >
            · {{ endReason }}
          </span>
        </span>
        <span v-else-if="status" class="text-neutral-900 shrink-0">{{
          status.label
        }}</span>
        <span v-else-if="isLive" class="shrink-0"
          >GAME {{ state.games.length }} · LIVE</span
        >
      </div>

      <!-- Centered table -->
      <div class="my-auto min-h-0">
        <!-- Column headers (G1 G2 ...). Hidden in single-game formats. -->
        <div
          v-if="config.gamesToWin > 1"
          class="grid items-end gap-x-[clamp(8px,1.5vw,24px)] mb-2 pb-2 border-b border-neutral-300"
          :style="{ gridTemplateColumns: gridTemplate }"
        >
          <div></div>
          <div
            v-for="(_, idx) in gameColumns"
            :key="idx"
            class="text-center text-[clamp(9px,1.2vmin,11px)] font-bold tracking-[0.16em] text-neutral-500 uppercase"
            :class="{ 'text-neutral-900': isCurrentGameCol(idx) }"
          >
            G{{ idx + 1 }}
          </div>
          <div
            v-if="withStanding"
            class="text-center text-[clamp(9px,1.2vmin,11px)] font-bold tracking-[0.16em] text-neutral-900 uppercase"
          >
            Games
          </div>
        </div>

        <!-- Per-team rows -->
        <div
          v-for="side in ['a', 'b'] as const"
          :key="side"
          class="grid items-center gap-x-[clamp(8px,1.5vw,24px)] py-[clamp(6px,1.5vh,16px)] border-b border-neutral-200 last:border-b-0"
          :style="{ gridTemplateColumns: gridTemplate }"
        >
          <!-- Name + side caption -->
          <div class="min-w-0">
            <div class="flex items-center gap-2 flex-wrap">
              <span
                class="size-2 rounded-sm shrink-0"
                :style="{ background: teamColor(side) }"
              />
              <span
                class="text-[clamp(15px,3vmin,28px)] leading-tight tracking-tight uppercase truncate min-w-0"
              >
                <template v-for="(p, idx) in playersOf(side)" :key="idx">
                  <span
                    v-if="idx > 0"
                    class="mx-1.5 text-neutral-400 font-normal"
                    >/</span
                  >
                  <span
                    :class="
                      p.isServer
                        ? 'font-bold text-neutral-950'
                        : p.isPartner
                          ? 'text-neutral-400 font-medium'
                          : 'text-neutral-900 font-semibold'
                    "
                    >{{ p.name }}</span
                  >
                </template>
              </span>
              <ServeMarker
                v-if="isServingSide(side)"
                :color="teamColor(side)"
                size="sm"
                :animate="false"
                class="shrink-0"
              />
              <span
                v-if="sideStatus(side)"
                class="text-[clamp(8px,1.1vmin,10px)] font-bold tracking-[0.18em] uppercase shrink-0"
                :style="{ color: teamColor(side) }"
                >· {{ sideStatus(side) }}</span
              >
              <PenaltyCards :cards="cards(side)" size="sm" class="shrink-0" />
            </div>
          </div>
          <!-- Per-game scores. Three tiers: live column in team colour, a game
               this side won in full black, a game they lost dimmed. -->
          <div v-for="(g, idx) in gameColumns" :key="idx" class="text-center">
            <span
              v-if="g"
              class="score leading-none tabular-nums text-[clamp(24px,5vmin,44px)]"
              :class="
                isCurrentGameCol(idx)
                  ? ''
                  : wonGame(idx, side)
                    ? 'text-neutral-950 font-bold'
                    : 'text-neutral-400'
              "
              :style="
                isCurrentGameCol(idx) ? { color: teamColor(side) } : undefined
              "
              >{{ g[side] }}</span
            >
            <span
              v-else
              class="text-neutral-300 text-[clamp(16px,2.5vmin,24px)]"
              >·</span
            >
          </div>
          <!-- Games-won total (BO5+ only) -->
          <div v-if="withStanding" class="text-center">
            <span
              class="score inline-flex items-center justify-center rounded-[3px] px-[clamp(4px,1vmin,10px)] leading-none tabular-nums text-[clamp(24px,5vmin,44px)]"
              :class="
                gamesWon[side] > 0
                  ? 'text-white'
                  : 'bg-neutral-200/80 text-neutral-400'
              "
              :style="
                gamesWon[side] > 0 ? { background: teamColor(side) } : undefined
              "
              >{{ gamesWon[side] }}</span
            >
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div
        class="flex justify-between items-end gap-3 text-[clamp(9px,1.2vmin,11px)] text-neutral-500 tracking-[0.14em] font-semibold uppercase shrink-0"
      >
        <span class="truncate">
          {{
            config.gamesToWin === 1
              ? 'Single game'
              : `Best of ${config.gamesToWin * 2 - 1}`
          }}
          · first to {{ config.pointsPerGame }}
        </span>
        <span class="shrink-0">SCOREBOARD APP</span>
      </div>
    </div>
  </div>
</template>
