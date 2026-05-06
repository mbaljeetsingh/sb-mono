<script setup lang="ts">
import { computed } from "vue";
import { Check } from "lucide-vue-next";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@sb/layer-ui/components/ui/sheet";
import { themes as themeRegistry, type ThemeSurface } from "@sb/themes";

const props = defineProps<{
  open: boolean;
  overlayTheme: string;
  scoreboardTheme: string;
}>();

const emit = defineEmits<{
  "update:open": [value: boolean];
  pick: [args: { surface: ThemeSurface; id: string }];
}>();

const isOpen = computed({
  get: () => props.open,
  set: (v) => emit("update:open", v),
});

const themesBySurface = computed(() => {
  const overlay: Array<{ id: string; name: string; description: string }> = [];
  const scoreboard: Array<{ id: string; name: string; description: string }> =
    [];
  for (const entry of Object.values(themeRegistry)) {
    const m = entry.manifest;
    if (m.supports.includes("overlay")) {
      overlay.push({ id: m.id, name: m.name, description: m.description });
    }
    if (m.supports.includes("scoreboard")) {
      scoreboard.push({ id: m.id, name: m.name, description: m.description });
    }
  }
  return { overlay, scoreboard };
});

const pick = (surface: ThemeSurface, id: string) => {
  emit("pick", { surface, id });
};
</script>

<template>
  <Sheet v-model:open="isOpen">
    <SheetContent side="right" class="w-full sm:max-w-md">
      <SheetHeader>
        <SheetTitle>Themes</SheetTitle>
        <SheetDescription>
          Choose how the overlay (OBS) and the venue scoreboard look. Applies to
          this match only.
        </SheetDescription>
      </SheetHeader>

      <div class="mt-6 space-y-8 px-4 pb-8">
        <section>
          <h3
            class="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
          >
            Overlay (OBS browser source)
          </h3>
          <div class="flex flex-col gap-2">
            <button
              v-for="t in themesBySurface.overlay"
              :key="t.id"
              type="button"
              class="flex items-center justify-between gap-3 rounded-md border border-border bg-card p-3 text-left transition-colors hover:bg-muted"
              :class="
                overlayTheme === t.id
                  ? 'border-primary ring-1 ring-primary'
                  : ''
              "
              @click="pick('overlay', t.id)"
            >
              <span class="flex-1 min-w-0">
                <span class="block text-sm font-semibold">{{ t.name }}</span>
                <span class="mt-0.5 block text-xs text-muted-foreground">
                  {{ t.description }}
                </span>
              </span>
              <Check
                v-if="overlayTheme === t.id"
                class="h-4 w-4 flex-shrink-0 text-primary"
              />
            </button>
          </div>
        </section>

        <section>
          <h3
            class="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground"
          >
            Scoreboard (TV / venue display)
          </h3>
          <div class="flex flex-col gap-2">
            <button
              v-for="t in themesBySurface.scoreboard"
              :key="t.id"
              type="button"
              class="flex items-center justify-between gap-3 rounded-md border border-border bg-card p-3 text-left transition-colors hover:bg-muted"
              :class="
                scoreboardTheme === t.id
                  ? 'border-primary ring-1 ring-primary'
                  : ''
              "
              @click="pick('scoreboard', t.id)"
            >
              <span class="flex-1 min-w-0">
                <span class="block text-sm font-semibold">{{ t.name }}</span>
                <span class="mt-0.5 block text-xs text-muted-foreground">
                  {{ t.description }}
                </span>
              </span>
              <Check
                v-if="scoreboardTheme === t.id"
                class="h-4 w-4 flex-shrink-0 text-primary"
              />
            </button>
          </div>
        </section>
      </div>
    </SheetContent>
  </Sheet>
</template>
