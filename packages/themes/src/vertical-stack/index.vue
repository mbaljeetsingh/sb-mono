<script setup lang="ts">
// Vertical Stack — overlay sized for portrait streams (TikTok, Reels, IG Live).
// Pinned to the bottom-center, ~360px wide stack of two team blocks. Designed
// to hug the bottom safe area without covering player faces in the middle of
// the frame.

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
  <div
    class="absolute bottom-9 left-1/2 -translate-x-1/2 w-[360px] rounded-2xl overflow-hidden border border-white/10 bg-neutral-950/92 backdrop-blur-md text-white font-sans shadow-[0_20px_60px_-20px_rgba(0,0,0,0.7)]"
  >
    <!-- Top meta strip -->
    <div
      class="px-4 py-2 flex items-center justify-between border-b border-white/5 text-[10px] font-semibold tracking-[0.14em] uppercase text-neutral-400"
    >
      <!-- Meta is the flex item that gives way; live/game stays full. -->
      <span class="inline-flex items-center gap-1.5 min-w-0 flex-1">
        <SportIcon :sport="config.sport" class="text-[12px] shrink-0" />
        <span class="truncate">{{ meta || "&nbsp;" }}</span>
      </span>
      <!-- Status priority: match-over wins, then any active pause/GP/MP
           via useStatusPill, falling back to the LIVE pulse. Pause states
           (timeout, suspended) inherit warn tone so a portrait stream
           viewer sees the interruption without checking the broadcast. -->
      <span
        v-if="state.matchOver"
        class="inline-flex items-center gap-1.5 text-white/90 tracking-[0.16em] shrink-0 ml-2"
      >
        FINAL
        <span v-if="endReason" class="text-[9px] text-white/60">
          · {{ endReason }}
        </span>
      </span>
      <span
        v-else-if="status"
        class="inline-flex items-center gap-1.5 shrink-0 ml-2"
        :class="
          status.tone === 'warn'
            ? 'text-amber-300'
            : status.tone === 'accent'
              ? 'text-white'
              : 'text-white/70'
        "
      >
        <span class="size-1.5 rounded-full bg-current animate-pulse-soft" />
        {{ status.label }}
        <span v-if="status.side" class="text-white/60"
          >· {{ status.side }}</span
        >
      </span>
      <span
        v-else-if="isLive"
        class="inline-flex items-center gap-1.5 text-white/80 shrink-0 ml-2"
      >
        <span class="size-1.5 rounded-full bg-white animate-pulse-soft" />
        LIVE
        <span v-if="config.gamesToWin > 1" class="text-white/50 font-semibold"
          >· G{{ state.games.length }}</span
        >
      </span>
    </div>

    <!-- Stacked team blocks -->
    <div class="divide-y divide-white/5">
      <div
        v-for="side in ['a', 'b'] as const"
        :key="side"
        class="grid grid-cols-[5px_1fr_auto_auto] gap-3 items-center pr-4"
        :style="
          isServingSide(side)
            ? {
                background: `linear-gradient(90deg, color-mix(in srgb, ${teamColor(side)} 18%, transparent), transparent 80%)`,
              }
            : undefined
        "
      >
        <div
          class="h-full self-stretch"
          :style="{ background: teamColor(side) }"
        />
        <div class="py-3 min-w-0">
          <div class="flex items-center gap-1.5 min-w-0">
            <span class="truncate text-[14px] tracking-tight">
              <template v-for="(p, idx) in playersOf(side)" :key="idx">
                <span v-if="idx > 0" class="mx-1 text-white/35">/</span>
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
              v-if="isMatchWinner(side)"
              class="shrink-0 text-[8px] font-bold tracking-[0.16em] text-white px-1 py-0.5 rounded-sm"
              :style="{ background: teamColor(side) }"
              >WINNER</span
            >
            <span
              v-else-if="isLastGameWinner(side)"
              class="shrink-0 text-[8px] font-bold tracking-[0.14em] text-white/85 px-1 py-0.5 rounded-sm border"
              :style="{
                borderColor: teamColor(side),
                background: `color-mix(in srgb, ${teamColor(side)} 18%, transparent)`,
              }"
              >GAME WON</span
            >
            <span
              v-else-if="isServingSide(side)"
              class="shrink-0 inline-flex items-center gap-1 text-[8px] font-bold tracking-[0.14em] text-white px-1 py-0.5 rounded-sm"
              :style="{ background: teamColor(side) }"
            >
              <span class="size-1 rounded-full bg-white animate-pulse-soft" />
              SERVE
            </span>
            <PenaltyCards :cards="cards(side)" size="xs" class="shrink-0" />
          </div>
        </div>
        <div
          v-if="priorGames.length"
          class="score text-sm text-white/45 tabular-nums tracking-wide flex items-center gap-1.5"
        >
          <span v-for="(g, i) in priorGames" :key="i">{{ g[side] }}</span>
        </div>
        <div
          class="score text-[36px] leading-none text-white tabular-nums min-w-[44px] text-right"
        >
          {{ currentGame[side] }}
        </div>
      </div>
    </div>
  </div>
</template>
