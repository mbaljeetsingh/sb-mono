<script setup lang="ts">
// Minimal Bug — the smallest useful overlay: a single ~190px row. For streamers
// who don't want their video covered at all. Initials, live points, nothing
// else. `score-bug` is the step up when you want game history too.
//
// The sport icon that used to lead this row is gone: it cost ~22px of a 190px
// bug to say something the viewer already knows from the footage. Everything
// here has to beat that bar, which is why there are no names, no event line and
// no status wording.

import { computed, toRef } from 'vue';
import type { ThemeProps } from '../index';
import PenaltyCards from '../penalty-cards.vue';
import ServeMarker from '../serve-marker.vue';
import {
  endReasonLabel,
  teamColor,
  useStatusPill,
  useThemeState,
} from '../use-theme-state';

const props = defineProps<ThemeProps>();
const { cards, currentGame, isServingSide, isWinningSide, playersA, playersB } =
  useThemeState(
    toRef(props, 'state'),
    toRef(props, 'teamNames'),
    toRef(props, 'players')
  );
const status = useStatusPill(toRef(props, 'state'));
const endReason = computed(() => endReasonLabel(props.state.endReason));

// Initial of first non-empty word, or "?" if empty. "Alice / Aiden" → "A",
// "Bob Chen" → "B". Lowercase team names get capitalized.
const initial = (full: string) =>
  (full.split(/[\s/]+/).find(Boolean) ?? '?')[0]!.toUpperCase();

// Taken from the resolved partner list, not the raw joined team name. On a
// doubles match saved before the partner-swap fix, `team_name_a` can still
// list the pair in the pre-swap order, so splitting it here would badge the
// wrong player — the same staleness `useThemeState` already resolves for the
// SERVE highlight.
const initials = computed(() => ({
  a: initial(playersA.value[0]?.name || props.teamNames.a),
  b: initial(playersB.value[0]?.name || props.teamNames.b),
}));
</script>

<template>
  <div
    class="absolute top-10 right-10 rounded-[5px] px-3 py-2 inline-flex items-center gap-2.5 ring-1 ring-white/[0.08] bg-[#0a0d12] text-white font-sans"
  >
    <div
      v-for="side in ['a', 'b'] as const"
      :key="side"
      class="inline-flex items-center gap-2"
    >
      <!-- Serve marker holds its slot when idle, so the two halves stay aligned
           and nothing shifts on a change of service. -->
      <ServeMarker
        v-if="isServingSide(side)"
        :color="teamColor(side)"
        size="sm"
      />
      <span
        v-else
        class="inline-block size-[8px] shrink-0 rounded-full opacity-25"
        :style="{ background: teamColor(side) }"
        aria-hidden="true"
      />
      <span
        class="text-[14px] font-bold tracking-wide w-[12px] text-center"
        :style="{ color: teamColor(side) }"
        >{{ initials[side] }}</span
      >
      <span
        class="score text-[19px] text-neutral-50 w-[28px]"
        :class="side === 'a' ? 'text-right' : 'text-left'"
        >{{ currentGame[side] }}</span
      >
      <PenaltyCards :cards="cards(side)" size="xs" class="shrink-0" />
      <span
        v-if="side === 'a'"
        aria-hidden="true"
        class="w-px h-4 bg-white/15"
      />
    </div>
    <!-- Status priority: match-over → pause icon → game number. Tiny
         corner bug, so pauses get an icon only; the colored pulse signals
         tone (amber = warn, white = accent) and the title attribute carries
         the full label for hover/screen readers. End-reason squeezes in
         as a 2-letter glyph after FINAL when applicable. -->
    <span
      v-if="state.matchOver"
      class="text-[11px] tracking-[0.14em] font-bold text-white/80 ml-1"
      :title="endReason ?? undefined"
    >
      FINAL · {{ isWinningSide('a') ? initials.a : initials.b }}
      <span v-if="endReason" class="text-white/50">
        ·
        {{
          props.state.endReason === 'walkover'
            ? 'WO'
            : props.state.endReason === 'retirement'
              ? 'RET'
              : 'DEF'
        }}
      </span>
    </span>
    <span
      v-else-if="status"
      class="inline-flex items-center gap-1 text-[11px] font-bold tracking-wide ml-1"
      :class="status.tone === 'warn' ? 'text-amber-300' : 'text-white/80'"
      :title="`${status.label}${status.side ? ` · TEAM ${status.side}` : ''}`"
    >
      <span
        class="size-1.5 rounded-full bg-current animate-pulse-soft"
        aria-hidden="true"
      />
      {{ status.tone === 'warn' ? '⏸' : status.tone === 'accent' ? '⚡' : '·' }}
    </span>
    <span
      v-else
      class="text-[11px] font-mono font-bold tracking-wide text-white/60 ml-1"
      >G{{ state.games.length }}</span
    >
  </div>
</template>
