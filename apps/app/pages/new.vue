<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { Minus, Play, Plus } from "lucide-vue-next";
import { ulid } from "ulid";
import {
  type SportPresetId,
  defaultPresetBySport,
  sportPresets,
} from "@sb/engine";
import { themes as themeRegistry } from "@sb/themes";
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
import { useUserStore } from "~/stores/user";

useSeoMeta({ title: "New match" });

type MatchLength = "single" | "best-of";

// Pre-generate the match id on form mount. Form fields bind to local refs;
// nothing persists until `createMatch()` upserts a single matches row to
// Supabase and we navigate. Backing out of /new without submitting leaves
// no orphan data anywhere.
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

// /new uses local refs for theme choice rather than `useThemeChoice` —
// the matches row doesn't exist yet, so there's nothing to sync. Avoids
// a Realtime channel-name collision with /m/[id]'s `useThemeChoice` when
// navigating: both subscribe to `match-theme:{id}` and the source page
// hasn't unmounted yet, so supabase returns the same already-subscribed
// channel and `.on()` errors. The selected values are persisted via the
// `createMatch()` upsert below.
const overlayTheme = ref<string>("broadcast-classic");
const scoreboardTheme = ref<string>("filmable");
const overlayName = computed(
  () => themeRegistry[overlayTheme.value]?.manifest.name ?? "—",
);
const scoreboardName = computed(
  () => themeRegistry[scoreboardTheme.value]?.manifest.name ?? "—",
);
const themeDialogOpen = ref(false);

// Rematch prefill — when ?rematch={sourceMatchId} is present, copy the
// source match's settings into this form. New ULID + new row; the source
// match stays untouched in /matches history.
const route = useRoute();
const supabase = useSupabaseClient();

const rematchSourceId = computed(() => {
  const raw = route.query.rematch;
  return typeof raw === "string" && raw.length > 0 ? raw : null;
});

const splitPlayers = (joined: string | null | undefined): [string, string] => {
  if (!joined) return ["", ""];
  const parts = joined.split(/\s*\/\s*/);
  return [parts[0] ?? "", parts[1] ?? ""];
};

onMounted(async () => {
  const src = rematchSourceId.value;
  if (!src) return;
  const { data, error } = await supabase
    .from("matches")
    .select(
      "sport_preset, config, is_doubles, players, team_name_a, team_name_b, overlay_theme_id, scoreboard_theme_id, event_name, round, court_label",
    )
    .eq("id", src)
    .maybeSingle();
  if (error || !data) return;

  const preset = data.sport_preset as SportPresetId;
  const entry = sportPresets[preset];
  if (entry) {
    sport.value = entry.sport as SportId;
    // Wait for the sport-watch to fire (it snaps formatPreset + matchLength
    // to that sport's natural defaults) before overwriting with the source
    // match's actual values, so our prefill wins.
    await nextTick();
    formatPreset.value = preset;
  }
  const gw = Number((data.config as { gamesToWin?: number })?.gamesToWin ?? 1);
  if (gw <= 1) {
    matchLength.value = "single";
  } else {
    matchLength.value = "best-of";
    bestOfN.value = gw * 2 - 1;
  }
  isDoubles.value = !!data.is_doubles;
  const players = (data.players ?? {}) as {
    a1?: string;
    a2?: string;
    b1?: string;
    b2?: string;
  };
  if (data.is_doubles) {
    teamA.value = { p1: players.a1 ?? "", p2: players.a2 ?? "" };
    teamB.value = { p1: players.b1 ?? "", p2: players.b2 ?? "" };
  } else {
    const [a1] = splitPlayers(data.team_name_a);
    const [b1] = splitPlayers(data.team_name_b);
    teamA.value = { p1: a1 || players.a1 || "", p2: "" };
    teamB.value = { p1: b1 || players.b1 || "", p2: "" };
  }
  overlayTheme.value = data.overlay_theme_id ?? "broadcast-classic";
  scoreboardTheme.value = data.scoreboard_theme_id ?? "filmable";
  eventName.value = data.event_name ?? "";
  round.value = data.round ?? "";
  courtLabel.value = data.court_label ?? "";
});

const formatNames = (t: { p1: string; p2: string }) =>
  isDoubles.value && t.p2 ? `${t.p1} / ${t.p2}` : t.p1;

// Use the user store (hydrated by the global auth middleware) rather than
// useSupabaseUser() — the latter can lag on first paint and result in
// owner_id=null even when the user is signed in.
const userStore = useUserStore();

// Persist meta + format + create the matches row, then navigate. This is
// the only writer to the `matches` row at match creation — useEvents
// .ensureMatchRow will short-circuit when it finds the row already exists.
// useMatchMeta / useFormat on /m/[id] hydrate from this row across every
// device that opens the URL (OBS overlay on a laptop, co-scorer's phone).
// Names required to create. Singles: 1 name per team. Doubles: 2 per team
// — the cell-level partner-swap UX needs per-player identity to be
// meaningful, so all four are mandatory in that mode. Empty strings get
// trimmed before the check so a single space doesn't count.
const canCreate = computed(() => {
  if (!teamA.value.p1.trim() || !teamB.value.p1.trim()) return false;
  if (isDoubles.value && (!teamA.value.p2.trim() || !teamB.value.p2.trim()))
    return false;
  return true;
});

const createMatch = async () => {
  if (!canCreate.value) return;
  const { error } = await supabase.from("matches").upsert(
    {
      id: matchId.value,
      owner_id: userStore.currentUser?.id ?? null,
      sport_family: "racquet",
      sport_preset: formatPreset.value,
      config: { gamesToWin: gamesToWin.value },
      overlay_theme_id: overlayTheme.value,
      scoreboard_theme_id: scoreboardTheme.value,
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
          {{ isDoubles ? "Team A" : "Player 1" }}
        </Label>
        <Input
          id="team-a-p1"
          v-model="teamA.p1"
          type="text"
          :placeholder="isDoubles ? 'Player 1' : 'Name'"
          class="h-11"
        />
        <Input
          v-if="isDoubles"
          v-model="teamA.p2"
          type="text"
          placeholder="Player 2"
          class="h-11 mt-2"
        />
      </section>

      <section>
        <Label
          for="team-b-p1"
          class="text-[11px] font-semibold tracking-[0.06em] uppercase text-fg-subtle mb-2 block"
        >
          {{ isDoubles ? "Team B" : "Player 2" }}
        </Label>
        <Input
          id="team-b-p1"
          v-model="teamB.p1"
          type="text"
          :placeholder="isDoubles ? 'Player 1' : 'Name'"
          class="h-11"
        />
        <Input
          v-if="isDoubles"
          v-model="teamB.p2"
          type="text"
          placeholder="Player 2"
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
        :disabled="!canCreate"
        @click="createMatch"
      >
        <Play class="size-4" />
        {{
          canCreate
            ? "Create match"
            : isDoubles
              ? "Enter team names to continue"
              : "Enter player names to continue"
        }}
      </Button>
    </footer>
  </div>
</template>
