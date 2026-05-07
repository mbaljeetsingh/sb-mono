<script setup lang="ts">
import { Minus, Plus } from "lucide-vue-next";
import type { SportPresetId } from "@sb/engine";
import { Button } from "@sb/layer-ui/components/ui/button";

const props = defineProps<{
  preset: SportPresetId;
  gamesToWin: number;
  options: {
    id: SportPresetId;
    displayName: string;
    config: {
      pointsPerGame: number;
      cap?: number | null;
      winBy: number;
      intervalAt?: number | null;
    };
  }[];
}>();

const emit = defineEmits<{
  (e: "update:preset", id: SportPresetId): void;
  (e: "update:gamesToWin", n: number): void;
  (e: "close"): void;
}>();

const setN = (n: number) => emit("update:gamesToWin", n);
</script>

<template>
  <div
    class="absolute inset-x-0 bottom-0 z-50 bg-surface text-foreground rounded-t-2xl px-4 pt-3 pb-6 shadow-[0_-12px_40px_rgba(0,0,0,0.18)]"
  >
    <div class="size-1 w-10 bg-border-strong rounded-full mx-auto mb-3" />
    <h2 class="text-lg font-semibold">Match format</h2>
    <p class="text-[11px] text-fg-subtle mb-4">
      Change anytime — engine recomputes from the event log.
    </p>

    <div
      class="text-[11px] font-bold tracking-wider uppercase text-fg-subtle mb-2"
    >
      Points per game
    </div>
    <div
      class="grid gap-2 mb-4"
      :class="options.length > 1 ? 'grid-cols-2' : 'grid-cols-1'"
    >
      <Button
        v-for="p in options"
        :key="p.id"
        variant="outline"
        class="h-11 flex-col gap-0 px-3 whitespace-normal"
        :class="
          props.preset === p.id
            ? 'bg-foreground text-background hover:bg-foreground/90 border-foreground'
            : ''
        "
        @click="emit('update:preset', p.id)"
      >
        <span class="text-sm font-semibold">
          {{ p.config.pointsPerGame }} · {{ p.displayName }}
        </span>
        <span class="block text-[10px] font-medium opacity-60 mt-0.5">
          {{ p.config.cap ? `cap ${p.config.cap}` : `win-by ${p.config.winBy}`
          }}{{
            p.config.intervalAt ? ` · interval ${p.config.intervalAt}` : ""
          }}
        </span>
      </Button>
    </div>

    <div
      class="text-[11px] font-bold tracking-wider uppercase text-fg-subtle mb-2"
    >
      Match length
    </div>
    <div class="grid grid-cols-2 gap-2 mb-2">
      <Button
        variant="outline"
        class="h-11 font-semibold"
        :class="
          props.gamesToWin === 1
            ? 'bg-foreground text-background hover:bg-foreground/90 border-foreground'
            : ''
        "
        @click="setN(1)"
      >
        Single match
      </Button>
      <Button
        variant="outline"
        class="h-11 font-semibold"
        :class="
          props.gamesToWin >= 2
            ? 'bg-foreground text-background hover:bg-foreground/90 border-foreground'
            : ''
        "
        @click="setN(props.gamesToWin >= 2 ? props.gamesToWin : 2)"
      >
        Best of {{ props.gamesToWin >= 2 ? props.gamesToWin * 2 - 1 : 3 }}
      </Button>
    </div>
    <div v-if="props.gamesToWin >= 2" class="flex items-center gap-3 mb-2 px-1">
      <Button
        variant="outline"
        size="icon"
        aria-label="Decrease best-of"
        :disabled="props.gamesToWin <= 2"
        @click="setN(Math.max(2, props.gamesToWin - 1))"
      >
        <Minus class="size-4" />
      </Button>
      <div class="flex-1 text-center">
        <span class="text-base font-semibold text-foreground">
          Best of {{ props.gamesToWin * 2 - 1 }}
        </span>
        <span class="block text-[11px] text-fg-subtle mt-0.5">
          first to {{ props.gamesToWin }} games
        </span>
      </div>
      <Button
        variant="outline"
        size="icon"
        aria-label="Increase best-of"
        :disabled="props.gamesToWin >= 6"
        @click="setN(Math.min(6, props.gamesToWin + 1))"
      >
        <Plus class="size-4" />
      </Button>
    </div>

    <Button variant="ghost" class="w-full mt-3" @click="emit('close')">
      Done
    </Button>
  </div>
</template>
