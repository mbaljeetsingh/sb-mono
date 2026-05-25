<script setup lang="ts">
// Pre-match toss sheet. Shown once on first mount of /control when /new set
// the `sb:toss-pending:{matchId}` flag. Operator captures BWF-correct toss
// outcome: who won, what they chose (serve vs. receive), and in doubles
// which partner starts serving / receiving. On commit, the parent rewrites
// match.start with the chosen serverSide + serverCourt + (doubles) swaps
// matchMeta.players so the starting server / receiver land on the right
// court. "Side" isn't asked — the operator's existing swap-sides button on
// /control handles end choice (visual-only; doesn't affect engine state).
//
// Polish notes: full-screen modal (this is a courtside ritual — phone held
// up to players); single-step picker per choice (no carousel/wizard chrome);
// step transition is a short fade+slide so it feels like a hand-off, not a
// form. Reduced-motion users get the transition collapsed to a plain swap.

import { computed, ref } from "vue";
import { ArrowRight, Coins, Send, Shield } from "lucide-vue-next";
import { Button } from "@sb/layer-ui/components/ui/button";
import type { SideId } from "@sb/engine";

const props = defineProps<{
  isDoubles: boolean;
  teamNames: { a: string; b: string };
  players: { a1: string; a2: string; b1: string; b2: string };
}>();

const emit = defineEmits<{
  (
    e: "commit",
    payload: {
      tossWinner: SideId;
      choice: "serve" | "receive";
      serverSide: SideId;
      startingServerSlot?: 1 | 2;
      startingReceiverSlot?: 1 | 2;
    },
  ): void;
  (e: "skip"): void;
}>();

type Step = "winner" | "choice" | "server-slot" | "receiver-slot";
const step = ref<Step>("winner");
const tossWinner = ref<SideId | null>(null);
const choice = ref<"serve" | "receive" | null>(null);
const startingServerSlot = ref<1 | 2 | null>(null);

// Derived: the team that serves first. If toss winner picked "serve", that's
// them; if "receive", it's the other team. Used to label step 3 / 4.
const servingSide = computed<SideId | null>(() => {
  if (!tossWinner.value || !choice.value) return null;
  if (choice.value === "serve") return tossWinner.value;
  return tossWinner.value === "A" ? "B" : "A";
});

const receivingSide = computed<SideId | null>(() => {
  if (!servingSide.value) return null;
  return servingSide.value === "A" ? "B" : "A";
});

const servingTeamName = computed(() =>
  servingSide.value === "A"
    ? props.teamNames.a || "Team A"
    : props.teamNames.b || "Team B",
);
const receivingTeamName = computed(() =>
  receivingSide.value === "A"
    ? props.teamNames.a || "Team A"
    : props.teamNames.b || "Team B",
);

const winnerTeamName = computed(() =>
  tossWinner.value === "A"
    ? props.teamNames.a || "Team A"
    : props.teamNames.b || "Team B",
);

// Player labels for the partner-pick steps. Falls back to "Player 1/2" if a
// name is missing (shouldn't happen — /new requires all four in doubles).
const servingPlayers = computed(() => {
  if (servingSide.value === "A") {
    return {
      p1: props.players.a1 || "Player 1",
      p2: props.players.a2 || "Player 2",
    };
  }
  return {
    p1: props.players.b1 || "Player 1",
    p2: props.players.b2 || "Player 2",
  };
});
const receivingPlayers = computed(() => {
  if (receivingSide.value === "A") {
    return {
      p1: props.players.a1 || "Player 1",
      p2: props.players.a2 || "Player 2",
    };
  }
  return {
    p1: props.players.b1 || "Player 1",
    p2: props.players.b2 || "Player 2",
  };
});

const pickWinner = (side: SideId) => {
  tossWinner.value = side;
  step.value = "choice";
};

const pickChoice = (c: "serve" | "receive") => {
  choice.value = c;
  if (props.isDoubles) {
    step.value = "server-slot";
  } else {
    commit();
  }
};

const pickServerSlot = (slot: 1 | 2) => {
  startingServerSlot.value = slot;
  step.value = "receiver-slot";
};

const pickReceiverSlot = (slot: 1 | 2) => {
  if (!tossWinner.value || !choice.value || !servingSide.value) return;
  emit("commit", {
    tossWinner: tossWinner.value,
    choice: choice.value,
    serverSide: servingSide.value,
    startingServerSlot: startingServerSlot.value ?? 1,
    startingReceiverSlot: slot,
  });
};

const commit = () => {
  if (!tossWinner.value || !choice.value || !servingSide.value) return;
  emit("commit", {
    tossWinner: tossWinner.value,
    choice: choice.value,
    serverSide: servingSide.value,
  });
};

const back = () => {
  if (step.value === "choice") {
    step.value = "winner";
    tossWinner.value = null;
  } else if (step.value === "server-slot") {
    step.value = "choice";
    choice.value = null;
  } else if (step.value === "receiver-slot") {
    step.value = "server-slot";
    startingServerSlot.value = null;
  }
};

const onSkip = () => emit("skip");

// Step number for the progress dots. Singles has 2 steps, doubles has 4.
const totalSteps = computed(() => (props.isDoubles ? 4 : 2));
const currentStepIndex = computed(() => {
  if (step.value === "winner") return 0;
  if (step.value === "choice") return 1;
  if (step.value === "server-slot") return 2;
  return 3;
});
</script>

<template>
  <div
    class="absolute inset-0 z-50 flex items-center justify-center bg-overlay"
  >
    <div
      class="relative w-[min(94%,440px)] overflow-hidden rounded-2xl bg-surface text-foreground shadow-2xl"
    >
      <!-- Header -->
      <div class="flex items-center gap-2 px-5 pt-5 pb-3">
        <Coins class="size-4 text-fg-muted" />
        <span
          class="text-[11px] font-bold tracking-[0.08em] uppercase text-fg-muted"
        >
          Pre-match toss
        </span>
      </div>

      <!-- Progress dots -->
      <div class="flex items-center justify-center gap-1.5 pb-4">
        <span
          v-for="i in totalSteps"
          :key="i"
          class="block h-1 rounded-full transition-all duration-300"
          :class="
            i - 1 === currentStepIndex
              ? 'w-6 bg-foreground'
              : i - 1 < currentStepIndex
                ? 'w-1.5 bg-foreground/60'
                : 'w-1.5 bg-foreground/15'
          "
        />
      </div>

      <!-- Steps -->
      <Transition
        mode="out-in"
        enter-active-class="motion-safe:transition motion-safe:duration-200 motion-safe:ease-out"
        enter-from-class="motion-safe:opacity-0 motion-safe:translate-x-2"
        enter-to-class="opacity-100 translate-x-0"
        leave-active-class="motion-safe:transition motion-safe:duration-150 motion-safe:ease-in"
        leave-from-class="opacity-100 translate-x-0"
        leave-to-class="motion-safe:opacity-0 motion-safe:-translate-x-2"
      >
        <!-- Step 1 — Who won the toss -->
        <div v-if="step === 'winner'" key="winner" class="px-5 pb-5">
          <h2 class="text-center text-[20px] font-semibold mb-1">
            Who won the toss?
          </h2>
          <p class="text-center text-sm text-fg-muted mb-5">
            Flip a coin courtside, then tap the winner.
          </p>
          <div class="flex flex-col gap-3">
            <button
              type="button"
              class="group relative h-20 w-full overflow-hidden rounded-xl border-2 border-border-strong bg-background px-5 text-left transition-all active:scale-[0.98] hover:border-foreground/40"
              @click="pickWinner('A')"
            >
              <span
                class="absolute inset-y-0 left-0 w-1.5"
                :style="{ background: 'var(--color-team-a)' }"
              />
              <div class="flex items-center justify-between pl-3">
                <div class="min-w-0">
                  <div
                    class="text-[10px] font-bold tracking-wider uppercase text-fg-subtle"
                  >
                    Team A
                  </div>
                  <div class="truncate text-lg font-semibold">
                    {{ teamNames.a || "Team A" }}
                  </div>
                </div>
                <ArrowRight
                  class="size-5 text-fg-subtle transition-transform group-hover:translate-x-1 group-active:translate-x-1"
                />
              </div>
            </button>
            <button
              type="button"
              class="group relative h-20 w-full overflow-hidden rounded-xl border-2 border-border-strong bg-background px-5 text-left transition-all active:scale-[0.98] hover:border-foreground/40"
              @click="pickWinner('B')"
            >
              <span
                class="absolute inset-y-0 left-0 w-1.5"
                :style="{ background: 'var(--color-team-b)' }"
              />
              <div class="flex items-center justify-between pl-3">
                <div class="min-w-0">
                  <div
                    class="text-[10px] font-bold tracking-wider uppercase text-fg-subtle"
                  >
                    Team B
                  </div>
                  <div class="truncate text-lg font-semibold">
                    {{ teamNames.b || "Team B" }}
                  </div>
                </div>
                <ArrowRight
                  class="size-5 text-fg-subtle transition-transform group-hover:translate-x-1 group-active:translate-x-1"
                />
              </div>
            </button>
          </div>
        </div>

        <!-- Step 2 — Their choice -->
        <div v-else-if="step === 'choice'" key="choice" class="px-5 pb-5">
          <h2 class="text-center text-[20px] font-semibold mb-1">
            <span
              class="block text-[11px] font-bold tracking-[0.08em] uppercase text-success mb-1.5"
            >
              ✓ {{ winnerTeamName }} won
            </span>
            What did they choose?
          </h2>
          <p class="text-center text-sm text-fg-muted mb-5">
            Serve, or receive first?
          </p>
          <div class="grid grid-cols-2 gap-3">
            <button
              type="button"
              class="flex h-28 flex-col items-center justify-center gap-1 rounded-xl border-2 border-border-strong bg-background transition-all active:scale-[0.97] hover:border-foreground/40"
              @click="pickChoice('serve')"
            >
              <Send class="size-6 text-fg-muted" />
              <span class="text-base font-semibold">Serve</span>
              <span class="text-[11px] text-fg-subtle">Serves first</span>
            </button>
            <button
              type="button"
              class="flex h-28 flex-col items-center justify-center gap-1 rounded-xl border-2 border-border-strong bg-background transition-all active:scale-[0.97] hover:border-foreground/40"
              @click="pickChoice('receive')"
            >
              <Shield class="size-6 text-fg-muted" />
              <span class="text-base font-semibold">Receive</span>
              <span class="text-[11px] text-fg-subtle">Receives first</span>
            </button>
          </div>
        </div>

        <!-- Step 3 — Starting server (doubles only) -->
        <div v-else-if="step === 'server-slot'" key="server" class="px-5 pb-5">
          <h2 class="text-center text-[20px] font-semibold mb-1">
            <span
              class="block text-[11px] font-bold tracking-[0.08em] uppercase text-fg-muted mb-1.5"
            >
              {{ servingTeamName }} serves
            </span>
            Who serves first?
          </h2>
          <p class="text-center text-sm text-fg-muted mb-5">
            Tap the player who'll deliver the first serve.
          </p>
          <div class="flex flex-col gap-3">
            <button
              type="button"
              class="h-16 w-full rounded-xl border-2 border-border-strong bg-background px-5 text-left text-lg font-semibold transition-all active:scale-[0.98] hover:border-foreground/40"
              @click="pickServerSlot(1)"
            >
              {{ servingPlayers.p1 }}
            </button>
            <button
              type="button"
              class="h-16 w-full rounded-xl border-2 border-border-strong bg-background px-5 text-left text-lg font-semibold transition-all active:scale-[0.98] hover:border-foreground/40"
              @click="pickServerSlot(2)"
            >
              {{ servingPlayers.p2 }}
            </button>
          </div>
        </div>

        <!-- Step 4 — Starting receiver (doubles only) -->
        <div
          v-else-if="step === 'receiver-slot'"
          key="receiver"
          class="px-5 pb-5"
        >
          <h2 class="text-center text-[20px] font-semibold mb-1">
            <span
              class="block text-[11px] font-bold tracking-[0.08em] uppercase text-fg-muted mb-1.5"
            >
              {{ receivingTeamName }} receives
            </span>
            Who receives first?
          </h2>
          <p class="text-center text-sm text-fg-muted mb-5">
            Tap the player diagonally across from the server.
          </p>
          <div class="flex flex-col gap-3">
            <button
              type="button"
              class="h-16 w-full rounded-xl border-2 border-border-strong bg-background px-5 text-left text-lg font-semibold transition-all active:scale-[0.98] hover:border-foreground/40"
              @click="pickReceiverSlot(1)"
            >
              {{ receivingPlayers.p1 }}
            </button>
            <button
              type="button"
              class="h-16 w-full rounded-xl border-2 border-border-strong bg-background px-5 text-left text-lg font-semibold transition-all active:scale-[0.98] hover:border-foreground/40"
              @click="pickReceiverSlot(2)"
            >
              {{ receivingPlayers.p2 }}
            </button>
          </div>
        </div>
      </Transition>

      <!-- Footer — back / skip -->
      <div
        class="flex items-center justify-between border-t border-border px-5 py-3"
      >
        <Button
          v-if="step !== 'winner'"
          variant="ghost"
          size="sm"
          class="text-fg-muted"
          @click="back"
        >
          Back
        </Button>
        <span v-else />
        <Button
          variant="ghost"
          size="sm"
          class="text-fg-subtle"
          @click="onSkip"
        >
          Skip toss
        </Button>
      </div>
    </div>
  </div>
</template>
