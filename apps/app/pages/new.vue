<script setup lang="ts">
import { useStorage } from "@vueuse/core";
import { Minus, Play, Plus } from "lucide-vue-next";
import { ulid } from "ulid";
import {
  type SportPresetId,
  defaultPresetBySport,
  sportPresets,
} from "@sb/engine";
import { type ThemeSurface, themes as themeRegistry } from "@sb/themes";
import { Button } from "@sb/layer-ui/components/ui/button";
import { Input } from "@sb/layer-ui/components/ui/input";
import { Label } from "@sb/layer-ui/components/ui/label";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@sb/layer-ui/components/ui/toggle-group";
import ThemePickerDialog from "~/components/match/ThemePickerDialog.vue";

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
// choice afterwards from the match hub. UI lives in ThemePickerDialog (with
// live previews); we just keep the chosen ids here.
const overlayTheme = ref<string>("broadcast-classic");
const scoreboardTheme = ref<string>("filmable");
const themeDialogOpen = ref(false);
const overlayThemeName = computed(
  () => themeRegistry[overlayTheme.value]?.manifest.name ?? "—",
);
const scoreboardThemeName = computed(
  () => themeRegistry[scoreboardTheme.value]?.manifest.name ?? "—",
);
const onPickTheme = ({
  surface,
  id,
}: {
  surface: ThemeSurface;
  id: string;
}) => {
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
      <!-- Sport picker — 2×2 grid of large card-style tiles. We override
           ToggleGroup's default `w-fit + flex` with `w-full + grid` so the
           tiles span the page and lay out as cards (not a connected ribbon
           segmented control like the smaller toggle groups below). -->
      <ToggleGroup
        type="single"
        :model-value="sport"
        variant="outline"
        class="grid grid-cols-2 gap-2 mb-6 w-full"
        @update:model-value="
          (v) => {
            if (v) sport = v as typeof sport;
          }
        "
      >
        <ToggleGroupItem
          v-for="s in sports"
          :key="s.id"
          :value="s.id"
          :disabled="!s.enabled"
          :title="s.enabled ? '' : `${s.label} ships in v1.x`"
          class="h-auto min-h-[120px] flex-col items-start gap-2.5 p-4 whitespace-normal"
        >
          <span class="text-4xl leading-none">
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
          <span class="block w-full text-left">
            <span class="block font-semibold text-base">{{ s.label }}</span>
            <span class="block text-xs mt-0.5 opacity-70">{{ s.preset }}</span>
          </span>
        </ToggleGroupItem>
      </ToggleGroup>

      <!-- Type: Singles / Doubles -->
      <Label
        class="text-[11px] font-semibold tracking-[0.06em] uppercase text-fg-subtle mb-2"
      >
        Type
      </Label>
      <ToggleGroup
        type="single"
        :model-value="isDoubles ? 'doubles' : 'singles'"
        variant="outline"
        class="w-full mb-6"
        @update:model-value="
          (v) => {
            if (v) isDoubles = v === 'doubles';
          }
        "
      >
        <ToggleGroupItem value="singles" class="flex-1"
          >Singles</ToggleGroupItem
        >
        <ToggleGroupItem value="doubles" class="flex-1"
          >Doubles</ToggleGroupItem
        >
      </ToggleGroup>

      <!-- Points per game — preset toggle within the active sport. Hidden for sports
           that ship a single preset (tennis, table tennis); shown only when the user
           has a real choice (badminton 21/15, pickleball classic/rally). -->
      <template v-if="presetsInSport.length > 1">
        <Label
          class="text-[11px] font-semibold tracking-[0.06em] uppercase text-fg-subtle mb-2"
        >
          Points per game
        </Label>
        <ToggleGroup
          type="single"
          :model-value="formatPreset"
          variant="outline"
          class="w-full mb-6"
          @update:model-value="
            (v) => {
              if (v) formatPreset = v as typeof formatPreset;
            }
          "
        >
          <ToggleGroupItem
            v-for="p in presetsInSport"
            :key="p.id"
            :value="p.id"
            class="flex-1"
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
          </ToggleGroupItem>
        </ToggleGroup>
      </template>

      <!-- Match length: single game OR best-of-N. Default = single. -->
      <Label
        class="text-[11px] font-semibold tracking-[0.06em] uppercase text-fg-subtle mb-2"
      >
        Match length
      </Label>
      <ToggleGroup
        type="single"
        :model-value="matchLength"
        variant="outline"
        class="w-full mb-2"
        @update:model-value="
          (v) => {
            if (v) matchLength = v as typeof matchLength;
          }
        "
      >
        <ToggleGroupItem value="single" class="flex-1"
          >Single match</ToggleGroupItem
        >
        <ToggleGroupItem value="best-of" class="flex-1"
          >Best of N</ToggleGroupItem
        >
      </ToggleGroup>
      <!-- Best-of-N stepper, visible only when 'best-of' is selected. -->
      <div
        v-if="matchLength === 'best-of'"
        class="flex items-center gap-3 mb-6 px-1"
      >
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Decrease best-of"
          :disabled="bestOfN <= 3"
          @click="decBestOf"
        >
          <Minus class="size-4" />
        </Button>
        <div class="flex-1 text-center">
          <span class="text-base font-semibold text-foreground">
            Best of {{ bestOfN }}
          </span>
          <span class="block text-[11px] text-fg-subtle mt-0.5">
            first to {{ gamesToWin }} {{ gamesToWin === 1 ? "game" : "games" }}
          </span>
        </div>
        <Button
          type="button"
          variant="outline"
          size="icon"
          aria-label="Increase best-of"
          :disabled="bestOfN >= 11"
          @click="incBestOf"
        >
          <Plus class="size-4" />
        </Button>
      </div>
      <div v-else class="mb-6" />

      <!-- Team A -->
      <Label
        for="team-a-p1"
        class="text-[11px] font-semibold tracking-[0.06em] uppercase text-fg-subtle mb-2"
      >
        Team A
      </Label>
      <Input
        id="team-a-p1"
        v-model="teamA.p1"
        type="text"
        placeholder="Player 1"
        class="h-11"
      />
      <Input
        v-if="isDoubles"
        v-model="teamA.p2"
        type="text"
        placeholder="Player 2 (doubles)"
        class="h-11 mt-2"
      />

      <!-- Team B -->
      <Label
        for="team-b-p1"
        class="text-[11px] font-semibold tracking-[0.06em] uppercase text-fg-subtle mt-4 mb-2"
      >
        Team B
      </Label>
      <Input
        id="team-b-p1"
        v-model="teamB.p1"
        type="text"
        placeholder="Player 1"
        class="h-11"
      />
      <Input
        v-if="isDoubles"
        v-model="teamB.p2"
        type="text"
        placeholder="Player 2 (doubles)"
        class="h-11 mt-2"
      />

      <!-- Look & feel — same card layout as /m/[id]'s hub so the operator
           sees the same shape twice (creation + later edits). Theme card
           opens the preview dialog. Colors card is a placeholder until v1.x
           lands custom team colors. -->
      <div
        class="text-[11px] font-semibold tracking-[0.06em] uppercase text-fg-subtle mt-6 mb-2.5"
      >
        Look &amp; feel
      </div>
      <div class="grid grid-cols-2 gap-2">
        <Button
          type="button"
          variant="outline"
          class="h-auto flex-col items-stretch gap-1.5 p-3 text-left whitespace-normal"
          @click="themeDialogOpen = true"
        >
          <span class="flex justify-between items-center">
            <span
              class="text-[11px] text-fg-subtle tracking-wide uppercase font-semibold"
            >
              🎨 Theme
            </span>
            <span class="text-fg-subtle">›</span>
          </span>
          <span class="block text-sm font-semibold">{{
            overlayThemeName
          }}</span>
          <span class="block text-[10px] text-fg-subtle">
            Scoreboard: {{ scoreboardThemeName }}
          </span>
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled
          class="h-auto flex-col items-stretch gap-1.5 p-3 text-left whitespace-normal"
          title="Custom team colors land in v1.x"
        >
          <span class="flex justify-between items-center">
            <span
              class="text-[11px] text-fg-subtle tracking-wide uppercase font-semibold"
            >
              🖌 Colors
            </span>
            <span class="text-fg-subtle">soon</span>
          </span>
          <span class="text-sm font-semibold inline-flex items-center gap-1.5">
            <span class="size-3.5 rounded-sm bg-team-a" />
            <span class="size-3.5 rounded-sm bg-team-b" />
            Red / Blue
          </span>
        </Button>
      </div>
    </main>

    <ThemePickerDialog
      v-model:open="themeDialogOpen"
      :overlay-theme="overlayTheme"
      :scoreboard-theme="scoreboardTheme"
      @pick="onPickTheme"
    />

    <!-- Bottom CTA -->
    <footer
      class="fixed bottom-0 inset-x-0 px-4 py-4 pb-8 bg-background border-t border-border"
    >
      <Button
        type="button"
        size="lg"
        class="w-full h-12 text-base font-semibold"
        @click="createMatch"
      >
        <Play class="size-4" />
        Create match
      </Button>
    </footer>
  </div>
</template>
