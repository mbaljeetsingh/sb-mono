<script setup lang="ts">
// One highlight clip: thumbnail (a real frame the parent grabbed from the
// uploaded video), kind chip, score context, selection toggle, and a
// per-clip Download. Purely presentational — selection, thumbnails and the
// render pipeline live in the page.

import { Button } from '@sb/layer-ui/components/ui/button';
import { Progress } from '@sb/layer-ui/components/ui/progress';
import { Check, Download, Play } from 'lucide-vue-next';
import { type ClipKind, clipKindMeta } from '~/lib/highlight-clips';

export type HighlightCardModel = {
  id: string;
  kind: ClipKind;
  title: string;
  meta: string;
  durationLabel: string;
  thumbnail: string | null;
  selected: boolean;
};

defineProps<{
  card: HighlightCardModel;
  /** Rendering progress ratio for THIS clip, or null when idle. */
  renderRatio: number | null;
  /** Disable actions while another clip renders. */
  busy: boolean;
}>();

const emit = defineEmits<{
  (e: 'toggle'): void;
  (e: 'preview'): void;
  (e: 'download'): void;
}>();
</script>

<template>
  <div
    class="overflow-hidden rounded-lg border bg-surface transition-opacity"
    :class="card.selected ? 'border-primary/55' : 'border-border opacity-55'"
  >
    <button
      type="button"
      class="relative block aspect-video w-full bg-black/60 text-left"
      :aria-label="`Preview ${card.title}`"
      @click="emit('preview')"
    >
      <img
        v-if="card.thumbnail"
        :src="card.thumbnail"
        alt=""
        class="absolute inset-0 size-full object-cover"
      />
      <span
        class="absolute left-2 top-2 inline-flex h-5 items-center rounded-md border px-2 text-[10px] font-bold uppercase tracking-wider"
        :class="clipKindMeta[card.kind].chipClass"
      >
        {{ clipKindMeta[card.kind].label }}
      </span>
      <span
        class="absolute bottom-2 right-2 rounded bg-black/65 px-1.5 py-0.5 font-mono text-[10px] text-white"
      >
        {{ card.durationLabel }}
      </span>
    </button>

    <div class="p-3">
      <div class="text-sm font-semibold">{{ card.title }}</div>
      <div class="mt-0.5 text-xs text-fg-muted">{{ card.meta }}</div>
      <div class="mt-2.5 flex items-center justify-between gap-2">
        <Button variant="ghost" size="sm" @click="emit('preview')">
          <Play class="size-3.5" />
          Preview
        </Button>
        <div class="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            :disabled="busy"
            @click="emit('download')"
          >
            <Download class="size-3.5" />
            Download
          </Button>
          <Button
            :variant="card.selected ? 'default' : 'outline'"
            size="icon-sm"
            :aria-label="
              card.selected ? 'Exclude from selection' : 'Include in selection'
            "
            :aria-pressed="card.selected"
            @click="emit('toggle')"
          >
            <Check v-if="card.selected" class="size-4" />
            <span v-else class="size-4" />
          </Button>
        </div>
      </div>
      <Progress
        v-if="renderRatio !== null"
        :model-value="renderRatio * 100"
        class="mt-2 h-1.5"
      />
    </div>
  </div>
</template>
