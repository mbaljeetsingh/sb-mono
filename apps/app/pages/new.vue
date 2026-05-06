<script setup lang="ts">
import { ulid } from "ulid";

// Uses default layout (AppHeader). Keep the page contents focused on the form.
useSeoMeta({ title: "New match" });

type SportId = "badminton" | "tennis" | "pickleball" | "table-tennis";
type FormatPreset = "badminton-21" | "badminton-15";
type MatchLength = "single" | "best-of";

const sport = ref<SportId>("badminton");
const isDoubles = ref(true);

// Match format: which BWF preset (21pt vs 15pt) and how many games make a match.
// Default = single game (no series). Operator can change these mid-match from
// the control surface too — the engine recomputes from the event log.
// 21-point is current BWF (since 2006). 15-point is the BWF 2027 proposal
// (pending April 2026 vote, effective Jan 2027 if approved). Default tracks
// today's official rule.
const formatPreset = ref<FormatPreset>("badminton-21");
const matchLength = ref<MatchLength>("single");
const bestOfN = ref<number>(3); // odd number ≥ 3 — used only when matchLength === 'best-of'

// gamesToWin derived: single = 1, best-of-N = ceil(N/2) = (N+1)/2 for odd N.
const gamesToWin = computed<number>(() =>
  matchLength.value === "single" ? 1 : Math.ceil(bestOfN.value / 2),
);

const decBestOf = () => {
  bestOfN.value = Math.max(3, bestOfN.value - 2);
};
const incBestOf = () => {
  bestOfN.value = Math.min(11, bestOfN.value + 2);
};

// Empty by default so users see placeholder hints; control surface falls back to
// "Player 1" / "Player 2" labels if names are still blank when they start scoring.
const teamA = ref({ p1: "", p2: "" });
const teamB = ref({ p1: "", p2: "" });

// v1: only badminton ships scoring rules (engine has badminton-21 + badminton-15).
// Other sports stay listed but `enabled: false` until their engine config lands (E1.21).
const sports: {
  id: SportId;
  label: string;
  preset: string;
  enabled: boolean;
}[] = [
  { id: "badminton", label: "Badminton", preset: "21pt BWF", enabled: true },
  { id: "tennis", label: "Tennis", preset: "Coming soon", enabled: false },
  {
    id: "pickleball",
    label: "Pickleball",
    preset: "Coming soon",
    enabled: false,
  },
  {
    id: "table-tennis",
    label: "Table tennis",
    preset: "Coming soon",
    enabled: false,
  },
];

const formatNames = (t: { p1: string; p2: string }) =>
  isDoubles.value && t.p2 ? `${t.p1} / ${t.p2}` : t.p1;

const createMatch = () => {
  const id = ulid();
  // Persist team names + per-player split + format to localStorage so the control
  // surface picks them up on first mount.
  if (typeof localStorage !== "undefined") {
    localStorage.setItem(
      `sb:meta:${id}`,
      JSON.stringify({
        sport: sport.value,
        isDoubles: isDoubles.value,
        teamNames: { a: formatNames(teamA.value), b: formatNames(teamB.value) },
        players: {
          a1: teamA.value.p1,
          a2: teamA.value.p2,
          b1: teamB.value.p1,
          b2: teamB.value.p2,
        },
      }),
    );
    // Match-format key the control surface reads on mount (same key it persists
    // when the operator changes format from the in-match format sheet).
    localStorage.setItem(
      `sb:format:${id}`,
      JSON.stringify({
        preset: formatPreset.value,
        gamesToWin: gamesToWin.value,
      }),
    );
  }
  // Land on the match hub so the operator can grab overlay / scoreboard URLs
  // before opening control. Hub has a prominent "Open Control" CTA for the
  // common case where they just want to score.
  return navigateTo(`/m/${id}`);
};
</script>

<template>
  <div class="flex flex-col font-sans">
    <h1 class="px-4 pt-6 pb-3 text-xl font-semibold">New match</h1>

    <main class="flex-1 px-4 pb-32 pt-2">
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
          :disabled="!s.enabled"
          :title="s.enabled ? '' : `${s.label} engine ships in v1.x (E1.21)`"
          class="p-3.5 rounded-md text-left flex flex-col gap-2 min-h-[84px] border-[1.5px] transition-colors"
          :class="
            !s.enabled
              ? 'bg-surface text-foreground/40 border-border opacity-60 cursor-not-allowed'
              : sport === s.id
                ? 'bg-foreground text-background border-foreground'
                : 'bg-surface text-foreground border-border hover:bg-surface-2'
          "
          @click="s.enabled && (sport = s.id)"
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

      <!-- Type: Singles / Doubles -->
      <div
        class="text-[11px] font-semibold tracking-[0.06em] uppercase text-fg-subtle mb-2"
      >
        Type
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

      <!-- Points per game: 21 BWF / 15 classic -->
      <div
        class="text-[11px] font-semibold tracking-[0.06em] uppercase text-fg-subtle mb-2"
      >
        Points per game
      </div>
      <div class="flex p-1 bg-surface-2 rounded-md gap-0.5 mb-6">
        <button
          type="button"
          class="flex-1 py-2.5 rounded-sm text-sm transition-all"
          :class="
            formatPreset === 'badminton-21'
              ? 'bg-surface font-semibold shadow-sm'
              : 'bg-transparent font-medium text-foreground/70'
          "
          @click="formatPreset = 'badminton-21'"
        >
          21 BWF
        </button>
        <button
          type="button"
          class="flex-1 py-2.5 rounded-sm text-sm transition-all"
          :class="
            formatPreset === 'badminton-15'
              ? 'bg-surface font-semibold shadow-sm'
              : 'bg-transparent font-medium text-foreground/70'
          "
          @click="formatPreset = 'badminton-15'"
        >
          15 (2027)
        </button>
      </div>

      <!-- Match length: single game OR best-of-N. Default = single. -->
      <div
        class="text-[11px] font-semibold tracking-[0.06em] uppercase text-fg-subtle mb-2"
      >
        Match length
      </div>
      <div class="flex p-1 bg-surface-2 rounded-md gap-0.5 mb-2">
        <button
          type="button"
          class="flex-1 py-2.5 rounded-sm text-sm transition-all"
          :class="
            matchLength === 'single'
              ? 'bg-surface font-semibold shadow-sm'
              : 'bg-transparent font-medium text-foreground/70'
          "
          @click="matchLength = 'single'"
        >
          Single match
        </button>
        <button
          type="button"
          class="flex-1 py-2.5 rounded-sm text-sm transition-all"
          :class="
            matchLength === 'best-of'
              ? 'bg-surface font-semibold shadow-sm'
              : 'bg-transparent font-medium text-foreground/70'
          "
          @click="matchLength = 'best-of'"
        >
          Best of N
        </button>
      </div>
      <!-- Best-of-N stepper, visible only when 'best-of' is selected. -->
      <div
        v-if="matchLength === 'best-of'"
        class="flex items-center gap-3 mb-6 px-1"
      >
        <button
          type="button"
          aria-label="Decrease best-of"
          class="size-9 rounded-md border border-border-strong bg-surface text-foreground font-semibold hover:bg-surface-2 disabled:opacity-40 disabled:cursor-not-allowed"
          :disabled="bestOfN <= 3"
          @click="decBestOf"
        >
          −
        </button>
        <div class="flex-1 text-center">
          <span class="text-base font-semibold text-foreground">
            Best of {{ bestOfN }}
          </span>
          <span class="block text-[11px] text-fg-subtle mt-0.5">
            first to {{ gamesToWin }} {{ gamesToWin === 1 ? "game" : "games" }}
          </span>
        </div>
        <button
          type="button"
          aria-label="Increase best-of"
          class="size-9 rounded-md border border-border-strong bg-surface text-foreground font-semibold hover:bg-surface-2 disabled:opacity-40 disabled:cursor-not-allowed"
          :disabled="bestOfN >= 11"
          @click="incBestOf"
        >
          +
        </button>
      </div>
      <div v-else class="mb-6" />

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
