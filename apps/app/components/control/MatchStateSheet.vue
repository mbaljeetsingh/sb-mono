<script setup lang="ts">
import { ref } from "vue";
import type { SideId } from "@sb/engine";
import { Button } from "@sb/layer-ui/components/ui/button";

const emit = defineEmits<{
  (e: "timeout", side: SideId, kind: "standard" | "medical" | "injury"): void;
  (e: "walkover", winner: SideId): void;
  (e: "retirement", retiring: SideId): void;
  (e: "open-score-correct"): void;
  (e: "reset"): void;
}>();

// Two-tap confirm for the destructive reset. First tap arms it, second fires.
// Resets when the sheet unmounts via the parent's openSheet swap.
const confirmReset = ref(false);
const onResetTap = () => {
  if (!confirmReset.value) {
    confirmReset.value = true;
    return;
  }
  emit("reset");
};
</script>

<template>
  <div
    class="absolute inset-x-0 bottom-0 z-50 bg-surface text-foreground rounded-t-2xl px-4 pt-3 pb-6 shadow-[0_-12px_40px_rgba(0,0,0,0.18)]"
  >
    <div class="size-1 w-10 bg-border-strong rounded-full mx-auto mb-3" />
    <h2 class="text-lg font-semibold">Match events</h2>
    <p class="text-[11px] text-fg-subtle mb-4">
      All recorded as events · undoable
    </p>

    <div
      class="text-[11px] font-bold tracking-wider uppercase text-fg-subtle mb-2"
    >
      Pause
    </div>
    <div class="grid grid-cols-2 gap-2 mb-3">
      <Button
        variant="outline"
        size="sm"
        @click="emit('timeout', 'A', 'standard')"
      >
        ⏸ Timeout · A
      </Button>
      <Button
        variant="outline"
        size="sm"
        @click="emit('timeout', 'B', 'standard')"
      >
        ⏸ Timeout · B
      </Button>
    </div>
    <div class="grid grid-cols-2 gap-2 mb-5">
      <Button
        variant="outline"
        size="sm"
        @click="emit('timeout', 'A', 'medical')"
      >
        + Medical · A
      </Button>
      <Button
        variant="outline"
        size="sm"
        @click="emit('timeout', 'B', 'medical')"
      >
        + Medical · B
      </Button>
    </div>

    <div
      class="text-[11px] font-bold tracking-wider uppercase text-fg-subtle mb-2"
    >
      End match
    </div>
    <div class="flex flex-col gap-2 mb-3">
      <Button
        variant="outline"
        class="h-auto justify-start gap-3 p-3 whitespace-normal"
        @click="emit('walkover', 'A')"
      >
        <span class="text-team-a text-lg">⚑</span>
        <span class="flex-1 text-left">
          <span class="block text-sm font-semibold">Walkover · A wins</span>
          <span class="block text-[11px] text-fg-subtle font-normal"
            >B didn't show</span
          >
        </span>
        <span>›</span>
      </Button>
      <Button
        variant="outline"
        class="h-auto justify-start gap-3 p-3 whitespace-normal"
        @click="emit('walkover', 'B')"
      >
        <span class="text-team-b text-lg">⚑</span>
        <span class="flex-1 text-left">
          <span class="block text-sm font-semibold">Walkover · B wins</span>
          <span class="block text-[11px] text-fg-subtle font-normal"
            >A didn't show</span
          >
        </span>
        <span>›</span>
      </Button>
      <Button
        variant="outline"
        class="h-auto justify-start gap-3 p-3 whitespace-normal"
        @click="emit('retirement', 'A')"
      >
        <span class="text-team-a text-lg">✕</span>
        <span class="flex-1 text-left">
          <span class="block text-sm font-semibold">Retirement · A</span>
          <span class="block text-[11px] text-fg-subtle font-normal"
            >A injured · B wins</span
          >
        </span>
        <span>›</span>
      </Button>
      <Button
        variant="outline"
        class="h-auto justify-start gap-3 p-3 whitespace-normal"
        @click="emit('retirement', 'B')"
      >
        <span class="text-team-b text-lg">✕</span>
        <span class="flex-1 text-left">
          <span class="block text-sm font-semibold">Retirement · B</span>
          <span class="block text-[11px] text-fg-subtle font-normal"
            >B injured · A wins</span
          >
        </span>
        <span>›</span>
      </Button>
    </div>

    <Button
      variant="outline"
      size="sm"
      class="w-full mt-2"
      @click="emit('open-score-correct')"
    >
      Score correction…
    </Button>

    <!-- Danger zone. Two-tap confirm so a stray tap can't wipe a live match. -->
    <div
      class="mt-5 pt-4 border-t border-dashed border-border flex flex-col gap-2"
    >
      <div class="text-[11px] font-bold tracking-wider uppercase text-danger">
        Danger
      </div>
      <Button
        :variant="confirmReset ? 'destructive' : 'outline'"
        size="sm"
        class="w-full"
        @click="onResetTap"
      >
        {{
          confirmReset
            ? "Tap again to confirm — clears all events"
            : "Reset match to 0–0"
        }}
      </Button>
    </div>
  </div>
</template>
