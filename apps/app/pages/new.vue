<script setup lang="ts">
import { computed, ref, watch, watchEffect } from "vue";
import { useStorage } from "@vueuse/core";
import { Minus, Play, Plus } from "lucide-vue-next";
import { ulid } from "ulid";
import {
  type SportPresetId,
  defaultPresetBySport,
  sportPresets,
} from "@sb/engine";
import { Button } from "@sb/layer-ui/components/ui/button";
import { Input } from "@sb/layer-ui/components/ui/input";
import { Label } from "@sb/layer-ui/components/ui/label";
import {
  ToggleGroup,
  ToggleGroupItem,
} from "@sb/layer-ui/components/ui/toggle-group";
import SportPicker, { type SportId } from "~/components/match/SportPicker.vue";
import LookAndFeelCards from "~/components/match/LookAndFeelCards.vue";
import ThemePickerDialog from "~/components/match/ThemePickerDialog.vue";

useSeoMeta({ title: "New match" });

type MatchLength = "single" | "best-of";

// Pre-generate the match id on form mount. Form fields bind to local refs;
// a watchEffect syncs them into useStorage refs keyed by this id, so each
// keystroke auto-persists and `/m/[id]` is ready the moment we navigate.
// Free crash recovery — re-opening the same id picks up where we left off.
const matchId = ref(ulid());

const sport = ref<SportId>("badminton");
const isDoubles = ref(false);
const formatPreset = ref<SportPresetId>("badminton-21");
const matchLength = ref<MatchLength>("single");
const bestOfN = ref<number>(3);
const teamA = ref({ p1: "", p2: "" });
const teamB = ref({ p1: "", p2: "" });
const eventName = ref("");
const round = ref("");
const courtLabel = ref("");

// TT doubles uses a 4-player rotation that the shared (BWF) reducer doesn't
// implement. Force singles for TT until a TT-specific reducer ships.
const supportsDoubles = computed(() => sport.value !== "table-tennis");
watch(supportsDoubles, (ok) => {
  if (!ok) isDoubles.value = false;
});

// When sport changes, snap preset + match length to that sport's natural
// defaults (table tennis → BO5, badminton → Single, etc.).
watch(sport, (s) => {
  formatPreset.value = defaultPresetBySport[s] ?? "badminton-21";
  const natural = sportPresets[formatPreset.value]!.config.gamesToWin;
  if (natural === 1) {
    matchLength.value = "single";
  } else {
    matchLength.value = "best-of";
    bestOfN.value = natural * 2 - 1;
  }
});

const gamesToWin = computed(() =>
  matchLength.value === "single" ? 1 : Math.ceil(bestOfN.value / 2),
);

// Presets within the active sport — sub-toggle when there's a real choice
// (badminton 21/15, pickleball classic/rally).
const presetsInSport = computed(() =>
  Object.values(sportPresets).filter((p) => p.sport === sport.value),
);

const {
  overlay: overlayTheme,
  scoreboard: scoreboardTheme,
  overlayName,
  scoreboardName,
} = useThemeChoice(matchId);
const themeDialogOpen = ref(false);

const formatNames = (t: { p1: string; p2: string }) =>
  isDoubles.value && t.p2 ? `${t.p1} / ${t.p2}` : t.p1;

// Format selection stays in localStorage for the operator's session — the
// format strip on /control reads from these keys. Cross-device format sync
// (so OBS knows BO3 vs BO5) is a follow-up; today the matches.sport_preset
// column carries enough for themes to render correctly.
const presetStorage = useStorage<SportPresetId>(
  computed(() => `sb:format:preset:${matchId.value}`),
  "badminton-21",
);
const gamesToWinStorage = useStorage<number>(
  computed(() => `sb:format:gamesToWin:${matchId.value}`),
  1,
);

watchEffect(() => {
  presetStorage.value = formatPreset.value;
  gamesToWinStorage.value = gamesToWin.value;
});

const supabase = useSupabaseClient();
const supabaseUser = useSupabaseUser();

// Persist meta + create the matches row, then navigate. This is the only
// writer to the `matches` row at match creation — useEvents.ensureMatchRow
// will short-circuit when it finds the row already exists.
const createMatch = async () => {
  const { error } = await supabase.from("matches").upsert(
    {
      id: matchId.value,
      owner_id: supabaseUser.value?.id ?? null,
      sport_family: "racquet",
      sport_preset: formatPreset.value,
      is_doubles: isDoubles.value,
      team_name_a: formatNames(teamA.value).trim() || null,
      team_name_b: formatNames(teamB.value).trim() || null,
      players: {
        a1: teamA.value.p1.trim(),
        a2: teamA.value.p2.trim(),
        b1: teamB.value.p1.trim(),
        b2: teamB.value.p2.trim(),
      },
      event_name: eventName.value.trim() || null,
      round: round.value.trim() || null,
      court_label: courtLabel.value.trim() || null,
    },
    { onConflict: "id" },
  );
  if (error) console.warn("[/new] match upsert failed", error);
  navigateTo(`/m/${matchId.value}`);
};
</script>

<template>
  <div class="flex flex-col font-sans">
    <h1 class="px-4 pt-6 pb-3 text-xl font-semibold">New match</h1>

    <main class="flex-1 px-4 pb-32 pt-2 space-y-6">
      <section>
        <div
          class="text-[11px] font-semibold tracking-[0.06em] uppercase text-fg-subtle mb-2"
        >
          Sport
        </div>
        <SportPicker v-model="sport" />
      </section>

      <section v-if="supportsDoubles">
        <Label
          class="text-[11px] font-semibold tracking-[0.06em] uppercase text-fg-subtle mb-2 block"
        >
          Type
        </Label>
        <ToggleGroup
          type="single"
          :model-value="isDoubles ? 'doubles' : 'singles'"
          variant="outline"
          class="w-full"
          @update:model-value="(v) => v && (isDoubles = v === 'doubles')"
        >
          <ToggleGroupItem value="singles" class="flex-1">
            Singles
          </ToggleGroupItem>
          <ToggleGroupItem value="doubles" class="flex-1">
            Doubles
          </ToggleGroupItem>
        </ToggleGroup>
      </section>

      <section v-if="presetsInSport.length > 1">
        <Label
          class="text-[11px] font-semibold tracking-[0.06em] uppercase text-fg-subtle mb-2 block"
        >
          Points per game
        </Label>
        <ToggleGroup
          type="single"
          :model-value="formatPreset"
          variant="outline"
          class="w-full"
          @update:model-value="(v) => v && (formatPreset = v as SportPresetId)"
        >
          <ToggleGroupItem
            v-for="p in presetsInSport"
            :key="p.id"
            :value="p.id"
            class="flex-1"
          >
            {{ p.config.pointsPerGame }}
            <span class="opacity-60 ml-0.5">
              {{
                p.id === "badminton-15"
                  ? "(2027)"
                  : p.id === "badminton-21"
                    ? "BWF"
                    : p.id === "pickleball-rally"
                      ? "rally"
                      : "classic"
              }}
            </span>
          </ToggleGroupItem>
        </ToggleGroup>
      </section>

      <section>
        <Label
          class="text-[11px] font-semibold tracking-[0.06em] uppercase text-fg-subtle mb-2 block"
        >
          Match length
        </Label>
        <ToggleGroup
          type="single"
          :model-value="matchLength"
          variant="outline"
          class="w-full mb-2"
          @update:model-value="(v) => v && (matchLength = v as MatchLength)"
        >
          <ToggleGroupItem value="single" class="flex-1">
            Single match
          </ToggleGroupItem>
          <ToggleGroupItem value="best-of" class="flex-1">
            Best of N
          </ToggleGroupItem>
        </ToggleGroup>
        <div
          v-if="matchLength === 'best-of'"
          class="flex items-center gap-3 px-1"
        >
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Decrease best-of"
            :disabled="bestOfN <= 3"
            @click="bestOfN = Math.max(3, bestOfN - 2)"
          >
            <Minus class="size-4" />
          </Button>
          <div class="flex-1 text-center">
            <span class="text-base font-semibold text-foreground">
              Best of {{ bestOfN }}
            </span>
            <span class="block text-[11px] text-fg-subtle mt-0.5">
              first to {{ gamesToWin }}
              {{ gamesToWin === 1 ? "game" : "games" }}
            </span>
          </div>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Increase best-of"
            :disabled="bestOfN >= 11"
            @click="bestOfN = Math.min(11, bestOfN + 2)"
          >
            <Plus class="size-4" />
          </Button>
        </div>
      </section>

      <section>
        <Label
          for="team-a-p1"
          class="text-[11px] font-semibold tracking-[0.06em] uppercase text-fg-subtle mb-2 block"
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
      </section>

      <section>
        <Label
          for="team-b-p1"
          class="text-[11px] font-semibold tracking-[0.06em] uppercase text-fg-subtle mb-2 block"
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
      </section>

      <section>
        <Label
          class="text-[11px] font-semibold tracking-[0.06em] uppercase text-fg-subtle mb-2 block"
        >
          Tournament details (optional)
        </Label>
        <Input
          v-model="eventName"
          type="text"
          placeholder='Event (e.g. "Spring Open")'
          class="h-11"
        />
        <Input
          v-model="round"
          type="text"
          placeholder='Round (e.g. "Quarterfinal")'
          class="h-11 mt-2"
        />
        <Input
          v-model="courtLabel"
          type="text"
          placeholder='Court / table (e.g. "Court 1")'
          class="h-11 mt-2"
        />
      </section>

      <LookAndFeelCards
        :overlay-theme-name="overlayName"
        :scoreboard-theme-name="scoreboardName"
        @open-theme="themeDialogOpen = true"
      />
    </main>

    <ThemePickerDialog
      v-model:open="themeDialogOpen"
      :overlay-theme="overlayTheme"
      :scoreboard-theme="scoreboardTheme"
      @pick="
        ({ surface, id }) => {
          if (surface === 'overlay') overlayTheme = id;
          else scoreboardTheme = id;
        }
      "
    />

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
