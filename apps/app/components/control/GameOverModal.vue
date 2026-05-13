<script setup lang="ts">
// Between-games dialog. Shows up after a game ends but before the next one
// starts. Mirrors MatchOverModal's pattern + button affordances so the
// operator gets the same visual rhythm at every game boundary.
//
// Includes an optional "Swap ends" action — BWF Law 9.4 mandates teams
// change ends between games. Visual-only swap; server identity stays with
// the engine. Operator can ignore it (common in club play).

import { ArrowUpDown } from "lucide-vue-next";
import { Button } from "@sb/layer-ui/components/ui/button";

defineProps<{
  gameNumber: number;
  winnerName: string;
  gameScore: { winner: number; loser: number };
  matchScore: { a: number; b: number };
  nextGameNumber: number;
  sidesSwapped: boolean;
}>();

defineEmits<{
  (e: "start-next"): void;
  (e: "swap-sides"): void;
}>();
</script>

<template>
  <div
    class="absolute inset-0 z-50 flex items-center justify-center bg-overlay"
  >
    <div
      class="w-[min(90%,360px)] bg-surface text-foreground rounded-2xl p-8 shadow-2xl text-center"
    >
      <div
        class="text-[11px] font-bold tracking-[0.08em] uppercase text-success mb-2"
      >
        ✓ Game {{ gameNumber }} complete
      </div>
      <div class="text-[24px] font-semibold mb-4">{{ winnerName }} wins</div>
      <div
        class="score text-[72px] font-bold flex items-baseline justify-center gap-2 mb-4"
      >
        <span>{{ gameScore.winner }}</span>
        <span class="opacity-40 text-[48px]">–</span>
        <span class="opacity-60">{{ gameScore.loser }}</span>
      </div>
      <div class="text-sm text-fg-muted mb-6">
        Match standing
        <span class="font-semibold text-foreground"
          >{{ matchScore.a }}–{{ matchScore.b }}</span
        >
      </div>
      <Button
        variant="outline"
        class="h-10 w-full font-medium mb-2"
        @click="$emit('swap-sides')"
      >
        <ArrowUpDown class="size-4" />
        Swap ends
        <span v-if="sidesSwapped" class="text-fg-subtle text-[11px] ml-1">
          · swapped
        </span>
      </Button>
      <Button
        size="lg"
        class="h-12 w-full font-semibold"
        @click="$emit('start-next')"
      >
        Start Game {{ nextGameNumber }}
      </Button>
    </div>
  </div>
</template>
