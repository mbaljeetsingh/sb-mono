<script setup lang="ts">
// Minimal Typographic — light, editorial scoreboard. Cream paper, generous
// whitespace, big condensed numerals. Built for a clubhouse TV / lounge
// display where the vibe is "tournament program page" rather than broadcast.
//
// Calm by design: no LIVE pulse, no animations. Status (GAME WON / WINNER)
// lives as a small caption under the score; SERVE shows as a subtle dot.

import { computed, toRef } from "vue";
import type { ThemeProps } from "../index";
import SportIcon from "../sport-icon.vue";
import { teamColor, useMetaLine, useThemeState } from "../use-theme-state";

const props = defineProps<ThemeProps>();
const {
  playersA,
  playersB,
  currentGame,
  isServingSide,
  isLastGameWinner,
  isMatchWinner,
} = useThemeState(toRef(props, "state"), toRef(props, "teamNames"));
const meta = useMetaLine(toRef(props, "meta"));

const playersOf = (side: "a" | "b") =>
  side === "a" ? playersA.value : playersB.value;

const allGamesLine = computed(() =>
  props.state.games.map((g) => `${g.a}–${g.b}`).join("  "),
);

const sideLabel = (side: "a" | "b") => {
  if (isMatchWinner(side)) return "WINNER";
  if (isLastGameWinner(side)) return "GAME WON";
  if (isServingSide(side)) return "SERVING";
  return null;
};
</script>

<template>
  <div class="absolute inset-0 bg-stone-50 text-neutral-950 overflow-hidden">
    <div class="absolute inset-0 px-15 py-10 flex flex-col">
      <!-- Top label -->
      <div
        class="flex items-start justify-between text-[11px] font-bold tracking-[0.16em] text-neutral-600 uppercase mb-auto"
      >
        <span class="inline-flex items-center gap-3">
          <SportIcon
            :sport="config.sport"
            class="text-[18px] text-neutral-700"
          />
          {{ meta }}
        </span>
        <span v-if="state.matchOver" class="text-neutral-900">FINAL</span>
        <span v-else>GAME {{ state.games.length }}</span>
      </div>

      <!-- Center grid -->
      <div class="grid grid-cols-[1fr_auto_1fr] gap-15 items-center">
        <div
          v-for="side in ['a', 'b'] as const"
          :key="side"
          :class="[side === 'b' ? 'text-right order-3' : '']"
        >
          <div
            class="text-sm font-semibold text-neutral-600 tracking-wide mb-1 uppercase"
          >
            <template v-for="(p, idx) in playersOf(side)" :key="idx">
              <span v-if="idx > 0" class="mx-1.5 text-neutral-400 font-normal"
                >/</span
              >
              <span
                :class="
                  p.isServer
                    ? 'font-bold text-neutral-950'
                    : p.isPartner
                      ? 'text-neutral-400 font-medium'
                      : 'text-neutral-700 font-semibold'
                "
                >{{ p.name }}</span
              >
            </template>
          </div>
          <div class="score text-[220px] leading-[0.85]">
            {{ currentGame[side] }}
          </div>
          <!-- Side-status caption (SERVING / GAME WON / WINNER) -->
          <div
            v-if="sideLabel(side)"
            :class="[
              'inline-flex items-center gap-1.5 mt-3 text-[11px] font-bold tracking-[0.18em] uppercase',
              side === 'b' ? 'flex-row-reverse' : '',
            ]"
            :style="{ color: teamColor(side) }"
          >
            <span
              v-if="isServingSide(side)"
              class="size-1.5 rounded-full"
              :style="{ background: teamColor(side) }"
            />
            {{ sideLabel(side) }}
          </div>
        </div>

        <div class="text-3xl text-neutral-400 font-normal order-2">—</div>
      </div>

      <!-- Bottom row -->
      <div
        class="mt-auto flex justify-between items-end text-xs text-neutral-500 tracking-[0.1em] font-semibold uppercase"
      >
        <span>{{ allGamesLine || "—" }}</span>
        <span>SCOREBOARD.APP</span>
      </div>
    </div>
  </div>
</template>
