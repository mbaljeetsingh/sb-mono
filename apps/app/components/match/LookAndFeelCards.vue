<script setup lang="ts">
import { Button } from '@sb/layer-ui/components/ui/button';

defineProps<{
  overlayThemeName: string;
  scoreboardThemeName: string;
}>();

defineEmits<(e: 'open-theme') => void>();
</script>

<template>
  <div>
    <div
      class="text-[11px] font-semibold tracking-[0.06em] uppercase text-fg-subtle mb-2.5"
    >
      Look &amp; feel
    </div>
    <div class="grid grid-cols-2 gap-2">
      <Button
        type="button"
        variant="outline"
        class="h-auto flex-col items-stretch gap-1.5 p-3 text-left whitespace-normal"
        @click="$emit('open-theme')"
      >
        <span class="flex justify-between items-center">
          <span
            class="text-[11px] text-fg-subtle tracking-wide uppercase font-semibold"
          >
            🎨 Theme
          </span>
          <span class="text-fg-subtle">›</span>
        </span>
        <span class="block text-sm font-semibold">{{ overlayThemeName }}</span>
        <span class="block text-[10px] text-fg-subtle font-normal">
          Scoreboard: {{ scoreboardThemeName }}
        </span>
      </Button>
      <Button
        type="button"
        variant="outline"
        disabled
        class="h-auto flex-col items-stretch gap-1.5 p-3 text-left whitespace-normal"
        title="Custom team colors land in v1.x"
      >
        <span class="flex justify-between items-center">
          <span
            class="text-[11px] text-fg-subtle tracking-wide uppercase font-semibold"
          >
            🖌 Colors
          </span>
          <span class="text-fg-subtle">soon</span>
        </span>
        <span class="text-sm font-semibold inline-flex items-center gap-1.5">
          <span class="size-3.5 rounded-sm bg-team-a" />
          <span class="size-3.5 rounded-sm bg-team-b" />
          Red / Blue
        </span>
      </Button>
    </div>
  </div>
</template>
