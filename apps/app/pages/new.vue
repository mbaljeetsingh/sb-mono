<script setup lang="ts">
import { useStorage } from "@vueuse/core";
import { ulid } from "ulid";
import {
  type SportPresetId,
  defaultPresetBySport,
  sportPresets,
} from "@sb/engine";
import { type ThemeSurface, themes as themeRegistry } from "@sb/themes";

// Uses default layout (AppHeader). Keep the page contents focused on the form.
useSeoMeta({ title: "New match" });

type SportId = "badminton" | "tennis" | "pickleball" | "table-tennis";
type MatchLength = "single" | "best-of";

// Pre-generate the match id on form mount. The form fields below bind to local
// refs; a single watchEffect syncs them into useStorage refs keyed by this id,
// so each keystroke auto-persists and `/m/[id]` is ready the moment we navigate.
// This also gives the user free crash recovery — if the browser dies mid-form,
// re-opening the same id picks up where they left off.
const matchId = ref(ulid());

const sport = ref<SportId>("badminton");
// Singles by default — most casual matches and demo matches are 1v1; doubles
// is one tap away.
const isDoubles = ref(false);

// Match format: which preset within the chosen sport, and how many games make
// a match. Default = the sport's natural preset. Operator can change all of
// this mid-match from the control surface — the engine recomputes from the
// event log on every reduce.
const formatPreset = ref<SportPresetId>("badminton-21");
const matchLength = ref<MatchLength>("single");
const bestOfN = ref<number>(3); // odd number ≥ 3 — used only when matchLength === 'best-of'

// When the user picks a different sport, snap the preset to that sport's default.
watch(sport, (s) => {
  formatPreset.value = defaultPresetBySport[s] ?? "badminton-21";
  // Snap match length to the preset's natural gamesToWin (so table-tennis
  // defaults to BO5, badminton stays Single, etc.).
  const natural = sportPresets[formatPreset.value]!.config.gamesToWin;
  if (natural === 1) {
    matchLength.value = "single";
  } else {
    matchLength.value = "best-of";
    bestOfN.value = natural * 2 - 1;
  }
});

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

// All four racquet sports ship engine configs in @sb/engine/registry, but only
// badminton is exposed in the /new picker today. Tennis/pickleball/table-tennis
// stay listed (so users see what's coming) but disabled — the engine, control
// surface, and themes need a polish pass before they're ready to ship publicly.
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

// Presets within the active sport — shown as a sub-toggle when a sport has
// more than one preset (currently just pickleball: classic 11 / rally 21).
const presetsInSport = computed(() =>
  Object.values(sportPresets).filter((p) => p.sport === sport.value),
);

// Theme picker. Operator chooses overlay (OBS) + scoreboard (TV) themes here so
// the URLs minted on /m/[id] already carry `?theme=...`. They can change the
// choice afterwards from the match hub. Themes self-declare which surface they
// support via `manifest.supports`; we group them accordingly.
const overlayThemes = computed(() =>
  Object.values(themeRegistry).filter((t) =>
    t.manifest.supports.includes("overlay"),
  ),
);
const scoreboardThemes = computed(() =>
  Object.values(themeRegistry).filter((t) =>
    t.manifest.supports.includes("scoreboard"),
  ),
);
const overlayTheme = ref<string>("broadcast-classic");
const scoreboardTheme = ref<string>("filmable");
const setTheme = (surface: ThemeSurface, id: string) => {
  if (surface === "overlay") overlayTheme.value = id;
  else scoreboardTheme.value = id;
};

const formatNames = (t: { p1: string; p2: string }) =>
  isDoubles.value && t.p2 ? `${t.p1} / ${t.p2}` : t.p1;

// useStorage refs that auto-persist into the same keys /m/[id]/* reads. The
// composable swaps which entry it writes to whenever matchId.value changes,
// so a future "Start over" button just needs to mint a new ULID.
const metaStorage = useStorage(
  computed(() => `sb:meta:${matchId.value}`),
  {} as Record<string, unknown>,
);
const presetStorage = useStorage<SportPresetId>(
  computed(() => `sb:format:preset:${matchId.value}`),
  "badminton-21",
);
const gamesToWinStorage = useStorage<number>(
  computed(() => `sb:format:gamesToWin:${matchId.value}`),
  1,
);
const themeStorage = useStorage(
  computed(() => `sb:theme:${matchId.value}`),
  { overlay: "broadcast-classic", scoreboard: "filmable" },
);

// Single sync edge — every form-state change pushes into the storage refs and
// useStorage handles the localStorage write. `/m/[id]/*` reads via the same
// keys and stays in sync automatically.
watchEffect(() => {
  metaStorage.value = {
    sport: sport.value,
    sportPreset: formatPreset.value,
    isDoubles: isDoubles.value,
    teamNames: { a: formatNames(teamA.value), b: formatNames(teamB.value) },
    players: {
      a1: teamA.value.p1,
      a2: teamA.value.p2,
      b1: teamB.value.p1,
      b2: teamB.value.p2,
    },
  };
  presetStorage.value = formatPreset.value;
  gamesToWinStorage.value = gamesToWin.value;
  themeStorage.value = {
    overlay: overlayTheme.value,
    scoreboard: scoreboardTheme.value,
  };
});

// Land on the match hub so the operator can grab overlay / scoreboard URLs
// before opening control. Hub has a prominent "Open Control" CTA for the
// common case where they just want to score. Storage is already persisted
// (auto-synced on every change), so we just navigate.
const createMatch = () => navigateTo(`/m/${matchId.value}`);
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
          :title="s.enabled ? '' : `${s.label} ships in v1.x`"
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

      <!-- Points per game — preset toggle within the active sport. Hidden for sports
           that ship a single preset (tennis, table tennis); shown only when the user
           has a real choice (badminton 21/15, pickleball classic/rally). -->
      <template v-if="presetsInSport.length > 1">
        <div
          class="text-[11px] font-semibold tracking-[0.06em] uppercase text-fg-subtle mb-2"
        >
          Points per game
        </div>
        <div class="flex p-1 bg-surface-2 rounded-md gap-0.5 mb-6">
          <button
            v-for="p in presetsInSport"
            :key="p.id"
            type="button"
            class="flex-1 py-2.5 rounded-sm text-sm transition-all"
            :class="
              formatPreset === p.id
                ? 'bg-surface font-semibold shadow-sm'
                : 'bg-transparent font-medium text-foreground/70'
            "
            @click="formatPreset = p.id"
          >
            {{ p.config.pointsPerGame }}
            <span class="opacity-60 ml-0.5">{{
              p.id === "badminton-15"
                ? "(2027)"
                : p.id === "badminton-21"
                  ? "BWF"
                  : p.id === "pickleball-rally"
                    ? "rally"
                    : "classic"
            }}</span>
          </button>
        </div>
      </template>

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

      <!-- Themes — pick the look operators see in OBS (overlay) and on the
           venue TV (scoreboard). Both URLs minted by /m/[id] include ?theme=…
           so the choice is portable. Hub picker can override per-match. -->
      <div
        class="text-[11px] font-semibold tracking-[0.06em] uppercase text-fg-subtle mt-6 mb-2"
      >
        Overlay theme
        <span class="font-normal text-fg-subtle">· OBS source</span>
      </div>
      <div class="grid grid-cols-2 gap-2 mb-4">
        <button
          v-for="t in overlayThemes"
          :key="t.manifest.id"
          type="button"
          class="p-3 rounded-md text-left border-[1.5px] transition-colors"
          :class="
            overlayTheme === t.manifest.id
              ? 'bg-foreground text-background border-foreground'
              : 'bg-surface text-foreground border-border hover:bg-surface-2'
          "
          @click="setTheme('overlay', t.manifest.id)"
        >
          <span class="block font-semibold text-[14px]">{{
            t.manifest.name
          }}</span>
          <span class="block text-[11px] mt-0.5 opacity-70 line-clamp-2">{{
            t.manifest.description
          }}</span>
        </button>
      </div>

      <div
        class="text-[11px] font-semibold tracking-[0.06em] uppercase text-fg-subtle mb-2"
      >
        Scoreboard theme
        <span class="font-normal text-fg-subtle">· venue TV / share</span>
      </div>
      <div class="grid grid-cols-2 gap-2">
        <button
          v-for="t in scoreboardThemes"
          :key="t.manifest.id"
          type="button"
          class="p-3 rounded-md text-left border-[1.5px] transition-colors"
          :class="
            scoreboardTheme === t.manifest.id
              ? 'bg-foreground text-background border-foreground'
              : 'bg-surface text-foreground border-border hover:bg-surface-2'
          "
          @click="setTheme('scoreboard', t.manifest.id)"
        >
          <span class="block font-semibold text-[14px]">{{
            t.manifest.name
          }}</span>
          <span class="block text-[11px] mt-0.5 opacity-70 line-clamp-2">{{
            t.manifest.description
          }}</span>
        </button>
      </div>
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
