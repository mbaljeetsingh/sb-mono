<script setup lang="ts">
import { ulid } from "ulid";

definePageMeta({ layout: false });

type SportId = "badminton" | "tennis" | "pickleball" | "table-tennis";

const sport = ref<SportId>("badminton");
const isDoubles = ref(true);

const teamA = ref({ p1: "Priya", p2: "Anu" });
const teamB = ref({ p1: "Karan", p2: "Jay" });

const sports: { id: SportId; label: string; preset: string }[] = [
  { id: "badminton", label: "Badminton", preset: "21pt BWF" },
  { id: "tennis", label: "Tennis", preset: "Best of 3" },
  { id: "pickleball", label: "Pickleball", preset: "11pt classic" },
  { id: "table-tennis", label: "Table tennis", preset: "11pt · BO5" },
];

const formatNames = (t: { p1: string; p2: string }) =>
  isDoubles.value && t.p2 ? `${t.p1} / ${t.p2}` : t.p1;

const createMatch = () => {
  const id = ulid();
  // Persist team names to localStorage so the control page can pick them up.
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(
      `sb:meta:${id}`,
      JSON.stringify({
        sport: sport.value,
        isDoubles: isDoubles.value,
        teamNames: { a: formatNames(teamA.value), b: formatNames(teamB.value) },
      }),
    );
  }
  return navigateTo(`/m/${id}/control`);
};
</script>

<template>
  <div
    class="min-h-screen bg-background text-foreground font-sans flex flex-col"
  >
    <!-- Top bar -->
    <header class="px-4 pt-16 pb-2 flex items-center justify-between">
      <button
        type="button"
        class="size-9 rounded-md hover:bg-surface-2 inline-flex items-center justify-center"
        aria-label="Back"
        @click="navigateTo('/')"
      >
        ←
      </button>
      <span class="font-semibold">New match</span>
      <span class="size-9" />
    </header>

    <main class="flex-1 px-4 pb-32 pt-5 overflow-y-auto">
      <!-- Sport picker -->
      <div
        class="text-[11px] font-semibold tracking-[0.06em] uppercase text-fg-subtle mb-2"
      >
        Sport
      </div>
      <div class="grid grid-cols-2 gap-2 mb-6">
        <button
          v-for="s in sports"
          :key="s.id"
          type="button"
          class="p-3.5 rounded-md text-left flex flex-col gap-2 min-h-[84px] border-[1.5px] transition-colors"
          :class="
            sport === s.id
              ? 'bg-foreground text-background border-foreground'
              : 'bg-surface text-foreground border-border hover:bg-surface-2'
          "
          @click="sport = s.id"
        >
          <span class="text-2xl leading-none">
            {{
              s.id === "badminton"
                ? "🏸"
                : s.id === "tennis"
                  ? "🎾"
                  : s.id === "pickleball"
                    ? "🥎"
                    : "🏓"
            }}
          </span>
          <span>
            <span class="block font-semibold text-[15px]">{{ s.label }}</span>
            <span class="block text-[11px] mt-0.5 opacity-70">{{
              s.preset
            }}</span>
          </span>
        </button>
      </div>

      <!-- Format -->
      <div
        class="text-[11px] font-semibold tracking-[0.06em] uppercase text-fg-subtle mb-2"
      >
        Format
      </div>
      <div class="flex p-1 bg-surface-2 rounded-md gap-0.5 mb-6">
        <button
          type="button"
          class="flex-1 py-2.5 rounded-sm text-sm transition-all"
          :class="
            !isDoubles
              ? 'bg-surface font-semibold shadow-sm'
              : 'bg-transparent font-medium text-foreground/70'
          "
          @click="isDoubles = false"
        >
          Singles
        </button>
        <button
          type="button"
          class="flex-1 py-2.5 rounded-sm text-sm transition-all"
          :class="
            isDoubles
              ? 'bg-surface font-semibold shadow-sm'
              : 'bg-transparent font-medium text-foreground/70'
          "
          @click="isDoubles = true"
        >
          Doubles
        </button>
      </div>

      <!-- Team A -->
      <div
        class="text-[11px] font-semibold tracking-[0.06em] uppercase text-fg-subtle mb-2"
      >
        Team A
      </div>
      <input
        v-model="teamA.p1"
        type="text"
        placeholder="Player 1"
        class="w-full h-11 px-3.5 bg-surface border border-border-strong rounded-md text-[15px] text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
      />
      <input
        v-if="isDoubles"
        v-model="teamA.p2"
        type="text"
        placeholder="Player 2 (doubles)"
        class="w-full h-11 px-3.5 mt-2 bg-surface border border-border-strong rounded-md text-[15px] text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
      />

      <!-- Team B -->
      <div
        class="text-[11px] font-semibold tracking-[0.06em] uppercase text-fg-subtle mt-4 mb-2"
      >
        Team B
      </div>
      <input
        v-model="teamB.p1"
        type="text"
        placeholder="Player 1"
        class="w-full h-11 px-3.5 bg-surface border border-border-strong rounded-md text-[15px] text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
      />
      <input
        v-if="isDoubles"
        v-model="teamB.p2"
        type="text"
        placeholder="Player 2 (doubles)"
        class="w-full h-11 px-3.5 mt-2 bg-surface border border-border-strong rounded-md text-[15px] text-foreground outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/40"
      />

      <button
        type="button"
        class="mt-5 px-0 py-3 bg-transparent border-none text-fg-muted text-[13px] font-medium inline-flex items-center gap-1.5"
      >
        ⚙ Advanced setup
        <span class="text-fg-subtle text-[11px] ml-1"
          >theme · court · round · venue</span
        >
      </button>
    </main>

    <!-- Bottom CTA -->
    <footer
      class="fixed bottom-0 inset-x-0 px-4 py-4 pb-8 bg-background border-t border-border"
    >
      <button
        type="button"
        class="w-full h-12 rounded-md bg-brand text-brand-foreground font-semibold hover:bg-brand-hover transition-colors inline-flex items-center justify-center gap-2"
        @click="createMatch"
      >
        ▶ Create match
      </button>
    </footer>
  </div>
</template>
