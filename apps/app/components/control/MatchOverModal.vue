<script setup lang="ts">
import { Button } from "@sb/layer-ui/components/ui/button";

defineProps<{
  endReason: "normal" | "walkover" | "retirement" | "default" | undefined;
  winnerName: string;
  gamesWon: { a: number; b: number };
}>();

defineEmits<{
  (e: "new-match"): void;
  (e: "back"): void;
}>();

const labels = {
  walkover: "WALKOVER",
  retirement: "RETIREMENT",
  default: "DEFAULT",
  normal: "MATCH COMPLETE",
} as const;
</script>

<template>
  <div
    class="absolute inset-0 z-50 flex items-center justify-center bg-overlay"
  >
    <div
      class="w-[min(90%,360px)] bg-surface text-foreground rounded-2xl p-8 shadow-2xl text-center"
    >
      <div
        class="text-[11px] font-bold tracking-[0.08em] uppercase text-brand mb-2"
      >
        {{ labels[endReason ?? "normal"] }}
      </div>
      <div class="text-[28px] font-semibold mb-4">{{ winnerName }} wins</div>
      <div
        v-if="endReason === 'normal'"
        class="score text-[90px] font-bold flex items-baseline justify-center gap-2 mb-6"
      >
        <span>{{ gamesWon.a }}</span>
        <span class="opacity-40 text-[60px]">–</span>
        <span>{{ gamesWon.b }}</span>
      </div>
      <div class="flex flex-col gap-2">
        <Button
          size="lg"
          class="h-12 w-full font-semibold"
          @click="$emit('new-match')"
        >
          New match
        </Button>
        <Button variant="ghost" class="w-full" @click="$emit('back')">
          Back to dashboard
        </Button>
      </div>
    </div>
  </div>
</template>
