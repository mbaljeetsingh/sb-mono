<script setup lang="ts">
// Broadcast Classic — default overlay. Modern dark-glass lower-third.
// Brand-neutral by design; tournament-branded variants ship as paid packs.
//
// Surfaces: name (with active-server highlight in doubles), games-won pips,
// prior-game scores, current game in big numerals, serve dot, penalty card
// glyphs, and a context status pill (GP / MP / timeout / interval / suspension).

import { toRef } from "vue";
import type { ThemeProps } from "../index";
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
  currentGame,
  priorGames,
  isServingSide,
  isLastGameWinner,
  isMatchWinner,
} = useThemeState(toRef(props, "state"), toRef(props, "teamNames"));
const status = useStatusPill(toRef(props, "state"));
const meta = useMetaLine(toRef(props, "meta"));

const playersOf = (side: "a" | "b") =>
  side === "a" ? playersA.value : playersB.value;
</script>

<template>
  <div
    class="absolute left-9 bottom-9 w-[640px] rounded-xl overflow-hidden border border-white/10 shadow-[0_24px_60px_-20px_rgba(0,0,0,0.7)] bg-neutral-950/90 backdrop-blur-md font-sans"
  >
    <!-- Meta strip -->
    <div
      class="px-5 py-2.5 flex items-center justify-between border-b border-white/5"
    >
      <span
        class="inline-flex items-center gap-2 text-[10px] font-semibold tracking-[0.14em] uppercase text-neutral-400 min-w-0 flex-1"
      >
        <SportIcon :sport="config.sport" class="text-[14px] shrink-0" />
        <span class="truncate">{{ meta || "&nbsp;" }}</span>
      </span>
      <span
        v-if="state.matchOver"
        class="text-[10px] font-bold tracking-[0.14em] text-white/90 shrink-0 ml-2"
      >
        FINAL
      </span>
      <span
        v-else
        class="inline-flex items-center gap-1.5 text-[10px] font-bold tracking-[0.14em] text-white/80 shrink-0 ml-2"
      >
        <span class="size-1.5 rounded-full bg-white animate-pulse-soft" />
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
        class="grid grid-cols-[4px_1fr_auto_auto] gap-4 items-center pr-5 transition-colors duration-200"
        :style="
          isServingSide(side)
            ? {
                background: `linear-gradient(90deg, color-mix(in srgb, ${teamColor(side)} 14%, transparent), transparent 70%)`,
              }
            : undefined
        "
      >
        <!-- Team color bar -->
        <div
          class="h-full self-stretch"
          :style="{ background: teamColor(side) }"
        />

        <!-- Name + cards + games-won pips -->
        <div class="py-3 min-w-0">
          <div class="flex items-center gap-2 min-w-0">
            <span
              class="truncate text-[15px] font-semibold tracking-tight text-white"
            >
              <template v-for="(p, idx) in playersOf(side)" :key="idx">
                <span v-if="idx > 0" class="mx-1 text-white/40 font-normal"
                  >/</span
                >
                <span
                  :class="
                    p.isServer
                      ? 'font-bold'
                      : p.isPartner
                        ? 'text-white/55 font-medium'
                        : 'text-white font-semibold'
                  "
                  :style="p.isServer ? { color: teamColor(side) } : undefined"
                  >{{ p.name }}</span
                >
              </template>
            </span>
            <span
              v-if="isServingSide(side)"
              class="shrink-0 inline-flex items-center gap-1 text-[9px] font-bold tracking-[0.14em] text-white px-1.5 py-0.5 rounded-sm"
              :style="{ background: teamColor(side) }"
            >
              <span class="size-1 rounded-full bg-white animate-pulse-soft" />
              SERVE
            </span>
            <span
              v-else-if="isMatchWinner(side)"
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
            <!-- Penalty cards -->
            <span class="inline-flex items-center gap-0.5">
              <span
                v-for="i in cards(side).yellow"
                :key="`y${i}`"
                class="inline-block w-[7px] h-[10px] rounded-[1px] bg-yellow-400 ring-1 ring-yellow-600/60"
                title="Yellow card"
              />
              <span
                v-for="i in cards(side).red"
                :key="`r${i}`"
                class="inline-block w-[7px] h-[10px] rounded-[1px] bg-red-600 ring-1 ring-red-900/60"
                title="Red card"
              />
            </span>
          </div>
        </div>

        <!-- Prior games (small column) -->
        <div
          class="flex items-center gap-2 score text-base text-neutral-500 tabular-nums"
        >
          <span v-for="(g, i) in priorGames" :key="i">{{ g[side] }}</span>
        </div>

        <!-- Current game (big) + serve dot -->
        <div class="flex items-center gap-2">
          <span
            v-if="isServingSide(side)"
            class="size-2 rounded-full animate-pulse-soft"
            :style="{ background: teamColor(side) }"
          />
          <span
            v-else
            class="size-2 rounded-full bg-transparent"
            aria-hidden="true"
          />
          <span
            class="score text-[34px] leading-none text-white min-w-[44px] text-right"
          >
            {{ currentGame[side] }}
          </span>
        </div>
      </div>
    </div>

    <!-- Status pill -->
    <div
      v-if="status"
      class="px-5 py-1.5 border-t border-white/5 flex items-center gap-2"
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
      <span class="text-[10px] font-bold tracking-[0.18em] text-white">
        {{ status.label }}
      </span>
      <span
        v-if="status.side"
        class="text-[10px] font-semibold tracking-[0.14em] text-white/75"
      >
        · {{ status.side === "A" ? teamNames.a : teamNames.b }}
      </span>
    </div>
  </div>
</template>
