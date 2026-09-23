<script setup lang="ts">
import {
  type RacquetConfig,
  type SportPresetId,
  formatDetail,
  formatHeadline,
  unitNoun,
} from '@sb/engine';
import { Button } from '@sb/layer-ui/components/ui/button';
import { Label } from '@sb/layer-ui/components/ui/label';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@sb/layer-ui/components/ui/toggle-group';
import { Minus, Plus } from 'lucide-vue-next';
import { computed } from 'vue';

const props = defineProps<{
  preset: SportPresetId;
  gamesToWin: number;
  options: {
    id: SportPresetId;
    displayName: string;
    config: RacquetConfig;
  }[];
}>();

// "Games" is the wrong noun for tennis and padel, where a games-to-win of 2
// means two SETS — and the sheet is where an operator goes to check exactly
// that. Read off the active preset, so it tracks the toggle above it.
const noun = computed(() => {
  const active = props.options.find((o) => o.id === props.preset);
  return active ? unitNoun(active.config) : 'game';
});

const emit = defineEmits<{
  (e: 'update:preset', id: SportPresetId): void;
  (e: 'update:gamesToWin', n: number): void;
  (e: 'close'): void;
}>();

const setN = (n: number) => emit('update:gamesToWin', n);
const matchLength = (v: 'single' | 'best-of') =>
  setN(v === 'single' ? 1 : Math.max(2, props.gamesToWin));
</script>

<template>
  <div
    class="absolute inset-x-0 bottom-0 z-50 mx-auto w-full max-w-2xl bg-surface text-foreground rounded-t-2xl px-4 pt-3 pb-[max(1.5rem,env(safe-area-inset-bottom))] shadow-[0_-12px_40px_rgba(0,0,0,0.18)]"
  >
    <div class="size-1 w-10 bg-border-strong rounded-full mx-auto mb-3" />
    <h2 class="text-lg font-semibold">Match format</h2>
    <p class="text-[11px] text-fg-subtle mb-4">
      Change anytime — engine recomputes from the event log.
    </p>

    <section v-if="options.length > 1" class="mb-4">
      <Label
        class="text-[11px] font-semibold tracking-[0.06em] uppercase text-fg-subtle mb-2 block"
      >
        Scoring
      </Label>
      <ToggleGroup
        type="single"
        :model-value="props.preset"
        variant="outline"
        class="w-full"
        :class="options.length > 2 ? 'grid grid-cols-2 gap-2' : ''"
        @update:model-value="
          (v) => v && emit('update:preset', v as SportPresetId)
        "
      >
        <ToggleGroupItem
          v-for="p in options"
          :key="p.id"
          :value="p.id"
          class="h-auto min-h-11 flex-1 flex-col gap-0 whitespace-normal py-1.5"
        >
          <span class="text-sm font-semibold">
            {{ formatHeadline(p.config) }}
          </span>
          <span class="block text-[10px] font-medium opacity-60 mt-0.5">
            {{ formatDetail(p.config) }}
          </span>
        </ToggleGroupItem>
      </ToggleGroup>
    </section>

    <section>
      <Label
        class="text-[11px] font-semibold tracking-[0.06em] uppercase text-fg-subtle mb-2 block"
      >
        Match length
      </Label>
      <ToggleGroup
        type="single"
        :model-value="props.gamesToWin === 1 ? 'single' : 'best-of'"
        variant="outline"
        class="w-full mb-2"
        @update:model-value="(v) => v && matchLength(v as 'single' | 'best-of')"
      >
        <ToggleGroupItem value="single" class="flex-1 h-11">
          Single {{ noun }}
        </ToggleGroupItem>
        <ToggleGroupItem value="best-of" class="flex-1 h-11">
          Best of {{ props.gamesToWin >= 2 ? props.gamesToWin * 2 - 1 : 3 }}
        </ToggleGroupItem>
      </ToggleGroup>
      <div
        v-if="props.gamesToWin >= 2"
        class="flex items-center gap-3 px-1 mb-2"
      >
        <Button
          type="button"
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
            first to {{ props.gamesToWin }} {{ noun }}s
          </span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Increase best-of"
          :disabled="props.gamesToWin >= 6"
          @click="setN(Math.min(6, props.gamesToWin + 1))"
        >
          <Plus class="size-4" />
        </Button>
      </div>
    </section>

    <Button variant="ghost" class="w-full mt-3" @click="emit('close')">
      Done
    </Button>
  </div>
</template>
