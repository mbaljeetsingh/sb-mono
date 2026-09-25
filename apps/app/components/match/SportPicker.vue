<script setup lang="ts">
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@sb/layer-ui/components/ui/toggle-group';
import SportGlyph from '~/components/common/SportGlyph.vue';
import { SPORTS, type SportId } from '~/lib/sports';

// Re-exported so existing importers (`import SportPicker, { type SportId }`)
// keep working; the union itself now lives in ~/lib/sports alongside the
// display metadata and the preset → sport mapping.
export type { SportId };

const props = defineProps<{ modelValue: SportId }>();
defineEmits<(e: 'update:modelValue', v: SportId) => void>();

const sports = SPORTS.filter((s) => s.enabled);

// Per-sport accent (the --court-* surfaces are dark mats — unreadable as a
// foreground), so the same colour identifies a sport everywhere it appears.
const tint: Record<SportId, string> = {
  badminton: 'text-court-badminton-accent',
  'table-tennis': 'text-court-tabletennis-accent',
  tennis: 'text-court-tennis-accent',
  pickleball: 'text-court-pickleball-accent',
  padel: 'text-court-padel-accent',
  squash: 'text-court-squash-accent',
};
</script>

<template>
  <!-- Compact tiles, all six visible at once: sport is the first decision on
       /new, so it must never hide behind a disclosure or a scroll. Three
       columns fit a 320px phone; the grid overrides ToggleGroup's default
       flex ribbon. -->
  <ToggleGroup
    type="single"
    :model-value="props.modelValue"
    variant="outline"
    :spacing="2"
    class="grid w-full grid-cols-3"
    aria-label="Sport"
    @update:model-value="(v) => v && $emit('update:modelValue', v as SportId)"
  >
    <ToggleGroupItem
      v-for="s in sports"
      :key="s.id"
      :value="s.id"
      class="h-auto min-h-16 flex-col items-start justify-center gap-1.5 px-3 py-2.5 text-left whitespace-normal"
    >
      <SportGlyph :sport="s.id" class="size-6 shrink-0" :class="tint[s.id]" />
      <span class="text-[13px] font-semibold leading-tight">{{ s.label }}</span>
    </ToggleGroupItem>
  </ToggleGroup>
</template>
