<script setup lang="ts">
// Top Ribbon — full-width banner pinned to the top of the frame. Centred score
// in the middle, team blocks left/right. Brand-neutral (no amber/yellow); the
// only chrome is a single subtle bottom border.

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
const meta = useMetaLine(toRef(props, 'meta'), toRef(props, 'config'));
const isLive = computed(() => props.meta?.isLive !== false);
const status = useStatusPill(toRef(props, 'state'));
const endReason = computed(() => endReasonLabel(props.state.endReason));
const withStanding = computed(() => showStanding(props.config));

const playersOf = (side: 'a' | 'b') =>
  side === 'a' ? playersA.value : playersB.value;
</script>

<template>
  <!-- Main ribbon -->
  <div
    class="absolute top-0 inset-x-0 h-20 grid grid-cols-[1fr_auto_1fr] items-center px-8 border-b border-white/10 bg-[linear-gradient(180deg,#0a0a0a_0%,#171717_100%)] text-white font-sans"
  >
    <!-- Each team block: side A left-aligned, side B right-aligned with order swap -->
    <div
      v-for="side in ['a', 'b'] as const"
      :key="side"
      :class="[
        'flex items-center gap-3 min-w-0',
        side === 'b' ? 'justify-start flex-row-reverse order-3' : '',
      ]"
    >
      <span
        class="w-1.5 h-11 shrink-0"
        :style="{ background: teamColor(side) }"
      />
      <div :class="['min-w-0', side === 'b' ? 'text-right' : '']">
        <div class="text-[17px] font-semibold leading-tight uppercase truncate">
          <template v-for="(p, idx) in playersOf(side)" :key="idx">
            <span v-if="idx > 0" class="mx-1 text-white/35 font-normal">/</span>
            <!-- Weight, not hue — the colour rule left of the name already
                 carries side identity. -->
            <span
              :class="
                p.isServer
                  ? 'font-bold text-white'
                  : p.isPartner
                    ? 'text-white/55 font-medium'
                    : 'text-neutral-50 font-semibold'
              "
              >{{ p.name }}</span
            >
          </template>
        </div>
      </div>
      <ServeMarker
        v-if="isServingSide(side)"
        :color="teamColor(side)"
        size="md"
        :variant="'caret'"
        :direction="side === 'a' ? 'right' : 'left'"
      />
      <!-- Chip cycle: WINNER → GAME WON (serve is the caret above) -->
      <span
        v-if="isMatchWinner(side)"
        class="shrink-0 text-[11px] font-bold tracking-[0.16em] text-white px-2 py-0.5 rounded-sm"
        :style="{ background: teamColor(side) }"
      >
        WINNER
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
      <PenaltyCards :cards="cards(side)" size="sm" class="shrink-0" />
    </div>

    <!-- Center scoreline. Completed games read outward from the centre as boxed
         cells, mirrored either side of the live score — a ribbon has no room for
         a column layout, so the mirror is what keeps each side's history
         attached to that side. Fixed 66px live columns so the numbers stay put
         as the score crosses 10. -->
    <div class="flex items-center justify-center gap-3 order-2">
      <GamesWonPlate
        v-if="withStanding"
        :value="gamesWon.a"
        :color="teamColor('a')"
        size="sm"
      />
      <GameCells
        :state="state"
        side="a"
        :color="teamColor('a')"
        size="sm"
        :include-current="false"
      />
      <span
        class="score text-[50px] text-neutral-50 tabular-nums w-[66px] text-right"
        >{{ currentGame.a }}</span
      >
      <span class="text-xl text-neutral-600 font-medium">—</span>
      <span class="score text-[50px] text-neutral-50 tabular-nums w-[66px]">{{
        currentGame.b
      }}</span>
      <GameCells
        :state="state"
        side="b"
        :color="teamColor('b')"
        size="sm"
        :include-current="false"
      />
      <GamesWonPlate
        v-if="withStanding"
        :value="gamesWon.b"
        :color="teamColor('b')"
        size="sm"
      />
    </div>
  </div>

  <!-- Sub-strip: meta on the left, status on the right. Dark + restrained,
       no tournament-branded accent. -->
  <div
    class="absolute top-20 inset-x-0 h-[28px] bg-neutral-900 text-neutral-300 flex items-center justify-between px-8 text-[13px] font-semibold tracking-[0.12em] uppercase border-b border-white/5"
  >
    <span class="inline-flex items-center gap-2 min-w-0 flex-1">
      <SportIcon :sport="config.sport" class="text-[15px] shrink-0" />
      <span class="truncate">{{ meta || '&nbsp;' }}</span>
    </span>
    <span
      v-if="state.matchOver"
      class="inline-flex items-center gap-1.5 text-white tracking-[0.16em] font-bold shrink-0 ml-3"
    >
      FINAL
      <span v-if="endReason" class="text-[11px] text-white/70">
        · {{ endReason }}
      </span>
    </span>
    <span
      v-else-if="status"
      class="inline-flex items-center gap-1.5 font-bold shrink-0 ml-3"
      :style="
        status.tone === 'accent' && status.side
          ? { color: teamColor(status.side) }
          : undefined
      "
    >
      {{ status.label }}
    </span>
    <span
      v-else-if="isLive"
      class="inline-flex items-center gap-1.5 text-neutral-400 shrink-0 ml-3"
    >
      <span class="size-1.5 rounded-full bg-white animate-pulse-soft" />
      LIVE · GAME {{ state.games.length }}
    </span>
  </div>
</template>
