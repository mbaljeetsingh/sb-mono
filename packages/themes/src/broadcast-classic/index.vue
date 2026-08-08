<script setup lang="ts">
// Broadcast Classic — default overlay. Modern dark-glass lower-third.
// Brand-neutral by design; tournament-branded variants ship as paid packs.
//
// Surfaces: name (with active-server emphasis in doubles), boxed per-game
// cells, games-won standing in BO5+, current game in big numerals, serve
// marker, penalty card glyphs, and a context status pill (GP / MP / timeout /
// interval / suspension).

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
  useMetaLine,
  useStatusPill,
  useThemeState,
} from '../use-theme-state';

const props = defineProps<ThemeProps>();
const endReason = computed(() => endReasonLabel(props.state.endReason));

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
const meta = useMetaLine(toRef(props, 'meta'), toRef(props, 'config'));
const isLive = computed(() => props.meta?.isLive !== false);
const withStanding = computed(() => showStanding(props.config));

const playersOf = (side: 'a' | 'b') =>
  side === 'a' ? playersA.value : playersB.value;

// One template for both rows, so the score columns form true vertical columns.
// Previously each row sized its own `auto` columns from its own content, which
// let the two big numerals sit at different x positions.
const columns = computed(() =>
  ['5px', 'minmax(0,1fr)', 'auto', withStanding.value ? 'auto' : null, '74px']
    .filter(Boolean)
    .join(' ')
);
</script>

<template>
  <div
    class="absolute left-12 bottom-12 w-[620px] rounded-xl overflow-hidden border border-white/10 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.7)] bg-neutral-950/90 backdrop-blur-md font-sans"
  >
    <!-- Meta strip -->
    <div
      class="px-6 py-3 flex items-center justify-between border-b border-white/5"
    >
      <span
        class="inline-flex items-center gap-2 text-[13px] font-semibold tracking-[0.14em] uppercase text-neutral-400 min-w-0 flex-1"
      >
        <SportIcon :sport="config.sport" class="text-[17px] shrink-0" />
        <span class="truncate">{{ meta || '&nbsp;' }}</span>
      </span>
      <span
        v-if="state.matchOver"
        class="text-[13px] font-bold tracking-[0.14em] text-white/90 shrink-0 ml-2"
      >
        {{ config.gamesToWin > 1 ? 'FINAL' : 'GAME' }}
      </span>
      <span
        v-else-if="isLive"
        class="inline-flex items-center gap-1.5 text-[13px] font-bold tracking-[0.14em] text-white/80 shrink-0 ml-2"
      >
        <span class="size-2 rounded-full bg-white animate-pulse-soft" />
        LIVE
        <span v-if="config.gamesToWin > 1" class="text-white/55 font-semibold"
          >· GAME {{ state.games.length }}</span
        >
      </span>
    </div>

    <!-- Team rows -->
    <div class="divide-y divide-white/5">
      <div
        v-for="side in ['a', 'b'] as const"
        :key="side"
        class="grid gap-x-4 items-center pr-6 transition-colors duration-200"
        :style="{
          gridTemplateColumns: columns,
          background: isServingSide(side)
            ? `linear-gradient(90deg, color-mix(in srgb, ${teamColor(side)} 14%, transparent), transparent 70%)`
            : undefined,
        }"
      >
        <!-- Team color bar -->
        <div
          class="h-full self-stretch"
          :style="{ background: teamColor(side) }"
        />

        <!-- Name + cards + games-won pips -->
        <div class="py-3.5 min-w-0">
          <div class="flex items-center gap-2.5 min-w-0">
            <span
              class="truncate text-[19px] font-semibold tracking-tight text-white"
            >
              <template v-for="(p, idx) in playersOf(side)" :key="idx">
                <span v-if="idx > 0" class="mx-1 text-white/40 font-normal"
                  >/</span
                >
                <!-- Server emphasis is weight, not hue: the team rail two
                     columns left already carries side identity, and recoloring
                     the name spent contrast on the one name most worth
                     reading. -->
                <span
                  :class="
                    p.isServer
                      ? 'font-bold text-white'
                      : p.isPartner
                        ? 'text-white/55 font-medium'
                        : 'text-white font-semibold'
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
              class="shrink-0 inline-flex items-center gap-1.5 text-[11px] font-bold tracking-[0.16em] text-white px-2 py-0.5 rounded-sm"
              :style="{ background: teamColor(side) }"
            >
              WINNER
              <span
                v-if="endReason"
                class="text-[10px] font-semibold tracking-[0.12em] text-white/80 uppercase"
              >
                · {{ endReason }}
              </span>
            </span>
            <span
              v-else-if="isLastGameWinner(side)"
              class="shrink-0 text-[11px] font-bold tracking-[0.14em] text-white/85 px-2 py-0.5 rounded-sm border"
              :style="{
                borderColor: teamColor(side),
                background: `color-mix(in srgb, ${teamColor(side)} 18%, transparent)`,
              }"
            >
              GAME WON
            </span>
            <PenaltyCards :cards="cards(side)" size="sm" />
          </div>
        </div>

        <!-- Completed games as boxed cells. The live game is excluded: it's in
             big numerals two columns right, and printing it twice made the
             panel read as two different scores. -->
        <GameCells
          :state="state"
          :side="side"
          :color="teamColor(side)"
          size="sm"
          :include-current="false"
        />

        <GamesWonPlate
          v-if="withStanding"
          :value="gamesWon[side]"
          :color="teamColor(side)"
          size="sm"
        />

        <!-- Current game -->
        <span class="score text-[44px] leading-none text-white text-right">
          {{ currentGame[side] }}
        </span>
      </div>
    </div>

    <!-- Status pill -->
    <div
      v-if="status"
      class="px-6 py-2 border-t border-white/5 flex items-center gap-2"
      :class="{
        'bg-white/5': status.tone === 'muted' || status.tone === 'warn',
      }"
      :style="
        status.tone === 'accent' && status.side
          ? {
              background: `linear-gradient(90deg, ${teamColor(status.side)}, transparent)`,
            }
          : undefined
      "
    >
      <span class="text-[13px] font-bold tracking-[0.18em] text-white">
        {{ status.label }}
      </span>
      <span
        v-if="status.side"
        class="text-[13px] font-semibold tracking-[0.14em] text-white/75"
      >
        · {{ status.side === 'A' ? teamNames.a : teamNames.b }}
      </span>
    </div>
  </div>
</template>
