<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
// Explicit import: `components` is configured with `pathPrefix: false`, so the
// directory name is not part of the auto-import name — and the surrounding
// pages import their components explicitly regardless.
import MatchSlot from '~/components/overlay/MatchSlot.vue';

// The OBS-facing half of a dynamic URL. Pasted into a browser source once and
// never edited again; the operator rebinds it from the app between matches and
// this page swaps what it renders, live.
//
// Public by design — OBS's embedded Chromium is never authenticated, so
// `dynamic_urls_read_by_id` is a `using (true)` policy and the middleware keeps
// `/d/*/overlay` on its public-suffix list even though `/d/*` itself is gated.

definePageMeta({ layout: false, colorMode: 'light' });

const route = useRoute();
const dynamicId = computed(() => String(route.params.id ?? ''));
const { boundMatchId, loaded: bindingLoaded } = useDynamicBinding(dynamicId);

// Double buffer. Two fixed slots rather than one component with a changing
// prop: promoting must not remount the incoming instance, or it would drop the
// state it just spent the load doing. `frontSlot` says which one is on air.
const slotA = ref<string | null>(null);
const slotB = ref<string | null>(null);
const frontSlot = ref<'a' | 'b'>('a');

const backSlot = computed(() => (frontSlot.value === 'a' ? 'b' : 'a'));
const frontId = computed(() =>
  frontSlot.value === 'a' ? slotA.value : slotB.value
);

const FADE_MS = 320;

const setSlot = (slot: 'a' | 'b', id: string | null) => {
  if (slot === 'a') slotA.value = id;
  else slotB.value = id;
};

watch(
  boundMatchId,
  (next) => {
    // Unbound: clear both. Nothing renders — a live overlay going blank is the
    // correct failure here, not a diagnostic string appearing on air.
    if (!next) {
      slotA.value = null;
      slotB.value = null;
      return;
    }
    // Already on air (e.g. a Realtime echo of our own binding): drop any
    // half-loaded back buffer rather than crossfading to the same match.
    if (next === frontId.value) {
      setSlot(backSlot.value, null);
      return;
    }
    setSlot(backSlot.value, next);
  },
  { immediate: true }
);

// Promotion. Only the back buffer can promote, and only for the match it was
// actually asked to load — a stale `ready` from a superseded binding must not
// put the wrong match on air.
const onSlotReady = (slot: 'a' | 'b', matchId: string) => {
  if (slot !== backSlot.value) return;
  const pending = slot === 'a' ? slotA.value : slotB.value;
  if (matchId !== pending) return;

  frontSlot.value = slot;
  // Tear the outgoing match down only after the crossfade has finished,
  // otherwise it pops out mid-fade.
  window.setTimeout(() => setSlot(backSlot.value, null), FADE_MS);
};

// Setup affordance. A transparent page and a mistyped URL look identical in
// OBS, so the first ten seconds after the source loads show a confirmation
// that the URL resolves. After that it fades for good: this box is only useful
// while the operator is staring at OBS pasting the link, and is a liability
// every second afterwards. It carries no id — that's the control handle for
// the stream, and the one thing you'd least want visible if it ever did reach
// air.
const WAITING_CARD_MS = 10_000;
const waitingCardVisible = ref(true);
let waitingTimer: number | undefined;

onMounted(() => {
  waitingTimer = window.setTimeout(() => {
    waitingCardVisible.value = false;
  }, WAITING_CARD_MS);
});

onBeforeUnmount(() => {
  if (waitingTimer) window.clearTimeout(waitingTimer);
});

const showWaitingCard = computed(
  () => bindingLoaded.value && !frontId.value && waitingCardVisible.value
);

useHead({
  bodyAttrs: { class: 'bg-transparent' },
  htmlAttrs: { class: 'bg-transparent' },
});
</script>

<template>
  <div
    class="fixed inset-0 bg-transparent overflow-hidden font-sans pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]"
  >
    <!-- Both buffers stay mounted; only opacity distinguishes them, so the
         incoming match loads at full fidelity while invisible. -->
    <div
      v-if="slotA"
      class="absolute inset-0 transition-opacity duration-300"
      :class="frontSlot === 'a' ? 'opacity-100' : 'opacity-0'"
    >
      <MatchSlot
        :match-id="slotA"
        @ready="(id: string) => onSlotReady('a', id)"
      />
    </div>

    <div
      v-if="slotB"
      class="absolute inset-0 transition-opacity duration-300"
      :class="frontSlot === 'b' ? 'opacity-100' : 'opacity-0'"
    >
      <MatchSlot
        :match-id="slotB"
        @ready="(id: string) => onSlotReady('b', id)"
      />
    </div>

    <Transition
      enter-active-class="transition-opacity duration-300"
      leave-active-class="transition-opacity duration-500"
      enter-from-class="opacity-0"
      leave-to-class="opacity-0"
    >
      <div
        v-if="showWaitingCard"
        class="absolute bottom-9 left-9 px-4 py-3 rounded-lg bg-neutral-950/80 text-neutral-50 text-sm font-mono"
      >
        Waiting for a match
      </div>
    </Transition>
  </div>
</template>

<style>
html,
body,
#__nuxt {
  background: transparent !important;
}
</style>
