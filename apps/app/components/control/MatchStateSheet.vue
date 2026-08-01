<script setup lang="ts">
import type { SideId } from '@sb/engine';
import { Button } from '@sb/layer-ui/components/ui/button';
import { BriefcaseMedical, Flag, Pause, X, XCircle } from 'lucide-vue-next';
import { ref } from 'vue';

const props = defineProps<{
  teamNames: { a: string; b: string };
  // gamesToWin == 1 means a single-game match — "reset current game" and
  // "reset entire match" collapse to the same action, so we hide the per-game
  // variant. For best-of-N (gamesToWin ≥ 2) both are meaningful: per-game keeps
  // completed games + gamesWon intact, full-match wipes everything.
  gamesToWin: number;
}>();

const emit = defineEmits<{
  (e: 'timeout', side: SideId, kind: 'standard' | 'medical' | 'injury'): void;
  (e: 'penalty', side: SideId, card: 'yellow' | 'red' | 'black'): void;
  (e: 'walkover', winner: SideId): void;
  (e: 'retirement', retiring: SideId): void;
  (e: 'open-score-correct'): void;
  (e: 'reset'): void;
  (e: 'reset-game'): void;
  (e: 'close'): void;
}>();

const nameOf = (s: SideId) =>
  s === 'A' ? props.teamNames.a : props.teamNames.b;
const otherOf = (s: SideId) =>
  s === 'A' ? props.teamNames.b : props.teamNames.a;

// Two-tap confirm for cards that mutate match state. Stays armed until tapped
// again or the sheet closes.
const armedCard = ref<string | null>(null);
const tapPenalty = (side: SideId, card: 'yellow' | 'red' | 'black') => {
  if (card === 'yellow') {
    emit('penalty', side, card);
    return;
  }
  const key = `${side}:${card}`;
  if (armedCard.value !== key) {
    armedCard.value = key;
    return;
  }
  armedCard.value = null;
  emit('penalty', side, card);
};

// Two-tap confirm for the destructive resets. First tap arms it, second fires.
// State resets when the sheet unmounts via the parent's openSheet swap.
const confirmReset = ref(false);
const onResetTap = () => {
  if (!confirmReset.value) {
    confirmReset.value = true;
    return;
  }
  emit('reset');
};
const confirmResetGame = ref(false);
const onResetGameTap = () => {
  if (!confirmResetGame.value) {
    confirmResetGame.value = true;
    return;
  }
  emit('reset-game');
};
</script>

<template>
  <div
    class="absolute inset-x-0 bottom-0 z-50 mx-auto w-full max-w-2xl bg-surface text-foreground rounded-t-2xl shadow-[0_-12px_40px_rgba(0,0,0,0.18)] flex flex-col max-h-[85vh] md:max-h-[68vh]"
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
    <!-- pb clears the home indicator: the sheet is `bottom-0` against the
         page's padding box, so the control page's own safe-area inset doesn't
         apply here. Without it the last row sits in the gesture strip. -->
    <div
      class="flex-1 overflow-y-auto px-4 pt-4 pb-[max(2rem,env(safe-area-inset-bottom))]"
    >
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
          <Pause class="size-3.5" />
          Timeout · {{ nameOf('A') }}
        </Button>
        <Button
          variant="outline"
          size="sm"
          class="h-auto py-2 whitespace-normal"
          @click="emit('timeout', 'B', 'standard')"
        >
          <Pause class="size-3.5" />
          Timeout · {{ nameOf('B') }}
        </Button>
      </div>
      <div class="grid grid-cols-2 gap-2 mb-5">
        <Button
          variant="outline"
          size="sm"
          class="h-auto py-2 whitespace-normal"
          @click="emit('timeout', 'A', 'medical')"
        >
          <BriefcaseMedical class="size-3.5" />
          Medical · {{ nameOf('A') }}
        </Button>
        <Button
          variant="outline"
          size="sm"
          class="h-auto py-2 whitespace-normal"
          @click="emit('timeout', 'B', 'medical')"
        >
          <BriefcaseMedical class="size-3.5" />
          Medical · {{ nameOf('B') }}
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
          <span class="size-3 shrink-0 rounded-[2px] bg-[#eab308]" />
          Yellow · {{ nameOf('A') }}
        </Button>
        <Button
          variant="outline"
          size="sm"
          class="h-auto py-2 whitespace-normal"
          @click="tapPenalty('B', 'yellow')"
        >
          <span class="size-3 shrink-0 rounded-[2px] bg-[#eab308]" />
          Yellow · {{ nameOf('B') }}
        </Button>
      </div>
      <div class="grid grid-cols-2 gap-2 mb-2">
        <Button
          :variant="armedCard === 'A:red' ? 'destructive' : 'outline'"
          size="sm"
          class="h-auto py-2 whitespace-normal"
          @click="tapPenalty('A', 'red')"
        >
          <span
            v-if="armedCard !== 'A:red'"
            class="size-3 shrink-0 rounded-[2px] bg-[#dc2626]"
          />
          {{
            armedCard === 'A:red'
              ? `Tap again — point to ${otherOf('A')}`
              : `Red · ${nameOf('A')}`
          }}
        </Button>
        <Button
          :variant="armedCard === 'B:red' ? 'destructive' : 'outline'"
          size="sm"
          class="h-auto py-2 whitespace-normal"
          @click="tapPenalty('B', 'red')"
        >
          <span
            v-if="armedCard !== 'B:red'"
            class="size-3 shrink-0 rounded-[2px] bg-[#dc2626]"
          />
          {{
            armedCard === 'B:red'
              ? `Tap again — point to ${otherOf('B')}`
              : `Red · ${nameOf('B')}`
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
          <span
            v-if="armedCard !== 'A:black'"
            class="size-3 shrink-0 rounded-[2px] bg-foreground"
          />
          {{
            armedCard === 'A:black'
              ? `Tap again — DQ ${nameOf('A')}`
              : `Black · ${nameOf('A')}`
          }}
        </Button>
        <Button
          :variant="armedCard === 'B:black' ? 'destructive' : 'outline'"
          size="sm"
          class="h-auto py-2 whitespace-normal"
          @click="tapPenalty('B', 'black')"
        >
          <span
            v-if="armedCard !== 'B:black'"
            class="size-3 shrink-0 rounded-[2px] bg-foreground"
          />
          {{
            armedCard === 'B:black'
              ? `Tap again — DQ ${nameOf('B')}`
              : `Black · ${nameOf('B')}`
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
          <Flag class="size-4 text-team-a" />
          <span class="flex-1 text-left">
            <span class="block text-sm font-semibold"
              >Walkover · {{ nameOf('A') }} wins</span
            >
            <span class="block text-[11px] text-fg-subtle font-normal"
              >{{ nameOf('B') }} didn't show</span
            >
          </span>
          <span>›</span>
        </Button>
        <Button
          variant="outline"
          class="h-auto justify-start gap-3 p-3 whitespace-normal"
          @click="emit('walkover', 'B')"
        >
          <Flag class="size-4 text-team-b" />
          <span class="flex-1 text-left">
            <span class="block text-sm font-semibold"
              >Walkover · {{ nameOf('B') }} wins</span
            >
            <span class="block text-[11px] text-fg-subtle font-normal"
              >{{ nameOf('A') }} didn't show</span
            >
          </span>
          <span>›</span>
        </Button>
        <Button
          variant="outline"
          class="h-auto justify-start gap-3 p-3 whitespace-normal"
          @click="emit('retirement', 'A')"
        >
          <XCircle class="size-4 text-team-a" />
          <span class="flex-1 text-left">
            <span class="block text-sm font-semibold"
              >Retirement · {{ nameOf('A') }}</span
            >
            <span class="block text-[11px] text-fg-subtle font-normal"
              >{{ nameOf('A') }} injured · {{ nameOf('B') }} wins</span
            >
          </span>
          <span>›</span>
        </Button>
        <Button
          variant="outline"
          class="h-auto justify-start gap-3 p-3 whitespace-normal"
          @click="emit('retirement', 'B')"
        >
          <XCircle class="size-4 text-team-b" />
          <span class="flex-1 text-left">
            <span class="block text-sm font-semibold"
              >Retirement · {{ nameOf('B') }}</span
            >
            <span class="block text-[11px] text-fg-subtle font-normal"
              >{{ nameOf('B') }} injured · {{ nameOf('A') }} wins</span
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
          v-if="props.gamesToWin > 1"
          :variant="confirmResetGame ? 'destructive' : 'outline'"
          size="sm"
          class="w-full"
          @click="onResetGameTap"
        >
          {{
            confirmResetGame
              ? 'Tap again — current game back to 0–0'
              : 'Reset current game to 0–0'
          }}
        </Button>
        <Button
          :variant="confirmReset ? 'destructive' : 'outline'"
          size="sm"
          class="w-full"
          @click="onResetTap"
        >
          {{
            confirmReset
              ? 'Tap again to confirm — clears all events'
              : 'Reset entire match to 0–0'
          }}
        </Button>
      </div>
    </div>
  </div>
</template>
