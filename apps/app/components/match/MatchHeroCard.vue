<script setup lang="ts">
defineProps<{
  matchOver: boolean;
  displayName: string;
  statusLabel: string;
  teamNames: { a: string; b: string };
  totalSlots: number;
  scoreA: number;
  scoreB: number;
  gamesWonA: number;
  gamesWonB: number;
}>();
</script>

<template>
  <div
    class="rounded-lg p-4 border transition-colors"
    :class="
      matchOver
        ? 'bg-neutral-950 text-neutral-50 border-neutral-900'
        : 'bg-surface text-foreground border-border'
    "
  >
    <div class="flex justify-between items-center mb-3">
      <span class="inline-flex gap-1.5 items-center">
        <span
          v-if="matchOver"
          class="px-2 py-0.5 rounded text-[10px] font-bold tracking-[0.06em] uppercase bg-success-soft text-success"
        >
          Final
        </span>
        <span
          v-else
          class="inline-flex items-center gap-1 text-[10px] font-bold tracking-[0.1em] uppercase text-team-a"
        >
          <span class="size-1.5 rounded-full bg-team-a animate-pulse-soft" />
          LIVE
        </span>
        <span class="text-sm text-fg-muted">{{ displayName }}</span>
      </span>
      <span v-if="!matchOver" class="text-sm text-fg-subtle">
        {{ statusLabel }}
      </span>
    </div>
    <div class="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
      <div>
        <div
          class="text-sm mb-0.5"
          :class="matchOver ? 'text-neutral-400' : 'text-fg-muted'"
        >
          {{ teamNames.a }}
        </div>
        <div class="score text-[40px]">
          {{ matchOver ? gamesWonA : scoreA }}
        </div>
        <div class="flex gap-1 mt-1">
          <span
            v-for="i in totalSlots"
            :key="`a-${i}`"
            class="size-1.5 rounded-full"
            :style="{
              background:
                i <= gamesWonA
                  ? 'var(--color-team-a)'
                  : 'var(--color-border-strong)',
            }"
          />
        </div>
      </div>
      <span class="text-sm text-fg-subtle">vs</span>
      <div class="text-right">
        <div
          class="text-sm mb-0.5"
          :class="matchOver ? 'text-neutral-400' : 'text-fg-muted'"
        >
          {{ teamNames.b }}
        </div>
        <div class="score text-[40px]">
          {{ matchOver ? gamesWonB : scoreB }}
        </div>
        <div class="flex gap-1 mt-1 justify-end">
          <span
            v-for="i in totalSlots"
            :key="`b-${i}`"
            class="size-1.5 rounded-full"
            :style="{
              background:
                i <= gamesWonB
                  ? 'var(--color-team-b)'
                  : 'var(--color-border-strong)',
            }"
          />
        </div>
      </div>
    </div>
  </div>
</template>
