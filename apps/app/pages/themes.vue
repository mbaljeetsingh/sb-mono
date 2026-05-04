<script setup lang="ts">
import { themes as themeRegistry } from "@sb/themes";

definePageMeta({ layout: false });

const list = Object.values(themeRegistry).map((t) => t.manifest);

type SurfaceFilter = "all" | "overlay" | "scoreboard";
const surfaceFilter = ref<SurfaceFilter>("all");

const filtered = computed(() => {
  if (surfaceFilter.value === "all") return list;
  return list.filter((m) =>
    m.supports.includes(surfaceFilter.value as "overlay" | "scoreboard"),
  );
});
</script>

<template>
  <div class="min-h-screen bg-background text-foreground font-sans">
    <header class="px-6 pt-16 pb-5 flex items-center justify-between">
      <div>
        <h1 class="text-[22px] font-semibold tracking-tight">Themes</h1>
        <p class="text-sm text-fg-muted mt-1">
          {{ list.length }} default · contribute on
          <a href="https://github.com/scoreboard" class="underline">GitHub</a>
        </p>
      </div>
      <button
        type="button"
        class="size-9 rounded-md hover:bg-surface-2 inline-flex items-center justify-center"
        aria-label="Close"
        @click="navigateTo('/')"
      >
        ✕
      </button>
    </header>

    <!-- Filter pills -->
    <div class="px-6 flex gap-2">
      <button
        v-for="f in ['all', 'overlay', 'scoreboard'] as SurfaceFilter[]"
        :key="f"
        type="button"
        class="px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider transition-colors"
        :class="
          surfaceFilter === f
            ? 'bg-foreground text-background'
            : 'bg-surface text-foreground border border-border hover:bg-surface-2'
        "
        @click="surfaceFilter = f"
      >
        {{ f }}
      </button>
    </div>

    <!-- Theme grid -->
    <main class="px-6 pt-5 pb-8 flex flex-col gap-3">
      <div
        v-for="m in filtered"
        :key="m.id"
        class="p-3 border border-border rounded-md bg-surface"
      >
        <!-- Mini preview -->
        <div
          class="h-14 rounded-sm border border-dashed border-border-strong mb-2.5 flex items-center justify-around text-foreground"
          :class="
            m.id === 'filmable'
              ? 'bg-neutral-950 text-neutral-50'
              : 'bg-surface-2'
          "
        >
          <span class="score text-xl">14</span>
          <span class="opacity-40">—</span>
          <span class="score text-xl">11</span>
        </div>

        <div class="flex justify-between items-start gap-2">
          <div class="flex-1 min-w-0">
            <div class="text-[13px] font-semibold leading-tight">
              {{ m.name }}
            </div>
            <div class="text-[11px] text-fg-subtle mt-0.5">
              {{ m.description }}
            </div>
            <div class="flex gap-1.5 mt-1.5">
              <span
                v-for="s in m.supports"
                :key="s"
                class="text-[9px] uppercase tracking-wider text-fg-subtle font-semibold"
              >
                {{ s }}
              </span>
            </div>
          </div>
          <button
            type="button"
            class="px-2.5 h-7 rounded-md bg-secondary text-secondary-foreground text-[11px] font-semibold hover:bg-surface-2 flex-shrink-0"
          >
            preview
          </button>
        </div>
      </div>

      <div
        class="p-5 border border-dashed border-border-strong rounded-md text-center text-fg-muted"
      >
        <div class="text-2xl mb-1">+</div>
        <div class="text-[13px]">Marketplace · v2</div>
      </div>
    </main>
  </div>
</template>
