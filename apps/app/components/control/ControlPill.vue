<script setup lang="ts">
import { Button } from '@sb/layer-ui/components/ui/button';

// Small floating pill used by the control surface for low-frequency setup
// actions ("Swap", "Sides", "Serve first") that sit on top of the court. One
// style, one place — keeps control.vue and TeamRow.vue from drifting.
defineProps<{
  ariaLabel: string;
}>();

defineEmits<(e: 'click', ev: MouseEvent) => void>();
</script>

<template>
  <Button
    type="button"
    size="sm"
    :aria-label="ariaLabel"
    class="h-7 border border-border-strong bg-background/95 px-2.5 text-xs text-foreground shadow-md backdrop-blur-sm hover:bg-background"
    @click="$emit('click', $event)"
  >
    <slot />
  </Button>
</template>
