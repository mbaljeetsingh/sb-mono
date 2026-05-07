<script setup lang="ts">
// Filmable — default scoreboard. Split-halves layout with massive numerals,
// designed to be read across the venue and to be filmed by a camera at the
// back of the hall. The hardest constraint is contrast at distance, so the
// active server gets a chunky team-colored pill + the player name flips into
// the team color.

import { computed, toRef } from "vue";
import type { ThemeProps } from "../index";
import SportIcon from "../sport-icon.vue";
import { teamColor, useThemeState } from "../use-theme-state";

const props = defineProps<ThemeProps>();

const {
  playersA,
  playersB,
  currentGame,
  isServingSide,
  isLastGameWinner,
  isMatchWinner,
} = useThemeState(toRef(props, "state"), toRef(props, "teamNames"));

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
  <div class="absolute inset-0 bg-black text-neutral-50 overflow-hidden">
    <!-- Top meta strip -->
    <div
      class="absolute top-0 inset-x-0 px-9 pt-6 flex justify-between items-center"
    >
      <div
        class="inline-flex items-center gap-3 text-[13px] tracking-[0.1em] font-bold text-neutral-400 uppercase"
      >
        <SportIcon :sport="config.sport" class="text-[18px] text-neutral-300" />
        {{ topMeta }}
      </div>
      <span
        v-if="state.matchOver"
        class="text-base font-bold tracking-[0.18em] text-neutral-200"
      >
        FINAL
      </span>
      <span
        v-else
        class="inline-flex items-center gap-2 text-[13px] font-bold tracking-[0.16em] text-neutral-200"
      >
        <span class="size-2 rounded-full bg-white animate-pulse-soft" />
        LIVE
        <span
          v-if="config.gamesToWin > 1"
          class="text-neutral-500 font-semibold"
          >· GAME {{ state.games.length }}</span
        >
      </span>
    </div>

    <!-- Big scoreboard: A on left, B on right, "vs" in the middle. -->
    <div
      class="absolute top-16 left-9 right-9 bottom-24 grid grid-cols-[1fr_auto_1fr] items-center gap-9"
    >
      <div
        v-for="side in ['a', 'b'] as const"
        :key="side"
        :class="[
          'rounded-xl transition-all duration-200 p-3',
          side === 'a' ? 'text-left' : 'text-right order-3',
        ]"
        :style="
          isServingSide(side)
            ? {
                background: `linear-gradient(${side === 'a' ? '90deg' : '270deg'}, color-mix(in srgb, ${teamColor(side)} 12%, transparent), transparent 80%)`,
              }
            : undefined
        "
      >
        <!-- Chip row. flex-row-reverse on side B so the team badge always sits
             closest to the score column and the live chip leads. -->
        <div
          :class="[
            'flex gap-2 mb-2 items-center',
            side === 'b' ? 'flex-row-reverse' : '',
          ]"
        >
          <span
            class="px-2 py-0.5 rounded text-white text-[10px] font-bold tracking-[0.1em]"
            :style="{ background: teamColor(side) }"
            >{{ side === "a" ? "TEAM A" : "TEAM B" }}</span
          >
          <span
            v-if="isMatchWinner(side)"
            class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-white text-[12px] font-bold tracking-[0.16em]"
            :style="{ background: teamColor(side) }"
          >
            ★ WINNER
          </span>
          <span
            v-else-if="isLastGameWinner(side)"
            class="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[12px] font-bold tracking-[0.16em] border"
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
            class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-white text-[12px] font-bold tracking-[0.16em]"
            :style="{ background: teamColor(side) }"
          >
            <span class="size-2 rounded-full bg-white animate-pulse-soft" />
            SERVE
          </span>
        </div>
        <div class="text-2xl font-semibold leading-snug uppercase">
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
          class="text-[11px] tracking-[0.1em] text-neutral-500 font-medium mt-0.5 uppercase"
        >
          {{ meta?.venue || "" }}
        </div>
        <div class="score mt-1 text-[152px] leading-[0.9]">
          {{ currentGame[side] }}
        </div>
      </div>

      <div
        class="text-center text-neutral-700 text-3xl font-semibold font-mono order-2"
      >
        vs
      </div>
    </div>

    <!-- GP/MP flash bar (only fires while a game/match point is live) -->
    <div
      v-if="(state.isGamePoint || state.isMatchPoint) && !state.matchOver"
      class="absolute bottom-20 inset-x-0 h-7 text-white text-[13px] font-bold tracking-[0.18em] flex items-center justify-center gap-3"
      :style="{
        background: `linear-gradient(90deg, ${teamColor(state.servingSide)}, color-mix(in srgb, ${teamColor(state.servingSide)} 80%, black))`,
      }"
    >
      ⚡ {{ state.isMatchPoint ? "MATCH POINT" : "GAME POINT" }} · TEAM
      {{ state.servingSide }}
    </div>

    <!-- Bottom strip: previous-game history + optional sponsor -->
    <div
      class="absolute bottom-0 inset-x-0 h-20 bg-neutral-950 border-t border-neutral-900 px-9 flex items-center justify-between"
    >
      <div class="flex gap-4 items-center">
        <span
          class="text-[11px] text-neutral-400 tracking-wider font-semibold uppercase"
          >HISTORY</span
        >
        <span
          class="font-mono text-base font-semibold tabular-nums tracking-wide"
        >
          <template v-for="(g, i) in previousGames" :key="i">
            G{{ i + 1 }} <span class="text-neutral-50">{{ g.a }}</span
            >–<span class="text-neutral-600">{{ g.b }}</span>
            <span v-if="i < previousGames.length - 1" class="mx-2">·</span>
          </template>
        </span>
      </div>
      <div v-if="meta?.sponsorName" class="flex items-center gap-2">
        <span
          class="text-[9px] text-neutral-600 tracking-[0.1em] font-semibold uppercase"
          >POWERED BY</span
        >
        <span class="text-lg font-bold tracking-[0.04em]">{{
          meta.sponsorName
        }}</span>
      </div>
    </div>
  </div>
</template>
