<script setup lang="ts">
import { getTheme } from '@sb/themes';
import { computed, watch } from 'vue';

// One fully-loaded overlay render for a single match, used as a buffer by the
// dynamic-URL overlay. It owns its own state/meta/theme composables so two
// instances can be alive at once — the outgoing match stays on air while the
// incoming one loads underneath, then they crossfade.
//
// `ready` fires only when all three sources have resolved. Gating on fewer
// would put the swap on air too early in a visible way: without events you
// crossfade to 0–0 and then snap to the real score, and without the theme you
// render in `broadcast-classic` and then re-layout, since themes differ in
// size and anchor position.

const props = defineProps<{ matchId: string }>();
const emit = defineEmits<{ ready: [matchId: string] }>();

const route = useRoute();
const matchIdRef = computed(() => props.matchId);

const {
  teamNames,
  players,
  meta: slotMeta,
  loaded: metaLoaded,
} = useMatchMeta(matchIdRef);
// `isDoubles` has to reach the reducer: side-out pickleball scores differently
// in singles and doubles, so a surface reducing the same log with the wrong
// value would show a different score from the operator's.
const isDoublesRef = computed(() => slotMeta.value.isDoubles ?? false);
const {
  state,
  config,
  loaded: eventsLoaded,
} = useMatchState(matchIdRef, { isDoubles: isDoublesRef });
const { overlay: overlayTheme, loaded: themeLoaded } =
  useThemeChoice(matchIdRef);

// Theme resolution order is unchanged from the per-match overlay: ?theme=
// query param wins (that's how an operator pins one look for the whole
// stream), then the bound match's own choice, then the baseline. Inheriting
// per-match is deliberate — silently overriding a theme the user picked would
// be a broken promise on the surface where it matters most.
const themeId = computed(
  () =>
    String(route.query.theme ?? '') || overlayTheme.value || 'broadcast-classic'
);
const themeEntry = computed(() => getTheme(themeId.value, 'overlay'));

const isReady = computed(
  () => eventsLoaded.value && metaLoaded.value && themeLoaded.value
);

watch(
  isReady,
  (ready) => {
    if (ready) emit('ready', props.matchId);
  },
  { immediate: true }
);
</script>

<template>
  <component
    :is="themeEntry.component"
    :state="state"
    :config="config"
    :team-names="teamNames"
    :players="players"
    :meta="{}"
  />
</template>
