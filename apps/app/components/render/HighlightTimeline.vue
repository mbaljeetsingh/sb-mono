<script setup lang="ts">
// Annotated timeline strip for the render page. Sits UNDER the native video
// controls (which stay — fullscreen/keyboard/iOS come free) and adds what
// they can't show: per-game sync ticks, highlight-clip bands colored by kind,
// and a playhead. Click/tap seeks; clicking a band also tells the parent
// which clip it is so the card list can follow. Deliberately NOT a slider
// role: it isn't keyboard-operable, and keyboard seeking already exists on
// the native video controls — an inert "slider" would lie to assistive tech.

import { ref } from 'vue';
import {
  type ClipKind,
  clipKindMeta,
  formatClockMs,
} from '~/lib/highlight-clips';

export type TimelineBand = {
  id: string;
  startMs: number;
  endMs: number;
  kind: ClipKind;
  selected: boolean;
};

const props = defineProps<{
  /** Video duration in ms; 0 while metadata hasn't loaded. */
  durationMs: number;
  currentMs: number;
  /** videoMs per synced game index — becomes the G{n} ticks. */
  anchorTicks: { gameIndex: number; videoMs: number }[];
  bands: TimelineBand[];
  /** Band to ring-highlight (the clip whose card is active). */
  activeBandId?: string | null;
}>();

const emit = defineEmits<{
  (e: 'seek', ms: number): void;
  (e: 'select-band', id: string): void;
}>();

const track = ref<HTMLElement | null>(null);

const pct = (ms: number) =>
  props.durationMs > 0
    ? `${Math.min(100, Math.max(0, (ms / props.durationMs) * 100))}%`
    : '0%';

// Bands are seconds-wide on a ~40-minute track; a minimum width keeps them
// tappable and visible.
const bandStyle = (b: TimelineBand) => ({
  left: pct(b.startMs),
  width: `max(8px, calc(${pct(b.endMs)} - ${pct(b.startMs)}))`,
});

const legend = Object.values(clipKindMeta);

const onTrackClick = (e: MouseEvent) => {
  const el = track.value;
  if (!el || props.durationMs <= 0) return;
  const rect = el.getBoundingClientRect();
  const ratio = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
  emit('seek', ratio * props.durationMs);
};

const onBandClick = (b: TimelineBand, e: MouseEvent) => {
  e.stopPropagation();
  emit('select-band', b.id);
  emit('seek', b.startMs);
};
</script>

<template>
  <div>
    <div ref="track" class="relative h-12 cursor-pointer" @click="onTrackClick">
      <!-- Per-game sync ticks -->
      <template v-for="tick in anchorTicks" :key="tick.gameIndex">
        <span
          class="pointer-events-none absolute top-3 h-9 w-px bg-border-strong"
          :style="{ left: pct(tick.videoMs) }"
        />
        <span
          class="pointer-events-none absolute top-0 ml-1 font-mono text-[9px] text-fg-subtle"
          :style="{ left: pct(tick.videoMs) }"
        >
          G{{ tick.gameIndex + 1 }}
        </span>
      </template>

      <!-- Base track -->
      <span
        class="pointer-events-none absolute inset-x-0 top-6 h-4 rounded bg-surface-2"
      />

      <!-- Clip bands -->
      <button
        v-for="b in bands"
        :key="b.id"
        type="button"
        class="absolute top-6 h-4 rounded-[3px] transition-opacity"
        :class="[
          clipKindMeta[b.kind].bandClass,
          b.selected ? 'opacity-100' : 'opacity-35',
          b.id === activeBandId ? 'ring-2 ring-foreground/50' : '',
        ]"
        :style="bandStyle(b)"
        :aria-label="`Jump to clip at ${formatClockMs(b.startMs)}`"
        @click="onBandClick(b, $event)"
      />

      <!-- Playhead -->
      <span
        class="pointer-events-none absolute top-2 h-10 w-0.5 rounded-full bg-foreground"
        :style="{ left: pct(currentMs) }"
      />
    </div>

    <div class="mt-1.5 flex items-center justify-between">
      <span class="font-mono text-[10px] text-fg-subtle">0:00</span>
      <div class="hidden items-center gap-3.5 sm:flex">
        <span
          v-for="item in legend"
          :key="item.label"
          class="flex items-center gap-1.5"
        >
          <span class="size-2 rounded-full" :class="item.bandClass" />
          <span class="text-[10px] text-fg-subtle">{{ item.label }}</span>
        </span>
      </div>
      <span class="font-mono text-[10px] text-fg-subtle">
        {{ formatClockMs(durationMs) }}
      </span>
    </div>
  </div>
</template>
