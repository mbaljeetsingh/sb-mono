<script setup lang="ts">
// Filmable — default scoreboard. Split-halves layout with massive numerals,
// designed to be read across the venue and to be filmed by a camera at the
// back of the hall. The hardest constraint is contrast at distance, so the
// active server gets a chunky team-colored pill + the player name flips into
// the team color.
//
// Sizing is fluid (clamp + vmin/vh/vw) and the layout reflows to stacked rows
// in portrait so the same theme reads well on phone, tablet, TV, and stream.

import { computed, toRef } from "vue";
import type { ThemeProps } from "../index";
import PenaltyCards from "../penalty-cards.vue";
import SportIcon from "../sport-icon.vue";
import {
  endReasonLabel,
  teamColor,
  useStatusPill,
  useThemeState,
} from "../use-theme-state";

const props = defineProps<ThemeProps>();

const {
  playersA,
  playersB,
  currentGame,
  isServingSide,
  isLastGameWinner,
  isMatchWinner,
  cards,
} = useThemeState(toRef(props, "state"), toRef(props, "teamNames"));
const status = useStatusPill(toRef(props, "state"));
const endReason = computed(() => endReasonLabel(props.state.endReason));

const playersOf = (side: "a" | "b") =>
  side === "a" ? playersA.value : playersB.value;

const topMeta = computed(() => {
  const m = props.meta ?? {};
  return [
    m.sportLabel ?? "BADMINTON",
    `BO${(props.config.gamesToWin - 1) * 2 + 1}`,
    m.category,
    m.round,
  ]
    .filter(Boolean)
    .join(" · ");
});

// Filmable's bottom history shows ALL completed games; while in-progress, the
// last entry is the current game (excluded).
const previousGames = computed(() => {
  const finished = props.state.games.length - (props.state.matchOver ? 0 : 1);
  return props.state.games.slice(0, Math.max(finished, 0));
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
          >· G{{ state.games.length }}</span
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
            class="px-2 py-0.5 rounded text-white text-[clamp(8px,1.1vmin,10px)] font-bold tracking-[0.1em]"
            :style="{ background: teamColor(side) }"
            >{{ side === "a" ? "TEAM A" : "TEAM B" }}</span
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
            GAME WON
          </span>
          <span
            v-else-if="isServingSide(side)"
            class="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-white text-[clamp(9px,1.3vmin,12px)] font-bold tracking-[0.16em]"
            :style="{ background: teamColor(side) }"
          >
            <span class="size-1.5 rounded-full bg-white animate-pulse-soft" />
            SERVE
          </span>
          <PenaltyCards :cards="cards(side)" size="sm" />
        </div>
        <div
          class="text-[clamp(13px,2.2vmin,28px)] font-semibold leading-snug uppercase"
        >
          <template v-for="(p, idx) in playersOf(side)" :key="idx">
            <span v-if="idx > 0" class="mx-1.5 text-neutral-600 font-normal"
              >/</span
            >
            <span
              :class="
                p.isServer
                  ? 'font-extrabold'
                  : p.isPartner
                    ? 'text-neutral-400 font-medium'
                    : 'text-neutral-50 font-semibold'
              "
              :style="p.isServer ? { color: teamColor(side) } : undefined"
              >{{ p.name }}</span
            >
          </template>
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
          {{ currentGame[side] }}
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
      {{
        status.tone === "accent" ? "⚡" : status.tone === "warn" ? "⏸" : "·"
      }}
      {{ status.label }}
      <span v-if="status.side">· TEAM {{ status.side }}</span>
    </div>

    <!-- Bottom strip: previous-game history + optional sponsor. Hidden
         entirely when there's nothing to show. -->
    <div
      v-if="previousGames.length || meta?.sponsorName"
      class="shrink-0 bg-neutral-950 border-t border-neutral-900 px-[clamp(12px,3vw,36px)] py-[clamp(6px,1.5vh,18px)] flex items-center justify-between gap-3"
    >
      <div
        v-if="previousGames.length"
        class="flex gap-3 items-center min-w-0 flex-wrap"
      >
        <span
          class="text-[clamp(9px,1.2vmin,11px)] text-neutral-400 tracking-wider font-semibold uppercase"
          >HISTORY</span
        >
        <span
          class="font-mono text-[clamp(11px,1.6vmin,16px)] font-semibold tabular-nums tracking-wide"
        >
          <template v-for="(g, i) in previousGames" :key="i">
            G{{ i + 1 }} <span class="text-neutral-50">{{ g.a }}</span
            >–<span class="text-neutral-600">{{ g.b }}</span>
            <span v-if="i < previousGames.length - 1" class="mx-2">·</span>
          </template>
        </span>
      </div>
      <div v-else></div>
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
    </div>
  </div>
</template>
