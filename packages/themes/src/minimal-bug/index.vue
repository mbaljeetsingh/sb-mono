<script setup lang="ts">
// Minimal Bug — tiny corner overlay (~190px wide). For streamers who don't
// want their video covered. No team names by default — just initials, current
// game score, and the game number. Sport icon for context.

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
const { cards, currentGame, isServingSide, isWinningSide } = useThemeState(
  toRef(props, "state"),
  toRef(props, "teamNames"),
);
const status = useStatusPill(toRef(props, "state"));
const endReason = computed(() => endReasonLabel(props.state.endReason));

// Initial of first non-empty word, or "?" if empty. "Alice / Aiden" → "A",
// "Bob Chen" → "B". Lowercase team names get capitalized.
const initial = (full: string) =>
  (full.split(/[\s/]+/).find(Boolean) ?? "?")[0]!.toUpperCase();

const initials = computed(() => ({
  a: initial(props.teamNames.a),
  b: initial(props.teamNames.b),
}));
</script>

<template>
  <div
    class="absolute top-9 right-9 rounded-md px-3 py-2 inline-flex items-center gap-3 border border-white/10 backdrop-blur-md bg-neutral-950/85 text-white font-sans"
  >
    <SportIcon
      :sport="config.sport"
      class="text-[14px] text-neutral-300 shrink-0"
    />
    <div
      v-for="side in ['a', 'b'] as const"
      :key="side"
      class="inline-flex items-center gap-1.5"
    >
      <span
        class="size-1.5 rounded-full transition-opacity"
        :class="isServingSide(side) ? 'animate-pulse-soft' : 'opacity-30'"
        :style="{ background: teamColor(side) }"
      />
      <span
        class="text-[11px] font-bold tracking-wide"
        :style="{ color: teamColor(side) }"
        >{{ initials[side] }}</span
      >
      <span
        class="score text-base text-neutral-50 min-w-[20px]"
        :class="side === 'a' ? 'text-right' : 'text-left'"
        >{{ currentGame[side] }}</span
      >
      <PenaltyCards :cards="cards(side)" size="xs" class="shrink-0" />
      <span
        v-if="side === 'a'"
        aria-hidden="true"
        class="w-px h-3 bg-white/15 ml-1"
      />
    </div>
    <!-- Status priority: match-over → pause icon → game number. Tiny
         corner bug, so pauses get an icon only; the colored pulse signals
         tone (amber = warn, white = accent) and the title attribute carries
         the full label for hover/screen readers. End-reason squeezes in
         as a 2-letter glyph after FINAL when applicable. -->
    <span
      v-if="state.matchOver"
      class="text-[9px] tracking-[0.14em] font-bold text-white/80 ml-1"
      :title="endReason ?? undefined"
    >
      FINAL · {{ isWinningSide("a") ? initials.a : initials.b }}
      <span v-if="endReason" class="text-white/50">
        ·
        {{
          props.state.endReason === "walkover"
            ? "WO"
            : props.state.endReason === "retirement"
              ? "RET"
              : "DEF"
        }}
      </span>
    </span>
    <span
      v-else-if="status"
      class="inline-flex items-center gap-1 text-[9px] font-bold tracking-wide ml-1"
      :class="status.tone === 'warn' ? 'text-amber-300' : 'text-white/80'"
      :title="`${status.label}${status.side ? ` · TEAM ${status.side}` : ''}`"
    >
      <span
        class="size-1.5 rounded-full bg-current animate-pulse-soft"
        aria-hidden="true"
      />
      {{
        status.tone === "warn" ? "⏸" : status.tone === "accent" ? "⚡" : "·"
      }}
    </span>
    <span
      v-else
      class="text-[9px] font-mono font-bold tracking-wide text-white/60 ml-1"
      >G{{ state.games.length }}</span
    >
  </div>
</template>
