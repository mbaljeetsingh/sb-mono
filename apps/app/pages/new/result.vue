<script setup lang="ts">
import { ulid } from "ulid";

definePageMeta({ layout: false });

type SportId = "badminton" | "tennis" | "pickleball" | "table-tennis";

const sport = ref<SportId>("badminton");
const teamA = ref("Priya / Anu");
const teamB = ref("Karan / Jay");

type GameRow = { a: string; b: string };
const games = ref<GameRow[]>([
  { a: "21", b: "17" },
  { a: "18", b: "21" },
  { a: "21", b: "13" },
]);

const sports: { id: SportId; label: string }[] = [
  { id: "badminton", label: "Badminton" },
  { id: "tennis", label: "Tennis" },
  { id: "pickleball", label: "Pickleball" },
  { id: "table-tennis", label: "Table tennis" },
];

const gameWinner = (g: GameRow): "a" | "b" | null => {
  const a = parseInt(g.a, 10);
  const b = parseInt(g.b, 10);
  if (Number.isNaN(a) || Number.isNaN(b)) return null;
  if (a === b) return null;
  return a > b ? "a" : "b";
};

const validation = computed(() => {
  const errors: { game: number; reason: string }[] = [];
  games.value.forEach((g, i) => {
    const a = parseInt(g.a, 10);
    const b = parseInt(g.b, 10);
    if (g.a === "" && g.b === "") return;
    if (Number.isNaN(a) || Number.isNaN(b)) return;
    if (a > 30 || b > 30) {
      errors.push({
        game: i + 1,
        reason: `${a}–${b} isn't possible (max 30 with 2-point cap).`,
      });
    }
  });
  return errors;
});

const isInvalid = computed(() => validation.value.length > 0);

const winner = computed(() => {
  let aWins = 0;
  let bWins = 0;
  for (const g of games.value) {
    const w = gameWinner(g);
    if (w === "a") aWins++;
    else if (w === "b") bWins++;
  }
  if (aWins === 0 && bWins === 0) return null;
  return {
    side: aWins > bWins ? "a" : "b",
    name: aWins > bWins ? teamA.value : teamB.value,
    score: aWins > bWins ? `${aWins}–${bWins}` : `${bWins}–${aWins}`,
  };
});

const canSave = computed(
  () =>
    !isInvalid.value &&
    teamA.value.trim() !== "" &&
    teamB.value.trim() !== "" &&
    winner.value !== null,
);

const addGame = () => games.value.push({ a: "", b: "" });

const save = () => {
  if (!canSave.value) return;
  const id = ulid();
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(
      `sb:meta:${id}`,
      JSON.stringify({
        sport: sport.value,
        teamNames: { a: teamA.value, b: teamB.value },
        kind: "result-only",
      }),
    );
    // Encode the result as a single result.recorded-style event payload.
    const payload = games.value
      .filter((g) => g.a !== "" && g.b !== "")
      .map((g) => ({ a: parseInt(g.a, 10), b: parseInt(g.b, 10) }));
    localStorage.setItem(`sb:result:${id}`, JSON.stringify(payload));
  }
  return navigateTo(`/m/${id}/saved`);
};
</script>

<template>
  <div
    class="min-h-screen bg-background text-foreground font-sans flex flex-col"
  >
    <header class="px-4 pt-16 pb-2 flex items-center justify-between">
      <button
        type="button"
        class="size-9 rounded-md hover:bg-surface-2 inline-flex items-center justify-center"
        aria-label="Back"
        @click="navigateTo('/')"
      >
        ←
      </button>
      <span class="font-semibold">Log a result</span>
      <span class="size-9" />
    </header>

    <main class="flex-1 px-4 pb-32 pt-2 overflow-y-auto">
      <p class="text-sm text-fg-muted mb-5">
        For matches you've already played. Stays in your browser unless you
        create an account later.
      </p>

      <!-- Sport -->
      <div
        class="text-[11px] font-semibold tracking-[0.06em] uppercase text-fg-subtle mb-2"
      >
        Sport
      </div>
      <div class="grid grid-cols-2 gap-2 mb-5">
        <button
          v-for="s in sports"
          :key="s.id"
          type="button"
          class="px-3.5 py-3 rounded-md text-sm font-medium border transition-colors"
          :class="
            sport === s.id
              ? 'bg-foreground text-background border-foreground'
              : 'bg-surface text-foreground border-border hover:bg-surface-2'
          "
          @click="sport = s.id"
        >
          {{ s.label }}
        </button>
      </div>

      <!-- Teams -->
      <div class="grid grid-cols-2 gap-3 mb-5">
        <div>
          <div
            class="text-[11px] font-semibold tracking-[0.06em] uppercase text-fg-subtle mb-2"
          >
            Team A
          </div>
          <input
            v-model="teamA"
            type="text"
            placeholder="Name(s)"
            class="w-full h-11 px-3.5 bg-surface border border-border-strong rounded-md text-[15px] text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
          />
        </div>
        <div>
          <div
            class="text-[11px] font-semibold tracking-[0.06em] uppercase text-fg-subtle mb-2"
          >
            Team B
          </div>
          <input
            v-model="teamB"
            type="text"
            placeholder="Name(s)"
            class="w-full h-11 px-3.5 bg-surface border border-border-strong rounded-md text-[15px] text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
          />
        </div>
      </div>

      <!-- Game scores -->
      <div
        class="text-[11px] font-semibold tracking-[0.06em] uppercase text-fg-subtle mb-2"
      >
        Game scores
      </div>
      <div class="flex flex-col gap-2 mb-3">
        <div v-for="(g, i) in games" :key="i" class="flex items-center gap-2">
          <div
            class="w-8 text-[11px] font-semibold text-fg-subtle uppercase tracking-wide"
          >
            G{{ i + 1 }}
          </div>
          <div class="flex-1 relative">
            <input
              v-model="g.a"
              type="number"
              placeholder="0"
              inputmode="numeric"
              class="w-full h-11 text-center font-mono text-lg font-semibold tabular-nums bg-surface rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              :class="
                gameWinner(g) === 'a'
                  ? 'border-[1.5px] border-success'
                  : 'border border-border-strong'
              "
            />
            <span
              v-if="gameWinner(g) === 'a'"
              class="absolute -top-1.5 -right-1.5 size-4 rounded-full bg-success text-white text-[10px] inline-flex items-center justify-center"
            >
              ✓
            </span>
          </div>
          <span class="text-fg-muted">—</span>
          <div class="flex-1 relative">
            <input
              v-model="g.b"
              type="number"
              placeholder="0"
              inputmode="numeric"
              class="w-full h-11 text-center font-mono text-lg font-semibold tabular-nums bg-surface rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/40"
              :class="
                gameWinner(g) === 'b'
                  ? 'border-[1.5px] border-success'
                  : 'border border-border-strong'
              "
            />
            <span
              v-if="gameWinner(g) === 'b'"
              class="absolute -top-1.5 -right-1.5 size-4 rounded-full bg-success text-white text-[10px] inline-flex items-center justify-center"
            >
              ✓
            </span>
          </div>
        </div>
      </div>

      <button
        v-if="games.length < 5"
        type="button"
        class="text-[13px] text-fg-muted font-medium inline-flex items-center gap-1"
        @click="addGame"
      >
        + Add another game
      </button>

      <!-- Validation -->
      <div
        v-if="isInvalid"
        class="mt-3 p-3 rounded-md bg-danger-soft text-danger text-[13px] flex gap-2 items-start"
      >
        <span>⚠</span>
        <span>
          <strong>G{{ validation[0]?.game }}:</strong>
          {{ validation[0]?.reason }}
        </span>
      </div>

      <!-- Winner detection -->
      <div
        v-else-if="winner"
        class="mt-3 px-3.5 py-3 rounded-md bg-success-soft text-success text-[13px] flex gap-2.5 items-center"
      >
        <span>🏆</span>
        <span
          ><strong>{{ winner.name }}</strong> won {{ winner.score }}.</span
        >
      </div>
    </main>

    <footer
      class="fixed bottom-0 inset-x-0 px-4 py-4 pb-8 bg-background border-t border-border flex gap-2.5"
    >
      <button
        type="button"
        class="flex-1 h-11 rounded-md bg-transparent text-foreground font-medium hover:bg-surface-2"
        @click="navigateTo('/')"
      >
        Cancel
      </button>
      <button
        type="button"
        class="flex-[2] h-11 rounded-md bg-brand text-brand-foreground font-semibold disabled:opacity-50 hover:bg-brand-hover transition-colors inline-flex items-center justify-center gap-2"
        :disabled="!canSave"
        @click="save"
      >
        💾 Save &amp; share
      </button>
    </footer>
  </div>
</template>
