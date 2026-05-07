<script setup lang="ts">
import { ref } from "vue";
import { X } from "lucide-vue-next";
import type { SideId } from "@sb/engine";
import { Button } from "@sb/layer-ui/components/ui/button";

const props = defineProps<{
  teamNames: { a: string; b: string };
}>();

const emit = defineEmits<{
  (e: "timeout", side: SideId, kind: "standard" | "medical" | "injury"): void;
  (e: "penalty", side: SideId, card: "yellow" | "red" | "black"): void;
  (e: "walkover", winner: SideId): void;
  (e: "retirement", retiring: SideId): void;
  (e: "open-score-correct"): void;
  (e: "reset"): void;
  (e: "close"): void;
}>();

const nameOf = (s: SideId) =>
  s === "A" ? props.teamNames.a : props.teamNames.b;
const otherOf = (s: SideId) =>
  s === "A" ? props.teamNames.b : props.teamNames.a;

// Two-tap confirm for cards that mutate match state. Stays armed until tapped
// again or the sheet closes.
const armedCard = ref<string | null>(null);
const tapPenalty = (side: SideId, card: "yellow" | "red" | "black") => {
  if (card === "yellow") {
    emit("penalty", side, card);
    return;
  }
  const key = `${side}:${card}`;
  if (armedCard.value !== key) {
    armedCard.value = key;
    return;
  }
  armedCard.value = null;
  emit("penalty", side, card);
};

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
    class="absolute inset-x-0 bottom-0 z-50 bg-surface text-foreground rounded-t-2xl shadow-[0_-12px_40px_rgba(0,0,0,0.18)] flex flex-col max-h-[85vh]"
  >
    <!-- Sticky header: drag handle + title + close button. Stays put while
         the body scrolls so the operator always has a way out. -->
    <div
      class="sticky top-0 z-10 bg-surface rounded-t-2xl px-4 pt-3 pb-2 border-b border-border"
    >
      <div class="size-1 w-10 bg-border-strong rounded-full mx-auto mb-3" />
      <div class="flex items-center justify-between">
        <div>
          <h2 class="text-lg font-semibold">Match events</h2>
          <p class="text-[11px] text-fg-subtle">
            All recorded as events · undoable
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Close"
          @click="emit('close')"
        >
          <X class="size-5" />
        </Button>
      </div>
    </div>

    <!-- Scrollable body. -->
    <div class="flex-1 overflow-y-auto px-4 py-4 pb-8">
      <div
        class="text-[11px] font-bold tracking-wider uppercase text-fg-subtle mb-2"
      >
        Pause
      </div>
      <div class="grid grid-cols-2 gap-2 mb-3">
        <Button
          variant="outline"
          size="sm"
          class="h-auto py-2 whitespace-normal"
          @click="emit('timeout', 'A', 'standard')"
        >
          ⏸ Timeout · {{ nameOf("A") }}
        </Button>
        <Button
          variant="outline"
          size="sm"
          class="h-auto py-2 whitespace-normal"
          @click="emit('timeout', 'B', 'standard')"
        >
          ⏸ Timeout · {{ nameOf("B") }}
        </Button>
      </div>
      <div class="grid grid-cols-2 gap-2 mb-5">
        <Button
          variant="outline"
          size="sm"
          class="h-auto py-2 whitespace-normal"
          @click="emit('timeout', 'A', 'medical')"
        >
          + Medical · {{ nameOf("A") }}
        </Button>
        <Button
          variant="outline"
          size="sm"
          class="h-auto py-2 whitespace-normal"
          @click="emit('timeout', 'B', 'medical')"
        >
          + Medical · {{ nameOf("B") }}
        </Button>
      </div>

      <div
        class="text-[11px] font-bold tracking-wider uppercase text-fg-subtle mb-2"
      >
        Penalty cards
      </div>
      <div class="grid grid-cols-2 gap-2 mb-2">
        <Button
          variant="outline"
          size="sm"
          class="h-auto py-2 whitespace-normal"
          @click="tapPenalty('A', 'yellow')"
        >
          🟨 Yellow · {{ nameOf("A") }}
        </Button>
        <Button
          variant="outline"
          size="sm"
          class="h-auto py-2 whitespace-normal"
          @click="tapPenalty('B', 'yellow')"
        >
          🟨 Yellow · {{ nameOf("B") }}
        </Button>
      </div>
      <div class="grid grid-cols-2 gap-2 mb-2">
        <Button
          :variant="armedCard === 'A:red' ? 'destructive' : 'outline'"
          size="sm"
          class="h-auto py-2 whitespace-normal"
          @click="tapPenalty('A', 'red')"
        >
          {{
            armedCard === "A:red"
              ? `Tap again — point to ${otherOf("A")}`
              : `🟥 Red · ${nameOf("A")}`
          }}
        </Button>
        <Button
          :variant="armedCard === 'B:red' ? 'destructive' : 'outline'"
          size="sm"
          class="h-auto py-2 whitespace-normal"
          @click="tapPenalty('B', 'red')"
        >
          {{
            armedCard === "B:red"
              ? `Tap again — point to ${otherOf("B")}`
              : `🟥 Red · ${nameOf("B")}`
          }}
        </Button>
      </div>
      <div class="grid grid-cols-2 gap-2 mb-5">
        <Button
          :variant="armedCard === 'A:black' ? 'destructive' : 'outline'"
          size="sm"
          class="h-auto py-2 whitespace-normal"
          @click="tapPenalty('A', 'black')"
        >
          {{
            armedCard === "A:black"
              ? `Tap again — DQ ${nameOf("A")}`
              : `⬛ Black · ${nameOf("A")}`
          }}
        </Button>
        <Button
          :variant="armedCard === 'B:black' ? 'destructive' : 'outline'"
          size="sm"
          class="h-auto py-2 whitespace-normal"
          @click="tapPenalty('B', 'black')"
        >
          {{
            armedCard === "B:black"
              ? `Tap again — DQ ${nameOf("B")}`
              : `⬛ Black · ${nameOf("B")}`
          }}
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
            <span class="block text-sm font-semibold"
              >Walkover · {{ nameOf("A") }} wins</span
            >
            <span class="block text-[11px] text-fg-subtle font-normal"
              >{{ nameOf("B") }} didn't show</span
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
            <span class="block text-sm font-semibold"
              >Walkover · {{ nameOf("B") }} wins</span
            >
            <span class="block text-[11px] text-fg-subtle font-normal"
              >{{ nameOf("A") }} didn't show</span
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
            <span class="block text-sm font-semibold"
              >Retirement · {{ nameOf("A") }}</span
            >
            <span class="block text-[11px] text-fg-subtle font-normal"
              >{{ nameOf("A") }} injured · {{ nameOf("B") }} wins</span
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
            <span class="block text-sm font-semibold"
              >Retirement · {{ nameOf("B") }}</span
            >
            <span class="block text-[11px] text-fg-subtle font-normal"
              >{{ nameOf("B") }} injured · {{ nameOf("A") }} wins</span
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
  </div>
</template>
