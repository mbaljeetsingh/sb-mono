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

// Sport list + enabled flags come from ~/lib/sports.
const sports = SPORTS;

// Per-sport accent (the --court-* surfaces are dark mats — unreadable as a
// foreground), so the same colour identifies a sport everywhere it appears.
const tint: Record<SportId, string> = {
  badminton: 'text-court-badminton-accent',
  'table-tennis': 'text-court-tabletennis-accent',
  tennis: 'text-court-tennis-accent',
  pickleball: 'text-court-pickleball-accent',
  padel: 'text-court-padel-accent',
};
</script>

<template>
  <!-- Override ToggleGroup's default `w-fit + flex` with `w-full + grid` so
       tiles span the page and lay out as cards (not a connected ribbon
       segmented control like the smaller toggle groups). -->
  <ToggleGroup
    type="single"
    :model-value="props.modelValue"
    variant="outline"
    class="grid grid-cols-2 gap-2 w-full sm:grid-cols-3"
    @update:model-value="(v) => v && $emit('update:modelValue', v as SportId)"
  >
    <ToggleGroupItem
      v-for="s in sports"
      :key="s.id"
      :value="s.id"
      :disabled="!s.enabled"
      :title="s.enabled ? '' : `${s.label} ships in v1.x`"
      class="h-auto min-h-[120px] flex-col items-start gap-2.5 p-4 whitespace-normal"
    >
      <SportGlyph :sport="s.id" class="size-9" :class="tint[s.id]" />
      <span class="block w-full text-left">
        <span class="block font-semibold text-base">{{ s.label }}</span>
        <span class="block text-xs mt-0.5 opacity-70">{{ s.preset }}</span>
      </span>
    </ToggleGroupItem>
  </ToggleGroup>
</template>
