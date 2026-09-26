<script setup lang="ts">
import {
  type SportPresetId,
  defaultPresetBySport,
  formatDetail,
  formatHeadline,
  presetsForSport,
  sportPresets,
  unitNoun,
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
import { ChevronDown, Loader2, Play, SlidersHorizontal } from 'lucide-vue-next';
import { ulid } from 'ulid';
import { computed, nextTick, ref, watch } from 'vue';
import { toast } from 'vue-sonner';
import LookAndFeelCards from '~/components/match/LookAndFeelCards.vue';
import PlayerChips from '~/components/match/PlayerChips.vue';
import SportPicker from '~/components/match/SportPicker.vue';
import ThemePickerDialog from '~/components/match/ThemePickerDialog.vue';
import { joinNames } from '~/lib/partner-swap';
import { namesInPlay } from '~/lib/recent-players';
import {
  SPORTS,
  type SportId,
  isDoublesOnly,
  isSinglesOnly,
  presetCopy,
} from '~/lib/sports';
import { useUserStore } from '~/stores/user';

useSeoMeta({ title: 'New match' });

type MatchLength = 'single' | 'best-of';

// Pre-generate the match id on form mount. Form fields bind to local refs;
// nothing persists until `createMatch()` upserts a single matches row to
// Supabase and we navigate. Backing out of /new without submitting leaves
// no orphan data anywhere.
const matchId = ref(ulid());

// Bootstrap binding for a permanent OBS URL — see the call site in createMatch.
const { autoBindOnCreate: autoBindObsUrl } = useDynamicUrls();

// Format is sticky per browser. Re-picking the same sport / doubles / best-of
// is the single most repeated action in the app — a club scorer runs ten
// doubles matches in an evening — and none of it is match-specific the way the
// names are. Only viable because the format summary now sits at the very top of
// the form: the restored format is the first line you read, and doubles visibly
// turns two name fields into four.
//
// Names are still never *restored into the fields* — every match starts blank,
// because a silently prefilled wrong opponent is worse than typing. They are
// instead offered as tappable chips under each field (`useRecentPlayers` +
// PlayerChips), which is the same club-evening argument as the sticky format
// with the operator still making the choice.
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
// A restored format can contradict the sport's own constraint — padel would
// otherwise be scored as singles, with the Type toggle hidden and no control
// to fix it. (The watcher below also runs immediately, but seeding correctly
// avoids a first render with the wrong number of name fields.)
const isDoubles = ref(
  isDoublesOnly(seedSport)
    ? true
    : isSinglesOnly(seedSport)
      ? false
      : !!stored.isDoubles
);
const formatPreset = ref<SportPresetId>(seedPreset);
const matchLength = ref<MatchLength>(
  stored.matchLength === 'best-of' ? 'best-of' : 'single'
);
const bestOfN = ref<number>(seedBestOf);
const teamA = ref({ p1: '', p2: '' });
const teamB = ref({ p1: '', p2: '' });

// Device-local MRU list of previously used names, surfaced as chips under each
// field. Written in `createMatch()` below, never before — a match that failed
// to create shouldn't seed the list.
// Destructured so `recentNames` is a top-level ref the template unwraps —
// `recentPlayers.names` would reach the template as the Ref itself.
const {
  names: recentNames,
  remember: rememberPlayers,
  remove: removeRecent,
  restore: restoreRecents,
  hintDismissed,
} = useRecentPlayers();

// Undo rather than a confirm dialog. Removal is reversible and low-stakes, and
// a dialog on every prune would cost more than the mistake it prevents — but
// the gesture can misfire (a slow tap reads as a long-press), so there has to
// be a way back.
const onRemoveRecent = (name: string) => {
  const snapshot = removeRecent(name);
  toast(`Removed ${name}`, {
    action: { label: 'Undo', onClick: () => restoreRecents(snapshot) },
  });
};

// Passed to every chip row as `exclude`, this field included. Excluding the
// row's own field is what makes it collapse once that field holds a name the
// list already knows, without any focus tracking (see PlayerChips).
//
// Gated on isDoubles via the shared rule, and that guard is load-bearing
// rather than tidiness: flipping Doubles → Singles hides the two partner
// inputs but never clears their refs. Reading all four unconditionally would
// silently drop those stale partners out of the chip rows, and — since
// createMatch reuses this same array — file them into the recents list as
// players who never played.
const enteredNames = computed(() =>
  namesInPlay(
    isDoubles.value,
    [teamA.value.p1, teamA.value.p2, teamB.value.p1, teamB.value.p2],
    [teamA.value.p1, teamB.value.p1]
  )
);
const eventName = ref('');
const round = ref('');
const courtLabel = ref('');
// Tournament details are aspirational for most casual users — hide them
// behind a disclosure so the form leads with the essentials. Auto-open if
// a rematch prefill brought any of the three fields back populated.
const showTournamentDetails = ref(false);

// Two sports don't get a choice, for opposite reasons. Padel has no singles
// format at all: the court is built for four and FIP publishes no singles
// rules. Squash is modelled as singles only — doubles squash is played on a
// wider court under its own rules. Everything else offers both, table-tennis
// doubles included now that the engine runs its four-player service order.
const supportsSingles = computed(() => !isDoublesOnly(sport.value));
const supportsDoubles = computed(() => !isSinglesOnly(sport.value));
/** Hide the toggle when only one answer is legal for this sport. */
const showTypeToggle = computed(
  () => supportsSingles.value && supportsDoubles.value
);
watch(
  [supportsSingles, supportsDoubles],
  ([singlesOk, doublesOk]) => {
    if (!singlesOk) isDoubles.value = true;
    else if (!doublesOk) isDoubles.value = false;
  },
  { immediate: true }
);

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
// (badminton 21/15, pickleball side-out/rally, tennis official/no-ad/Fast4,
// padel advantage/star/golden point). Official ruleset first, which is also
// the default the sport watcher picks. Three or more wrap to a two-column grid:
// in one row the tiles' two-line captions crushed to unreadable at phone width.
const presetsInSport = computed(() => presetsForSport(sport.value));

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

// Format is out in the open again, as compact controls rather than a
// collapsed summary. Sport decides everything below it (the scoring options,
// whether doubles is even legal, how many name fields there are), so hiding it
// behind a disclosure made the first decision the least visible one.

// Match length as one segmented row, "Best of 1 · 3 · 5 · 7", instead of a
// Single / Best-of-N toggle plus a stepper. 1 is the old "single" format. A
// longer length the sticky format or a rematch brought in (9, 11 — the seed
// accepts up to 11) is added as its own option so it still shows as selected.
const bestOf = computed(() =>
  matchLength.value === 'single' ? 1 : bestOfN.value
);
const bestOfOptions = computed(() =>
  [...new Set([1, 3, 5, 7, bestOf.value])].sort((a, b) => a - b)
);
const setBestOf = (n: number) => {
  if (n <= 1) {
    matchLength.value = 'single';
    return;
  }
  matchLength.value = 'best-of';
  bestOfN.value = n;
};
const bestOfCaption = computed(() =>
  gamesToWin.value === 1
    ? `One ${formatUnit.value}`
    : `First to ${gamesToWin.value} ${formatUnit.value}s`
);

const activeCopy = computed(() => presetCopy[formatPreset.value]);

// ---------------------------------------------------------------------------
// Name fields and the ONE recent-players row
//
// There used to be a chip row under every name field — four identical rows in
// doubles. Now one row fills the ACTIVE field. A field becomes active on focus
// and stays active on blur (tapping a chip blurs the input first, so clearing
// on blur would lose the target); after a pick the next empty field becomes
// active, so tapping chips fills the form in order.
// ---------------------------------------------------------------------------
type Slot = 'a1' | 'a2' | 'b1' | 'b2';
const visibleSlots = computed<Slot[]>(() =>
  isDoubles.value ? ['a1', 'a2', 'b1', 'b2'] : ['a1', 'b1']
);
const slotValue = (slot: Slot): string => {
  const team = slot[0] === 'a' ? teamA.value : teamB.value;
  return slot[1] === '1' ? team.p1 : team.p2;
};
const setSlot = (slot: Slot, name: string) => {
  const team = slot[0] === 'a' ? teamA : teamB;
  team.value = { ...team.value, [slot[1] === '1' ? 'p1' : 'p2']: name };
};
const slotLabel = (slot: Slot): string =>
  isDoubles.value
    ? `Team ${slot.startsWith('a') ? 'A' : 'B'} · player ${slot.endsWith('1') ? 1 : 2}`
    : slot === 'a1'
      ? 'Player 1'
      : 'Player 2';
const firstEmptySlot = () =>
  visibleSlots.value.find((s) => !slotValue(s).trim());
const activeSlot = ref<Slot>('a1');
const allFilled = computed(() => !firstEmptySlot());
// A partner field the singles toggle just hid can't stay the target.
watch(
  visibleSlots,
  (slots) => {
    if (!slots.includes(activeSlot.value)) {
      activeSlot.value = firstEmptySlot() ?? slots[0]!;
    }
  },
  { immediate: true }
);
const onPickRecent = (name: string) => {
  setSlot(activeSlot.value, name);
  const next = firstEmptySlot();
  if (next) activeSlot.value = next;
};
const isActiveSlot = (slot: Slot) =>
  activeSlot.value === slot && !allFilled.value;

// Tournament fields and theme — the rarely-changed extras, one row that
// opens. (Was `showTournamentDetails`; the rematch prefill still opens it when
// it brings any of the fields back populated.)
const moreOptionsSummary = computed(() => {
  const details = [eventName.value, round.value, courtLabel.value]
    .map((v) => v.trim())
    .filter(Boolean);
  return [
    details.length ? details.join(' · ') : 'Event, round, court',
    `Theme: ${overlayName.value}`,
  ].join(' · ');
});

/** "set" under tennis/padel scoring, "game" otherwise — see engine unitNoun. */
const formatUnit = computed(() => {
  const cfg = sportPresets[formatPreset.value]?.config;
  return cfg ? unitNoun(cfg) : 'game';
});

const formatSummary = computed(() => {
  const sportLabel = SPORTS.find((s) => s.id === sport.value)?.label ?? '';
  const cfg = sportPresets[formatPreset.value]?.config;
  // `formatHeadline` rather than a bare `${pointsPerGame} pt`: under tennis
  // scoring that field counts games per SET, so the generic phrasing billed a
  // tennis match as "6 pt".
  const length =
    matchLength.value === 'single'
      ? `single ${formatUnit.value}`
      : `best of ${bestOfN.value}`;
  return [
    sportLabel,
    cfg ? formatHeadline(cfg).toLowerCase() : null,
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
      // Partner slots gated on isDoubles for the same reason `enteredNames`
      // is: flipping Doubles → Singles hides those inputs without clearing
      // their refs, so an ungated write files partners into the row for a
      // singles match that has none. `team_name_a/b` was already safe via
      // formatNames; this brings `players` in line. No known reader is
      // affected today (themes read team_name_* when is_doubles is false, and
      // the rematch prefill takes its singles branch), but the row shouldn't
      // carry names the match doesn't have.
      players: {
        a1: teamA.value.p1.trim(),
        a2: isDoubles.value ? teamA.value.p2.trim() : '',
        b1: teamB.value.p1.trim(),
        b2: isDoubles.value ? teamB.value.p2.trim() : '',
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
  // Seed the suggestion chips for the next match. After the upsert so a failed
  // create can't pollute the list, and before navigating since these refs go
  // away with the page. Singles leaves the two partner slots blank; they're
  // dropped on the way in.
  rememberPlayers(enteredNames.value);

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

  // Bootstrap a never-used OBS URL onto this match, so an operator who set one
  // up but hasn't bound anything yet doesn't stare at a transparent overlay.
  // Fires only while `first_bound_at` is NULL — gating on "nothing currently
  // bound" instead would mean clearing the overlay during a break and then
  // prepping the next match shoves it straight on air.
  //
  // Deliberately NOT awaited: it costs two round-trips and nothing downstream
  // depends on it, so awaiting would add Supabase latency to every match
  // creation for signed-in users. It settles after navigation just fine.
  autoBindObsUrl(matchId.value).catch((err) => {
    console.warn('[/new] auto-bind of OBS URL failed', err);
  });

  navigateTo(`/m/${matchId.value}`);
};
</script>

<template>
  <!-- One column on a phone; from `lg` the format settles on the left and the
       players, extras and Start sit on the right, so a laptop sees the whole
       form without scrolling. Each column stays form-width — a name field
       stretched across a 1150px viewport reads as a banner, not an input. -->
  <div class="mx-auto flex w-full max-w-xl flex-col font-sans lg:max-w-5xl">
    <h1 class="px-4 pt-6 pb-3 text-2xl font-semibold tracking-tight">
      New match
    </h1>

    <div
      class="grid grid-cols-1 gap-7 px-4 pt-2 pb-48 md:pb-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)] lg:gap-10"
    >
      <!-- Format: sport → scoring → players & length. Top to bottom in the
           order each choice constrains the next. -->
      <main class="space-y-7">
        <section>
          <div
            class="mb-2.5 text-[11px] font-semibold tracking-[0.06em] uppercase text-fg-subtle"
          >
            Sport
          </div>
          <SportPicker v-model="sport" />
        </section>

        <section v-if="presetsInSport.length">
          <div
            id="scoring-label"
            class="mb-2.5 text-[11px] font-semibold tracking-[0.06em] uppercase text-fg-subtle"
          >
            Scoring
          </div>
          <ToggleGroup
            v-if="presetsInSport.length > 1"
            type="single"
            :model-value="formatPreset"
            variant="outline"
            aria-labelledby="scoring-label"
            class="w-full"
            :spacing="presetsInSport.length > 2 ? 2 : 0"
            :class="presetsInSport.length > 2 ? 'grid grid-cols-2' : ''"
            @update:model-value="
              (v) => v && (formatPreset = v as SportPresetId)
            "
          >
            <ToggleGroupItem
              v-for="p in presetsInSport"
              :key="p.id"
              :value="p.id"
              class="h-10 flex-1 whitespace-nowrap text-sm font-semibold"
            >
              {{ presetCopy[p.id].label }}
            </ToggleGroupItem>
          </ToggleGroup>
          <!-- How the chosen format plays, in one plain sentence — the thing a
               club player needs to know, rather than engine terms. -->
          <p class="mt-2 text-[13px] leading-relaxed text-muted-foreground">
            {{ activeCopy.blurb }}
          </p>
        </section>

        <section class="flex flex-wrap gap-x-4 gap-y-5">
          <div class="min-w-[9rem] flex-1">
            <div
              id="players-label"
              class="mb-2.5 text-[11px] font-semibold tracking-[0.06em] uppercase text-fg-subtle"
            >
              Players
            </div>
            <ToggleGroup
              v-if="showTypeToggle"
              type="single"
              :model-value="isDoubles ? 'doubles' : 'singles'"
              variant="outline"
              aria-labelledby="players-label"
              class="w-full"
              @update:model-value="(v) => v && (isDoubles = v === 'doubles')"
            >
              <ToggleGroupItem value="singles" class="h-10 flex-1">
                Singles
              </ToggleGroupItem>
              <ToggleGroupItem value="doubles" class="h-10 flex-1">
                Doubles
              </ToggleGroupItem>
            </ToggleGroup>
            <!-- Padel is doubles-only and squash singles-only: say so rather
                 than offering a toggle with one legal answer. -->
            <p
              v-else
              class="flex h-10 items-center text-sm text-muted-foreground"
            >
              {{
                isDoubles
                  ? 'Doubles — the only format for padel'
                  : 'Singles only'
              }}
            </p>
          </div>

          <div class="shrink-0">
            <div
              id="bestof-label"
              class="mb-2.5 text-[11px] font-semibold tracking-[0.06em] uppercase text-fg-subtle"
            >
              Best of
            </div>
            <ToggleGroup
              type="single"
              :model-value="String(bestOf)"
              variant="outline"
              aria-labelledby="bestof-label"
              @update:model-value="(v) => v && setBestOf(Number(v))"
            >
              <ToggleGroupItem
                v-for="n in bestOfOptions"
                :key="n"
                :value="String(n)"
                class="h-10 min-w-11 tabular-nums"
              >
                {{ n }}
              </ToggleGroupItem>
            </ToggleGroup>
            <p class="mt-1.5 text-[11px] text-fg-subtle">
              {{ bestOfCaption }}
            </p>
          </div>
        </section>
      </main>

      <aside class="space-y-4">
        <!-- The matchup: one card, team colours on the dots the court uses,
             VS between the sides. Doubles puts each pair on one row. -->
        <section
          class="space-y-3 rounded-xl border border-border bg-card p-3"
          aria-label="Players"
        >
          <template v-for="(team, ti) in ['a', 'b'] as const" :key="team">
            <div
              v-if="ti === 1"
              class="flex items-center gap-3"
              aria-hidden="true"
            >
              <span class="h-px flex-1 bg-border" />
              <span
                class="text-[11px] font-bold tracking-[0.1em] text-fg-subtle"
              >
                VS
              </span>
              <span class="h-px flex-1 bg-border" />
            </div>
            <div>
              <div
                v-if="isDoubles"
                class="mb-2 flex items-center gap-2 text-xs font-semibold text-muted-foreground"
              >
                <span
                  class="size-2 rounded-full"
                  :class="team === 'a' ? 'bg-team-a' : 'bg-team-b'"
                />
                Team {{ team.toUpperCase() }}
              </div>
              <div :class="isDoubles ? 'grid grid-cols-2 gap-2' : ''">
                <div
                  v-for="n in isDoubles ? ([1, 2] as const) : ([1] as const)"
                  :key="n"
                  class="relative"
                >
                  <Label :for="`team-${team}-p${n}`" class="sr-only">
                    {{ slotLabel(`${team}${n}` as Slot) }}
                  </Label>
                  <span
                    v-if="!isDoubles"
                    class="pointer-events-none absolute top-1/2 left-3.5 size-2 -translate-y-1/2 rounded-full"
                    :class="team === 'a' ? 'bg-team-a' : 'bg-team-b'"
                    aria-hidden="true"
                  />
                  <!-- The active field — the one the recent-names row fills —
                       keeps a primary border even after focus moves to a
                       chip, so it's clear where a tap will land. -->
                  <Input
                    :id="`team-${team}-p${n}`"
                    :model-value="slotValue(`${team}${n}` as Slot)"
                    type="text"
                    autocomplete="off"
                    :placeholder="
                      isDoubles
                        ? `Player ${n}`
                        : slotLabel(`${team}${n}` as Slot)
                    "
                    class="h-12 bg-background text-base"
                    :class="[
                      !isDoubles && 'pl-8',
                      isActiveSlot(`${team}${n}` as Slot) && 'border-primary',
                    ]"
                    @update:model-value="
                      (v) => setSlot(`${team}${n}` as Slot, String(v))
                    "
                    @focus="activeSlot = `${team}${n}` as Slot"
                  />
                </div>
              </div>
            </div>
          </template>
        </section>

        <!-- ONE row of recent names for the active field (see the script).
             Hidden once every field is filled. -->
        <PlayerChips
          v-if="!allFilled"
          :list="recentNames"
          :query="slotValue(activeSlot)"
          :exclude="enteredNames"
          :label="`Recent players — tap to fill ${slotLabel(activeSlot)}`"
          :show-hint="!hintDismissed"
          @pick="onPickRecent"
          @remove="onRemoveRecent"
        />
        <p
          v-if="!allFilled && recentNames.length"
          class="-mt-2 text-xs text-fg-subtle"
        >
          Tap a name to fill {{ slotLabel(activeSlot) }}
        </p>

        <!-- Rarely-changed extras: tournament fields and the theme. -->
        <section>
          <Button
            type="button"
            variant="outline"
            class="h-auto w-full items-center gap-3 p-3 text-left whitespace-normal"
            :aria-expanded="showTournamentDetails"
            aria-controls="more-options"
            @click="showTournamentDetails = !showTournamentDetails"
          >
            <SlidersHorizontal class="size-4 shrink-0 text-fg-subtle" />
            <span class="min-w-0 flex-1">
              <span class="block text-sm font-semibold">More options</span>
              <span class="block truncate text-xs font-normal text-fg-subtle">
                {{ moreOptionsSummary }}
              </span>
            </span>
            <ChevronDown
              class="size-4 shrink-0 text-fg-subtle transition-transform"
              :class="showTournamentDetails ? 'rotate-180' : ''"
            />
          </Button>
          <div
            v-if="showTournamentDetails"
            id="more-options"
            class="mt-3 space-y-2"
          >
            <Label for="event-name" class="sr-only">Event</Label>
            <Input
              id="event-name"
              v-model="eventName"
              type="text"
              placeholder='Event (e.g. "Spring Open")'
              class="h-11"
            />
            <Label for="event-round" class="sr-only">Round</Label>
            <Input
              id="event-round"
              v-model="round"
              type="text"
              placeholder='Round (e.g. "Quarterfinal")'
              class="h-11"
            />
            <Label for="event-court" class="sr-only">Court or table</Label>
            <Input
              id="event-court"
              v-model="courtLabel"
              type="text"
              placeholder='Court / table (e.g. "Court 1")'
              class="h-11"
            />
            <div class="pt-2">
              <LookAndFeelCards
                :overlay-theme-name="overlayName"
                :scoreboard-theme-name="scoreboardName"
                @open-theme="themeDialogOpen = true"
              />
            </div>
          </div>
        </section>

        <!-- Mobile: anchored to the bottom edge and padded to clear the tab
             bar (MobileTabBar is a detached pill that hides on scroll-down).
             Desktop: no tab bar and a short form, so the CTA rejoins the flow
             under the players. The summary line restates what Start will
             create. -->
        <footer
          class="fixed inset-x-0 bottom-0 z-10 space-y-2 border-t border-border bg-background px-4 pt-3 pb-[calc(4.75rem+env(safe-area-inset-bottom))] md:static md:border-t-0 md:px-0 md:pt-2 md:pb-10"
        >
          <p class="text-center text-xs text-muted-foreground">
            {{ formatSummary }}
          </p>
          <!-- Secondary while incomplete: `disabled` alone is opacity-only,
               so a blocked CTA would still be the loudest thing on the page. -->
          <Button
            type="button"
            size="lg"
            :variant="canCreate ? 'default' : 'secondary'"
            class="h-12 w-full text-base font-semibold"
            :disabled="!canCreate || isCreating"
            @click="createMatch"
          >
            <Loader2 v-if="isCreating" class="size-4 animate-spin" />
            <Play v-else class="size-4" />
            {{
              isCreating
                ? 'Creating…'
                : canCreate
                  ? 'Start match'
                  : isDoubles
                    ? 'Add all four players to start'
                    : 'Add both players to start'
            }}
          </Button>
        </footer>
      </aside>
    </div>

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
  </div>
</template>
