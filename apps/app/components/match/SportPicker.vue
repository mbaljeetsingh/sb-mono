<script setup lang="ts">
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@sb/layer-ui/components/ui/toggle-group";

export type SportId = "badminton" | "tennis" | "pickleball" | "table-tennis";

const props = defineProps<{ modelValue: SportId }>();
defineEmits<{ (e: "update:modelValue", v: SportId): void }>();

// All four racquet sports ship engine configs in @sb/engine/registry, but
// only badminton is exposed in the picker today. The others stay listed (so
// users see what's coming) but disabled — engine, control surface, and
// themes need a polish pass before they ship publicly.
const sports: {
  id: SportId;
  label: string;
  preset: string;
  emoji: string;
  enabled: boolean;
}[] = [
  {
    id: "badminton",
    label: "Badminton",
    preset: "21pt BWF",
    emoji: "🏸",
    enabled: true,
  },
  {
    id: "tennis",
    label: "Tennis",
    preset: "Coming soon",
    emoji: "🎾",
    enabled: false,
  },
  {
    id: "pickleball",
    label: "Pickleball",
    preset: "Coming soon",
    emoji: "🥎",
    enabled: false,
  },
  {
    id: "table-tennis",
    label: "Table tennis",
    preset: "Coming soon",
    emoji: "🏓",
    enabled: false,
  },
];
</script>

<template>
  <!-- Override ToggleGroup's default `w-fit + flex` with `w-full + grid` so
       tiles span the page and lay out as cards (not a connected ribbon
       segmented control like the smaller toggle groups). -->
  <ToggleGroup
    type="single"
    :model-value="props.modelValue"
    variant="outline"
    class="grid grid-cols-2 gap-2 w-full"
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
      <span class="text-4xl leading-none">{{ s.emoji }}</span>
      <span class="block w-full text-left">
        <span class="block font-semibold text-base">{{ s.label }}</span>
        <span class="block text-xs mt-0.5 opacity-70">{{ s.preset }}</span>
      </span>
    </ToggleGroupItem>
  </ToggleGroup>
</template>
