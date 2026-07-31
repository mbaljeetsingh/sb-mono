<script setup lang="ts">
import { Button } from '@sb/layer-ui/components/ui/button';
import { ChevronRight, Palette } from 'lucide-vue-next';

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
    <!-- Theme is the only thing in here for now. A custom-team-colors card used
         to sit beside it, permanently disabled behind a "soon" badge — half a
         row on the create flow advertising something nobody can do. It comes
         back as a working card when the feature ships; until then Theme takes
         the full width. -->
    <Button
      type="button"
      variant="outline"
      class="h-auto w-full items-center gap-3 p-3 text-left whitespace-normal"
      @click="$emit('open-theme')"
    >
      <Palette class="size-4 shrink-0 text-fg-subtle" />
      <span class="min-w-0 flex-1">
        <span
          class="block text-[11px] tracking-wide uppercase font-semibold text-fg-subtle"
        >
          Theme
        </span>
        <span class="block truncate text-sm font-semibold">
          {{ overlayThemeName }}
        </span>
        <span class="block truncate text-[10px] font-normal text-fg-subtle">
          Scoreboard: {{ scoreboardThemeName }}
        </span>
      </span>
      <ChevronRight class="size-4 shrink-0 text-fg-subtle" />
    </Button>
  </div>
</template>
