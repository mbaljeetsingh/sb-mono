<script setup lang="ts">
// Scorecard — scoreboard styled like a printed tournament program. Tabulates
// every game in a column-per-game grid (G1 / G2 / G3 / TOTAL), with rows for
// each team. Reads like a paper scoresheet on the clubhouse TV.
//
// Calm + structured: no LIVE pulse, no animations. Active state surfaces as
// a small caption strip above the table.

import { computed, toRef } from "vue";
import type { ThemeProps } from "../index";
import PenaltyCards from "../penalty-cards.vue";
import SportIcon from "../sport-icon.vue";
import {
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
  games,
  isServingSide,
  isLastGameWinner,
  isMatchWinner,
} = useThemeState(toRef(props, "state"), toRef(props, "teamNames"));
const meta = useMetaLine(toRef(props, "meta"));
const status = useStatusPill(toRef(props, "state"));

const playersOf = (side: "a" | "b") =>
  side === "a" ? playersA.value : playersB.value;

// One column per game actually played (or in progress). No empty placeholders
// — the layout grows as games roll in instead of pre-allocating empty G3 slots.
const gameColumns = computed(() => games.value);

const sideStatus = (side: "a" | "b") => {
  if (isMatchWinner(side)) return "WINNER";
  if (isLastGameWinner(side)) return "GAME WON";
  if (isServingSide(side)) return "SERVING";
  return null;
};

const isCurrentGameCol = (idx: number) =>
  !props.state.matchOver &&
  !props.state.betweenGames &&
  idx === games.value.length - 1;

const gridTemplate = computed(
  () => `minmax(0,1fr) repeat(${gameColumns.value.length}, 90px)`,
);
</script>

<template>
  <div
    class="absolute inset-0 bg-stone-50 text-neutral-950 overflow-hidden font-sans"
  >
    <div class="absolute inset-0 px-16 py-12 flex flex-col">
      <!-- Header -->
      <div
        class="flex items-start justify-between text-[11px] font-bold tracking-[0.16em] text-neutral-600 uppercase"
      >
        <span class="inline-flex items-center gap-3">
          <SportIcon
            :sport="config.sport"
            class="text-[18px] text-neutral-700"
          />
          {{ meta }}
        </span>
        <span v-if="state.matchOver" class="text-neutral-900">FINAL</span>
        <span v-else-if="status" class="text-neutral-900">{{
          status.label
        }}</span>
        <span v-else>GAME {{ state.games.length }} · LIVE</span>
      </div>

      <!-- Centered table -->
      <div class="my-auto">
        <!-- Column headers (G1 G2 ...). Hidden in single-game formats —
             one column doesn't need a label. -->
        <div
          v-if="config.gamesToWin > 1"
          class="grid items-end gap-x-6 mb-3 pb-2 border-b border-neutral-300"
          :style="{ gridTemplateColumns: gridTemplate }"
        >
          <div></div>
          <div
            v-for="(_, idx) in gameColumns"
            :key="idx"
            class="text-center text-[11px] font-bold tracking-[0.16em] text-neutral-500 uppercase"
            :class="{ 'text-neutral-900': isCurrentGameCol(idx) }"
          >
            G{{ idx + 1 }}
          </div>
        </div>

        <!-- Per-team rows -->
        <div
          v-for="side in ['a', 'b'] as const"
          :key="side"
          class="grid items-center gap-x-6 py-4 border-b border-neutral-200 last:border-b-0"
          :style="{ gridTemplateColumns: gridTemplate }"
        >
          <!-- Name + side caption -->
          <div class="min-w-0">
            <div class="flex items-center gap-3">
              <span
                class="size-2 rounded-sm shrink-0"
                :style="{ background: teamColor(side) }"
              />
              <span
                class="text-[28px] leading-tight tracking-tight uppercase truncate"
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
                        ? 'font-bold'
                        : p.isPartner
                          ? 'text-neutral-400 font-medium'
                          : 'text-neutral-900 font-semibold'
                    "
                    :style="p.isServer ? { color: teamColor(side) } : undefined"
                    >{{ p.name }}</span
                  >
                </template>
              </span>
              <span
                v-if="sideStatus(side)"
                class="text-[10px] font-bold tracking-[0.18em] uppercase shrink-0"
                :style="{ color: teamColor(side) }"
                >· {{ sideStatus(side) }}</span
              >
              <PenaltyCards :cards="cards(side)" size="sm" class="shrink-0" />
            </div>
          </div>
          <!-- Per-game scores -->
          <div v-for="(g, idx) in gameColumns" :key="idx" class="text-center">
            <span
              v-if="g"
              class="score text-[44px] leading-none tabular-nums"
              :class="
                isCurrentGameCol(idx) ? 'text-neutral-950' : 'text-neutral-700'
              "
              :style="
                isCurrentGameCol(idx) ? { color: teamColor(side) } : undefined
              "
              >{{ g[side] }}</span
            >
            <span v-else class="text-neutral-300 text-2xl">·</span>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div
        class="flex justify-between items-end text-[11px] text-neutral-500 tracking-[0.14em] font-semibold uppercase"
      >
        <span>
          {{
            config.gamesToWin === 1
              ? "Single game"
              : `Best of ${config.gamesToWin * 2 - 1}`
          }}
          · first to {{ config.pointsPerGame }}
        </span>
        <span>SCOREBOARD.APP</span>
      </div>
    </div>
  </div>
</template>
