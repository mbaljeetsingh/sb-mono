<script setup lang="ts">
// Minimal Typographic — light, editorial scoreboard. Cream paper, generous
// whitespace, big condensed numerals. Built for a clubhouse TV / lounge
// display where the vibe is "tournament program page" rather than broadcast.
//
// Calm by design: no LIVE pulse, no animations. Status (GAME WON / WINNER)
// lives as a small caption under the score; SERVE shows as a subtle dot.
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
  isServingSide,
  isLastGameWinner,
  isMatchWinner,
} = useThemeState(toRef(props, "state"), toRef(props, "teamNames"));
const meta = useMetaLine(toRef(props, "meta"), toRef(props, "config"));
const status = useStatusPill(toRef(props, "state"));
const endReason = computed(() => endReasonLabel(props.state.endReason));

const playersOf = (side: "a" | "b") =>
  side === "a" ? playersA.value : playersB.value;

const formatLine = computed(() => {
  const c = props.config;
  const heading =
    c.gamesToWin === 1 ? "Single game" : `Best of ${c.gamesToWin * 2 - 1}`;
  return `${heading} · first to ${c.pointsPerGame}`;
});

const allGamesLine = computed(() => {
  // Only show *completed* games — the in-progress game is already on the
  // big numerals above. In BO1 (or before the first game finishes) there's
  // nothing to list, so fall back to the format caption.
  const s = props.state;
  const finished = s.games.length - (s.matchOver ? 0 : 1);
  const completed = s.games.slice(0, Math.max(finished, 0));
  if (!completed.length) return formatLine.value;
  return completed.map((g) => `${g.a}–${g.b}`).join("  ");
});

const sideLabel = (side: "a" | "b") => {
  if (isMatchWinner(side)) return "WINNER";
  if (isLastGameWinner(side)) return "GAME WON";
  if (isServingSide(side)) return "SERVING";
  return null;
};
</script>

<template>
  <div class="absolute inset-0 bg-stone-50 text-neutral-950 overflow-hidden">
    <div
      class="absolute inset-0 flex flex-col px-[clamp(16px,4vw,60px)] py-[clamp(12px,3vh,40px)]"
    >
      <!-- Top label -->
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
        <span
          v-else-if="status"
          class="shrink-0"
          :class="
            status.tone === 'warn'
              ? 'text-amber-700'
              : status.tone === 'accent'
                ? 'text-neutral-900'
                : 'text-neutral-500'
          "
        >
          {{ status.label }}
          <span v-if="status.side" class="text-neutral-500">
            · TEAM {{ status.side }}
          </span>
        </span>
        <span v-else class="shrink-0">GAME {{ state.games.length }}</span>
      </div>

      <!-- Center grid: side-by-side in landscape, stacked in portrait. -->
      <div
        class="flex-1 min-h-0 grid items-center gap-[clamp(8px,3vmin,60px)] landscape:grid-cols-[1fr_auto_1fr] portrait:grid-rows-[1fr_auto_1fr] portrait:justify-items-center"
      >
        <div
          v-for="side in ['a', 'b'] as const"
          :key="side"
          :class="[
            'min-w-0 min-h-0 portrait:text-center',
            side === 'a' ? 'order-1' : 'landscape:text-right order-3',
          ]"
        >
          <div
            class="text-[clamp(11px,1.6vmin,14px)] font-semibold text-neutral-600 tracking-wide mb-1 uppercase truncate"
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
          <div
            class="score leading-[0.85] text-[clamp(96px,min(34vh,40vw),260px)] portrait:text-[clamp(120px,min(34vh,52vw),320px)]"
          >
            {{ currentGame[side] }}
          </div>
          <!-- Side-status caption (SERVING / GAME WON / WINNER) + cards -->
          <div
            v-if="
              sideLabel(side) ||
              cards(side).yellow ||
              cards(side).red ||
              cards(side).black
            "
            :class="[
              'inline-flex items-center gap-2 mt-2 text-[clamp(9px,1.2vmin,11px)] font-bold tracking-[0.18em] uppercase',
              side === 'b' ? 'landscape:flex-row-reverse' : '',
            ]"
            :style="{ color: teamColor(side) }"
          >
            <span
              v-if="isServingSide(side)"
              class="size-1.5 rounded-full"
              :style="{ background: teamColor(side) }"
            />
            <span v-if="sideLabel(side)">{{ sideLabel(side) }}</span>
            <PenaltyCards :cards="cards(side)" size="sm" />
          </div>
        </div>

        <!-- Divider: em-dash between halves in landscape; a thin rule between
             stacked blocks in portrait. -->
        <div
          class="order-2 text-[clamp(16px,3vmin,32px)] text-neutral-400 font-normal text-center portrait:flex portrait:items-center portrait:justify-center portrait:w-full"
        >
          <span class="portrait:hidden">—</span>
          <span
            class="hidden portrait:block h-px w-1/3 bg-neutral-300"
            aria-hidden="true"
          ></span>
        </div>
      </div>

      <!-- Bottom row -->
      <div
        class="flex justify-between items-end gap-3 text-[clamp(9px,1.2vmin,12px)] text-neutral-500 tracking-[0.1em] font-semibold uppercase shrink-0"
      >
        <span class="truncate">{{ allGamesLine || "&nbsp;" }}</span>
        <span class="shrink-0">SCOREBOARD APP</span>
      </div>
    </div>
  </div>
</template>
