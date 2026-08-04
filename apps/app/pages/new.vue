<script setup lang="ts">
import {
  type SportPresetId,
  defaultPresetBySport,
  sportPresets,
} from '@sb/engine';
import { markCreated } from '@sb/layer-app-base/lib/eventStore';
import { Button } from '@sb/layer-ui/components/ui/button';
import { Input } from '@sb/layer-ui/components/ui/input';
import { Label } from '@sb/layer-ui/components/ui/label';
import {
  ToggleGroup,
  ToggleGroupItem,
} from '@sb/layer-ui/components/ui/toggle-group';
import { themes as themeRegistry } from '@sb/themes';
import { useStorage } from '@vueuse/core';
import { ChevronDown, Loader2, Minus, Play, Plus } from 'lucide-vue-next';
import { ulid } from 'ulid';
import { computed, nextTick, ref, watch } from 'vue';
import { toast } from 'vue-sonner';
import LookAndFeelCards from '~/components/match/LookAndFeelCards.vue';
import SportPicker from '~/components/match/SportPicker.vue';
import ThemePickerDialog from '~/components/match/ThemePickerDialog.vue';
import { joinNames } from '~/lib/partner-swap';
import { SPORTS, type SportId } from '~/lib/sports';
import { useUserStore } from '~/stores/user';

useSeoMeta({ title: 'New match' });

type MatchLength = 'single' | 'best-of';

// Pre-generate the match id on form mount. Form fields bind to local refs;
// nothing persists until `createMatch()` upserts a single matches row to
// Supabase and we navigate. Backing out of /new without submitting leaves
// no orphan data anywhere.
const matchId = ref(ulid());

// Format is sticky per browser. Re-picking the same sport / doubles / best-of
// is the single most repeated action in the app — a club scorer runs ten
// doubles matches in an evening — and none of it is match-specific the way the
// names are. Only viable because the format summary now sits at the very top of
// the form: the restored format is the first line you read, and doubles visibly
// turns two name fields into four. Names are deliberately never remembered.
type StoredFormat = {
  sport: SportId;
  isDoubles: boolean;
  formatPreset: SportPresetId;
  matchLength: MatchLength;
  bestOfN: number;
};

const FORMAT_DEFAULTS: StoredFormat = {
  sport: 'badminton',
  isDoubles: false,
  formatPreset: 'badminton-21',
  matchLength: 'single',
  bestOfN: 3,
};

// Spread so the shared default object can't be captured and mutated by the
// composable.
const lastFormat = useStorage<StoredFormat>('sb:last-format', {
  ...FORMAT_DEFAULTS,
});

// Stored values go stale across releases — a sport gets disabled, a preset id
// is renamed. Validate each one back against the registry rather than seeding
// the form with a format the engine can't score.
//
// The `??` is load-bearing despite the non-null type: useStorage only falls
// back to its default when the key is absent or the JSON fails to parse. A
// stored literal `null` parses cleanly to `null`, so without this the first
// property read below would throw during <script setup> and blank the page.
const stored = lastFormat.value ?? FORMAT_DEFAULTS;
const seedSport: SportId = SPORTS.some(
  (s) => s.id === stored.sport && s.enabled
)
  ? stored.sport
  : 'badminton';
const seedPreset: SportPresetId =
  sportPresets[stored.formatPreset]?.sport === seedSport
    ? stored.formatPreset
    : (defaultPresetBySport[seedSport] ?? 'badminton-21');
const seedBestOf =
  Number.isInteger(stored.bestOfN) &&
  stored.bestOfN >= 3 &&
  stored.bestOfN <= 11 &&
  stored.bestOfN % 2 === 1
    ? stored.bestOfN
    : 3;

const sport = ref<SportId>(seedSport);
// TT can't do doubles yet (see supportsDoubles below). This guard is NOT
// redundant with that watcher: `watch` isn't `immediate`, so a restored
// TT-plus-doubles state never transitions and never fires it — and the Type
// toggle is hidden for TT, so the user would be left with four required name
// fields and no control to get back to singles. Unreachable while TT is
// disabled (seedSport only accepts enabled sports), but it has to hold the
// day TT ships.
const isDoubles = ref(
  seedSport === 'table-tennis' ? false : !!stored.isDoubles
);
const formatPreset = ref<SportPresetId>(seedPreset);
const matchLength = ref<MatchLength>(
  stored.matchLength === 'best-of' ? 'best-of' : 'single'
);
const bestOfN = ref<number>(seedBestOf);
const teamA = ref({ p1: '', p2: '' });
const teamB = ref({ p1: '', p2: '' });
const eventName = ref('');
const round = ref('');
const courtLabel = ref('');
// Tournament details are aspirational for most casual users — hide them
// behind a disclosure so the form leads with the essentials. Auto-open if
// a rematch prefill brought any of the three fields back populated.
const showTournamentDetails = ref(false);

// TT doubles uses a 4-player rotation that the shared (BWF) reducer doesn't
// implement. Force singles for TT until a TT-specific reducer ships.
const supportsDoubles = computed(() => sport.value !== 'table-tennis');
watch(supportsDoubles, (ok) => {
  if (!ok) isDoubles.value = false;
});

// When sport changes, snap preset + match length to that sport's natural
// defaults (table tennis → BO5, badminton → Single, etc.).
watch(sport, (s) => {
  formatPreset.value = defaultPresetBySport[s] ?? 'badminton-21';
  const natural = sportPresets[formatPreset.value]!.config.gamesToWin;
  if (natural === 1) {
    matchLength.value = 'single';
  } else {
    matchLength.value = 'best-of';
    bestOfN.value = natural * 2 - 1;
  }
});

// Write the format back on every change, including the rematch prefill below —
// a rematch's format becomes the new sticky default, which is what you want
// when you're running a bracket.
watch([sport, isDoubles, formatPreset, matchLength, bestOfN], () => {
  lastFormat.value = {
    sport: sport.value,
    isDoubles: isDoubles.value,
    formatPreset: formatPreset.value,
    matchLength: matchLength.value,
    bestOfN: bestOfN.value,
  };
});

const gamesToWin = computed(() =>
  matchLength.value === 'single' ? 1 : Math.ceil(bestOfN.value / 2)
);

// Presets within the active sport — sub-toggle when there's a real choice
// (badminton 21/15, pickleball classic/rally).
const presetsInSport = computed(() =>
  Object.values(sportPresets).filter((p) => p.sport === sport.value)
);

// /new uses local refs for theme choice rather than `useThemeChoice` —
// the matches row doesn't exist yet, so there's nothing to sync. Avoids
// a Realtime channel-name collision with /m/[id]'s `useThemeChoice` when
// navigating: both subscribe to `match-theme:{id}` and the source page
// hasn't unmounted yet, so supabase returns the same already-subscribed
// channel and `.on()` errors. The selected values are persisted via the
// `createMatch()` upsert below.
const overlayTheme = ref<string>('broadcast-classic');
const scoreboardTheme = ref<string>('filmable');
const overlayName = computed(
  () => themeRegistry[overlayTheme.value]?.manifest.name ?? '—'
);
const scoreboardName = computed(
  () => themeRegistry[scoreboardTheme.value]?.manifest.name ?? '—'
);
const themeDialogOpen = ref(false);

// Rematch prefill — when ?rematch={sourceMatchId} is present, copy the
// source match's settings into this form. New ULID + new row; the source
// match stays untouched in /matches history.
const route = useRoute();
const supabase = useSupabaseClient();

const rematchSourceId = computed(() => {
  const raw = route.query.rematch;
  return typeof raw === 'string' && raw.length > 0 ? raw : null;
});

const splitPlayers = (joined: string | null | undefined): [string, string] => {
  if (!joined) return ['', ''];
  const parts = joined.split(/\s*\/\s*/);
  return [parts[0] ?? '', parts[1] ?? ''];
};

onMounted(async () => {
  const src = rematchSourceId.value;
  if (!src) return;
  const { data, error } = await supabase
    .from('matches')
    .select(
      'sport_preset, config, is_doubles, players, team_name_a, team_name_b, overlay_theme_id, scoreboard_theme_id, event_name, round, court_label'
    )
    .eq('id', src)
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
    matchLength.value = 'single';
  } else {
    matchLength.value = 'best-of';
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
    teamA.value = { p1: players.a1 ?? '', p2: players.a2 ?? '' };
    teamB.value = { p1: players.b1 ?? '', p2: players.b2 ?? '' };
  } else {
    const [a1] = splitPlayers(data.team_name_a);
    const [b1] = splitPlayers(data.team_name_b);
    teamA.value = { p1: a1 || players.a1 || '', p2: '' };
    teamB.value = { p1: b1 || players.b1 || '', p2: '' };
  }
  overlayTheme.value = data.overlay_theme_id ?? 'broadcast-classic';
  scoreboardTheme.value = data.scoreboard_theme_id ?? 'filmable';
  eventName.value = data.event_name ?? '';
  round.value = data.round ?? '';
  courtLabel.value = data.court_label ?? '';
  if (eventName.value || round.value || courtLabel.value) {
    showTournamentDetails.value = true;
  }
});

// Seeds `team_name_a/b` alongside the `players` column. Both must encode the
// same order — themes fall back to splitting this string when `players` is
// absent, so a mismatch shows the wrong partner as server. Shared helper
// rather than a local template literal, so /new, SettingsSheet and /control's
// partner swap can't drift apart on the separator.
const formatNames = (t: { p1: string; p2: string }) =>
  isDoubles.value ? joinNames(t.p1, t.p2) : t.p1.trim();

// Format is collapsed behind a summary by default. Every field in it has a
// sensible default (sport → badminton-21 → single game), while the player names
// are the only required input — so the form now leads with the names and keeps
// format one tap away instead of making the user scroll past four toggle groups
// to reach the fields that actually gate the submit button.
const showFormat = ref(false);

const formatSummary = computed(() => {
  const sportLabel = SPORTS.find((s) => s.id === sport.value)?.label ?? '';
  const points = sportPresets[formatPreset.value]?.config.pointsPerGame;
  const length =
    matchLength.value === 'single' ? 'single game' : `best of ${bestOfN.value}`;
  return [
    sportLabel,
    points ? `${points} pt` : null,
    isDoubles.value ? 'doubles' : 'singles',
    length,
  ]
    .filter(Boolean)
    .join(' · ');
});

// Use the user store (hydrated by the global auth middleware) rather than
// useSupabaseUser() — the latter can lag on first paint and result in
// owner_id=null even when the user is signed in.
const userStore = useUserStore();

// Persist meta + format + create the matches row, then navigate. This is the
// only writer to the `matches` row — no lazy-create path elsewhere. If this
// upsert fails, no scoring surface should be able to backfill the row.
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

const isCreating = ref(false);
const createMatch = async () => {
  if (!canCreate.value || isCreating.value) return;
  isCreating.value = true;
  const { error } = await supabase.from('matches').upsert(
    {
      id: matchId.value,
      owner_id: userStore.currentUser?.id ?? null,
      sport_family: 'racquet',
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
    { onConflict: 'id' }
  );
  if (error) {
    console.warn('[/new] match upsert failed', error);
    // /new is the only writer of `matches` rows, so a failure here would
    // leave the user on a control page that can't sync any scoring (no
    // matching row in Supabase, no lazy-create fallback). Bail out and let
    // them retry instead of silently landing in a half-broken state.
    isCreating.value = false;
    toast.error("Couldn't create match. Check your connection and try again.");
    return;
  }
  // Claim the match for this device *before* navigating. `/matches` and the
  // home "Continue scoring" card both list `sb:scored:*`, which until now was
  // only written by the first score tap — so a match created and abandoned
  // before the first rally was invisible everywhere in the UI. Awaited so a
  // fast navigation can't cancel the IDB write.
  //
  // Caught, never thrown: the Supabase row above is the source of truth and
  // this key is local bookkeeping. If IDB is unavailable (Safari private mode,
  // some in-app webviews, quota) an unhandled rejection here would skip
  // navigateTo and leave the operator stuck on a "Creating…" button for a match
  // that was in fact created.
  await markCreated(matchId.value).catch((err) => {
    console.warn('[/new] local match registration failed', err);
  });
  navigateTo(`/m/${matchId.value}`);
};
</script>

<template>
  <!-- Form column, not full width. The page inherits the layout's max-w-6xl,
       which stretched a player-name field across 1150px on a laptop; a form
       this short reads as one column at any size. -->
  <div class="mx-auto flex w-full max-w-xl flex-col font-sans">
    <!-- text-2xl/tracking-tight is the shared page-title scale (/matches,
         /profile) — this page was the odd one out at text-xl. -->
    <h1 class="px-4 pt-6 pb-3 text-2xl font-semibold tracking-tight">
      New match
    </h1>

    <main class="flex-1 px-4 pb-48 pt-2 space-y-6 md:pb-6">
      <!-- Format sits above the names, collapsed behind a one-line summary.
           Every field in here has a good default (badminton, 21 BWF, singles,
           single game) so it costs one row, not a scroll — but it has to come
           first because Singles/Doubles decides the *shape* of the name fields
           below (two inputs vs four, "Player 1" vs "Team A", and two more
           required names). Putting it after meant flipping to doubles reflowed
           fields the user had already filled and knocked the submit button back
           to disabled. -->
      <section>
        <button
          type="button"
          class="flex w-full items-center justify-between gap-3 rounded-md py-1 text-left"
          :aria-expanded="showFormat"
          aria-controls="match-format"
          @click="showFormat = !showFormat"
        >
          <span class="min-w-0">
            <span
              class="block text-[11px] font-semibold tracking-[0.06em] uppercase text-fg-subtle"
            >
              Format
            </span>
            <span class="mt-0.5 block truncate text-sm font-medium">
              {{ formatSummary }}
            </span>
          </span>
          <ChevronDown
            class="size-4 shrink-0 text-fg-subtle transition-transform"
            :class="showFormat ? 'rotate-180' : ''"
          />
        </button>
        <div v-if="showFormat" id="match-format" class="mt-3 space-y-6">
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
              @update:model-value="
                (v) => v && (formatPreset = v as SportPresetId)
              "
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
                    p.id === 'badminton-15'
                      ? '(2027)'
                      : p.id === 'badminton-21'
                        ? 'BWF'
                        : p.id === 'pickleball-rally'
                          ? 'rally'
                          : 'classic'
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
                  {{ gamesToWin === 1 ? 'game' : 'games' }}
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
        </div>
      </section>

      <section>
        <Label
          for="team-a-p1"
          class="text-[11px] font-semibold tracking-[0.06em] uppercase text-fg-subtle mb-2 block"
        >
          {{ isDoubles ? 'Team A' : 'Player 1' }}
        </Label>
        <Input
          id="team-a-p1"
          v-model="teamA.p1"
          type="text"
          :placeholder="isDoubles ? 'Player 1' : 'Name'"
          :aria-label="isDoubles ? 'Team A player 1' : undefined"
          class="h-11"
        />
        <!-- The section <Label> points at p1, so in doubles the partner field
             would otherwise reach a screen reader as an unlabelled textbox
             ("edit text" with only the visual placeholder to go on). -->
        <Input
          v-if="isDoubles"
          id="team-a-p2"
          v-model="teamA.p2"
          type="text"
          placeholder="Player 2"
          aria-label="Team A player 2"
          class="h-11 mt-2"
        />
      </section>

      <section>
        <Label
          for="team-b-p1"
          class="text-[11px] font-semibold tracking-[0.06em] uppercase text-fg-subtle mb-2 block"
        >
          {{ isDoubles ? 'Team B' : 'Player 2' }}
        </Label>
        <Input
          id="team-b-p1"
          v-model="teamB.p1"
          type="text"
          :placeholder="isDoubles ? 'Player 1' : 'Name'"
          :aria-label="isDoubles ? 'Team B player 1' : undefined"
          class="h-11"
        />
        <Input
          v-if="isDoubles"
          id="team-b-p2"
          v-model="teamB.p2"
          type="text"
          placeholder="Player 2"
          aria-label="Team B player 2"
          class="h-11 mt-2"
        />
      </section>

      <section>
        <button
          type="button"
          class="flex w-full items-center justify-between rounded-md py-1 text-[11px] font-semibold tracking-[0.06em] uppercase text-fg-subtle hover:text-foreground"
          :aria-expanded="showTournamentDetails"
          aria-controls="tournament-details"
          @click="showTournamentDetails = !showTournamentDetails"
        >
          <span>Tournament details (optional)</span>
          <ChevronDown
            class="size-4 transition-transform"
            :class="showTournamentDetails ? 'rotate-180' : ''"
          />
        </button>
        <div v-if="showTournamentDetails" id="tournament-details" class="mt-2">
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
        </div>
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

    <!-- Mobile: anchored to the bottom edge and padded to clear the tab bar,
         rather than floated 3.5rem up. MobileTabBar is a detached pill that
         hides on scroll-down (MobileTabBar.vue:152); with the old offset this
         footer kept its gap and left a strip of scrolling page content visible
         below it, and it overlapped the bar's top edge while shown. Padding =
         0.75rem bar gap + 3.5rem bar height + breathing room.
         Desktop: there is no tab bar to clear and the form is short, so the
         CTA rejoins the flow instead of floating full-bleed across a mostly
         empty viewport. -->
    <footer
      class="fixed inset-x-0 bottom-0 px-4 pt-4 pb-[calc(4.75rem+env(safe-area-inset-bottom))] bg-background border-t border-border md:static md:border-t-0 md:px-4 md:pt-2 md:pb-10"
    >
      <!-- Secondary while incomplete. `disabled` alone is opacity-only, so the
           blocked CTA still rendered as a full brand-green fill — the loudest
           thing on the page, and it reads as tappable right up until you tap
           it. The variant swap makes "not yet" visible at a glance, and the
           label already says what's missing. -->
      <Button
        type="button"
        size="lg"
        :variant="canCreate ? 'default' : 'secondary'"
        class="w-full h-12 text-base font-semibold"
        :disabled="!canCreate || isCreating"
        @click="createMatch"
      >
        <Loader2 v-if="isCreating" class="size-4 animate-spin" />
        <Play v-else class="size-4" />
        {{
          isCreating
            ? 'Creating…'
            : canCreate
              ? 'Create match'
              : isDoubles
                ? 'Enter team names to continue'
                : 'Enter player names to continue'
        }}
      </Button>
    </footer>
  </div>
</template>
