<script setup lang="ts">
// Dialog-based theme picker with live previews. Used by /new (creation flow)
// and /m/[id] (per-match override). Each theme renders at broadcast size
// inside a scaled card so the user sees how scoring will actually look — no
// guessing from a name + description.

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@sb/layer-ui/components/ui/dialog';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@sb/layer-ui/components/ui/tabs';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@sb/layer-ui/components/ui/toggle-group';
import { type ThemeSurface, themes as themeRegistry } from '@sb/themes';
import { Check } from 'lucide-vue-next';
import { computed } from 'vue';
import ThemePreview from './ThemePreview.vue';

const props = defineProps<{
  open: boolean;
  overlayTheme: string;
  scoreboardTheme: string;
}>();

const emit = defineEmits<{
  'update:open': [value: boolean];
  pick: [args: { surface: ThemeSurface; id: string }];
}>();

const isOpen = computed({
  get: () => props.open,
  set: (v) => emit('update:open', v),
});

const themesBySurface = computed(() => {
  const overlay = [];
  const scoreboard = [];
  for (const entry of Object.values(themeRegistry)) {
    if (entry.manifest.supports.includes('overlay')) {
      overlay.push(entry);
    }
    if (entry.manifest.supports.includes('scoreboard')) {
      scoreboard.push(entry);
    }
  }
  return { overlay, scoreboard };
});

const pick = (surface: ThemeSurface, id: string) => {
  emit('pick', { surface, id });
};
</script>

<template>
  <Dialog v-model:open="isOpen">
    <!-- Height is capped and the grid scrolls, not the dialog: with 5+ themes
         per surface the cards exceed the viewport, and an unbounded DialogContent
         pushed the last row (and the tab strip) off-screen with no way to reach
         it. The header and TabsList stay pinned so switching surface is always
         one click away. -->
    <DialogContent class="flex max-h-[88vh] max-w-3xl flex-col p-0">
      <DialogHeader class="shrink-0 px-6 pt-6 pb-2">
        <DialogTitle>Themes</DialogTitle>
        <DialogDescription>
          Pick how the overlay (OBS) and venue scoreboard look. Tap a card to
          select. Choice applies to this match only.
        </DialogDescription>
      </DialogHeader>

      <Tabs
        default-value="overlay"
        class="flex min-h-0 flex-1 flex-col overflow-hidden px-6 pb-6"
      >
        <TabsList class="grid w-full shrink-0 grid-cols-2">
          <TabsTrigger value="overlay">Overlay (OBS)</TabsTrigger>
          <TabsTrigger value="scoreboard">Scoreboard (TV)</TabsTrigger>
        </TabsList>

        <TabsContent
          value="overlay"
          class="mt-4 min-h-0 flex-1 overflow-y-auto overscroll-contain"
        >
          <!-- ToggleGroup rather than Buttons with a hand-rolled selected class:
               these ARE a single-select group, and the built-in `data-[state=on]`
               treatment is the same primary ring the format toggles on /new use.
               The overrides below are layout only (card shape, wrapping text) —
               the selected state itself is the component's. -->
          <ToggleGroup
            type="single"
            variant="outline"
            :model-value="overlayTheme"
            class="grid w-full grid-cols-1 gap-3 sm:grid-cols-2"
            @update:model-value="(v) => v && pick('overlay', v as string)"
          >
            <ToggleGroupItem
              v-for="t in themesBySurface.overlay"
              :key="t.manifest.id"
              :value="t.manifest.id"
              class="h-auto w-full flex-col items-stretch gap-2 rounded-lg p-2 whitespace-normal"
            >
              <ThemePreview :component="t.component" surface="overlay" />
              <div class="flex items-center justify-between gap-2 px-1 pt-1">
                <div class="min-w-0 flex-1 text-left">
                  <div class="truncate text-sm font-semibold">
                    {{ t.manifest.name }}
                  </div>
                  <div
                    class="line-clamp-2 text-xs text-muted-foreground font-normal"
                  >
                    {{ t.manifest.description }}
                  </div>
                </div>
                <Check
                  v-if="overlayTheme === t.manifest.id"
                  class="size-5 shrink-0 text-primary"
                />
              </div>
            </ToggleGroupItem>
          </ToggleGroup>
        </TabsContent>

        <TabsContent
          value="scoreboard"
          class="mt-4 min-h-0 flex-1 overflow-y-auto overscroll-contain"
        >
          <ToggleGroup
            type="single"
            variant="outline"
            :model-value="scoreboardTheme"
            class="grid w-full grid-cols-1 gap-3 sm:grid-cols-2"
            @update:model-value="(v) => v && pick('scoreboard', v as string)"
          >
            <ToggleGroupItem
              v-for="t in themesBySurface.scoreboard"
              :key="t.manifest.id"
              :value="t.manifest.id"
              class="h-auto w-full flex-col items-stretch gap-2 rounded-lg p-2 whitespace-normal"
            >
              <ThemePreview :component="t.component" surface="scoreboard" />
              <div class="flex items-center justify-between gap-2 px-1 pt-1">
                <div class="min-w-0 flex-1 text-left">
                  <div class="truncate text-sm font-semibold">
                    {{ t.manifest.name }}
                  </div>
                  <div
                    class="line-clamp-2 text-xs text-muted-foreground font-normal"
                  >
                    {{ t.manifest.description }}
                  </div>
                </div>
                <Check
                  v-if="scoreboardTheme === t.manifest.id"
                  class="size-5 shrink-0 text-primary"
                />
              </div>
            </ToggleGroupItem>
          </ToggleGroup>
        </TabsContent>
      </Tabs>
    </DialogContent>
  </Dialog>
</template>
