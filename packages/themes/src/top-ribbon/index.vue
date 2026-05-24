<script setup lang="ts">
// Top Ribbon — full-width banner pinned to the top of the frame. Centred score
// in the middle, team blocks left/right. Brand-neutral (no amber/yellow); the
// only chrome is a single subtle bottom border.

import { computed, toRef } from "vue";
import type { ThemeProps } from "../index";
import PenaltyCards from "../penalty-cards.vue";
import SportIcon from "../sport-icon.vue";
import {
  endReasonLabel,
  teamColor,
  useMetaLine,
  useStatusPill,
  useThemeState,
} from "../use-theme-state";

const props = defineProps<ThemeProps>();
const {
  playersA,
  playersB,
  cards,
  currentGame,
  priorGames,
  isServingSide,
  isLastGameWinner,
  isMatchWinner,
} = useThemeState(toRef(props, "state"), toRef(props, "teamNames"));
const meta = useMetaLine(toRef(props, "meta"));
const isLive = computed(() => props.meta?.isLive !== false);
const status = useStatusPill(toRef(props, "state"));
const endReason = computed(() => endReasonLabel(props.state.endReason));

const playersOf = (side: "a" | "b") =>
  side === "a" ? playersA.value : playersB.value;
</script>

<template>
  <!-- Main ribbon -->
  <div
    class="absolute top-0 inset-x-0 h-16 grid grid-cols-[1fr_auto_1fr] items-center px-6 border-b border-white/10 bg-[linear-gradient(180deg,rgba(10,10,10,0.95)_0%,rgba(23,23,23,0.95)_100%)] text-white font-sans"
  >
    <!-- Each team block: side A left-aligned, side B right-aligned with order swap -->
    <div
      v-for="side in ['a', 'b'] as const"
      :key="side"
      :class="[
        'flex items-center gap-3 min-w-0',
        side === 'b' ? 'justify-end flex-row-reverse order-3' : '',
      ]"
    >
      <span class="w-1 h-9 shrink-0" :style="{ background: teamColor(side) }" />
      <div :class="['min-w-0', side === 'b' ? 'text-right' : '']">
        <div class="text-[13px] font-semibold leading-tight uppercase truncate">
          <template v-for="(p, idx) in playersOf(side)" :key="idx">
            <span v-if="idx > 0" class="mx-1 text-white/35 font-normal">/</span>
            <span
              :class="
                p.isServer
                  ? 'font-bold'
                  : p.isPartner
                    ? 'text-white/55 font-medium'
                    : 'text-neutral-50 font-semibold'
              "
              :style="p.isServer ? { color: teamColor(side) } : undefined"
              >{{ p.name }}</span
            >
          </template>
        </div>
      </div>
      <!-- Chip cycle: WINNER → GAME WON → SERVE -->
      <span
        v-if="isMatchWinner(side)"
        class="shrink-0 text-[9px] font-bold tracking-[0.16em] text-white px-1.5 py-0.5 rounded-sm"
        :style="{ background: teamColor(side) }"
      >
        WINNER
      </span>
      <span
        v-else-if="isLastGameWinner(side)"
        class="shrink-0 text-[9px] font-bold tracking-[0.14em] text-white/85 px-1.5 py-0.5 rounded-sm border"
        :style="{
          borderColor: teamColor(side),
          background: `color-mix(in srgb, ${teamColor(side)} 18%, transparent)`,
        }"
      >
        GAME WON
      </span>
      <span
        v-else-if="isServingSide(side)"
        class="shrink-0 inline-flex items-center gap-1 text-[9px] font-bold tracking-[0.14em] text-white px-1.5 py-0.5 rounded-sm"
        :style="{ background: teamColor(side) }"
      >
        <span class="size-1 rounded-full bg-white animate-pulse-soft" />
        SERVE
      </span>
      <PenaltyCards :cards="cards(side)" size="xs" class="shrink-0" />
    </div>

    <!-- Center score: prior games stack small on either side, current in big -->
    <div class="flex items-center justify-center gap-3 order-2">
      <div
        v-if="priorGames.length"
        class="score text-base text-neutral-500 tabular-nums flex flex-col items-end leading-tight"
      >
        <span v-for="(g, i) in priorGames" :key="i">{{ g.a }}</span>
      </div>
      <span class="score text-[40px] text-neutral-50 tabular-nums">{{
        currentGame.a
      }}</span>
      <span class="text-lg text-neutral-600 font-medium">—</span>
      <span class="score text-[40px] text-neutral-50 tabular-nums">{{
        currentGame.b
      }}</span>
      <div
        v-if="priorGames.length"
        class="score text-base text-neutral-500 tabular-nums flex flex-col items-start leading-tight"
      >
        <span v-for="(g, i) in priorGames" :key="i">{{ g.b }}</span>
      </div>
    </div>
  </div>

  <!-- Sub-strip: meta on the left, status on the right. Dark + restrained,
       no tournament-branded accent. -->
  <div
    class="absolute top-16 inset-x-0 h-[22px] bg-neutral-900/95 text-neutral-300 flex items-center justify-between px-6 text-[10px] font-semibold tracking-[0.12em] uppercase border-b border-white/5"
  >
    <span class="inline-flex items-center gap-2 min-w-0 flex-1">
      <SportIcon :sport="config.sport" class="text-[12px] shrink-0" />
      <span class="truncate">{{ meta || "&nbsp;" }}</span>
    </span>
    <span
      v-if="state.matchOver"
      class="inline-flex items-center gap-1.5 text-white tracking-[0.16em] font-bold shrink-0 ml-3"
    >
      FINAL
      <span v-if="endReason" class="text-[9px] text-white/70">
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
