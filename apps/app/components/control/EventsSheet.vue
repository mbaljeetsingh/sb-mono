<script setup lang="ts">
import { computed } from "vue";
import { Undo2 } from "lucide-vue-next";
import type { RacquetEvent } from "@sb/engine";
import { Button } from "@sb/layer-ui/components/ui/button";

const props = defineProps<{ events: RacquetEvent[] }>();
const emit = defineEmits<{
  (e: "undo-to", idx: number): void;
  (e: "undo-last"): void;
  (e: "open-score-correct"): void;
}>();

// Format the recent event list for display. The engine's event types are
// intentionally raw; this is the UI presentation layer. `idx` points at the
// event in the original array so "undo to here" can truncate.
const recent = computed(() => {
  const total = props.events.length;
  return props.events
    .slice()
    .reverse()
    .slice(0, 20)
    .map((e, i) => {
      const ageMs = Date.now() - e.ts;
      const ago =
        ageMs < 1000
          ? "now"
          : ageMs < 60_000
            ? `-${Math.floor(ageMs / 1000)}s`
            : `-${Math.floor(ageMs / 60_000)}m`;
      let label = "";
      let isSystem = false;
      switch (e.type) {
        case "point":
          label = `Team ${e.side} scored`;
          break;
        case "match.start":
          label = "Match started";
          isSystem = true;
          break;
        case "walkover":
          label = `Walkover · ${e.winner} wins`;
          isSystem = true;
          break;
        case "retirement":
          label = `Retirement · ${e.retiring}`;
          isSystem = true;
          break;
        case "default":
          label = `Default · ${e.defaulted}`;
          isSystem = true;
          break;
        case "timeout.start":
          label = `Timeout · ${e.side}`;
          isSystem = true;
          break;
        case "timeout.end":
          label = `Timeout ended · ${e.side}`;
          isSystem = true;
          break;
        case "score.correct":
          label = "Score corrected";
          isSystem = true;
          break;
        case "team.rename":
          label = `${e.side} renamed`;
          isSystem = true;
          break;
        default:
          label = (e as { type: string }).type;
          isSystem = true;
      }
      return { id: e.id, ago, label, isSystem, idx: total - 1 - i };
    });
});
</script>

<template>
  <div
    class="absolute inset-x-0 bottom-0 z-50 max-h-[70vh] bg-surface text-foreground rounded-t-2xl px-4 pt-3 pb-6 flex flex-col shadow-[0_-12px_40px_rgba(0,0,0,0.18)]"
  >
    <div class="size-1 w-10 bg-border-strong rounded-full mx-auto mb-3" />
    <div class="flex justify-between items-baseline mb-3">
      <h2 class="text-lg font-semibold">Recent events</h2>
      <span class="text-[11px] text-fg-subtle">tap to undo back to here</span>
    </div>
    <div class="flex-1 overflow-y-auto">
      <div
        v-for="e in recent"
        :key="e.id"
        class="flex items-center gap-2.5 py-2 border-b border-dashed border-border"
        :class="e.isSystem ? 'opacity-60' : ''"
      >
        <div class="font-mono text-[11px] w-8 text-fg-subtle">{{ e.ago }}</div>
        <div class="flex-1 text-sm">{{ e.label }}</div>
        <Button
          v-if="!e.isSystem"
          variant="ghost"
          size="icon-sm"
          class="text-team-a"
          aria-label="Undo to here"
          @click="emit('undo-to', e.idx)"
        >
          <Undo2 class="size-4" />
        </Button>
      </div>
      <div
        v-if="recent.length === 0"
        class="text-fg-subtle text-sm py-4 text-center"
      >
        No events yet
      </div>
    </div>
    <div class="flex justify-between gap-2 mt-3 pt-3 border-t border-border">
      <Button variant="outline" size="sm" @click="emit('open-score-correct')">
        Score correction →
      </Button>
      <Button
        size="sm"
        class="bg-team-a text-team-a-foreground hover:bg-team-a/90"
        @click="emit('undo-last')"
      >
        <Undo2 class="size-4" />
        Undo last
      </Button>
    </div>
  </div>
</template>
