<script setup lang="ts">
import { useStorage } from '@vueuse/core';
import { getTheme } from '@sb/themes';

definePageMeta({ layout: false, colorMode: 'light' });

const route = useRoute();
const dynamicId = computed(() => String(route.params.id ?? ''));

// Reactive binding to the dynamic-URL row in localStorage. useStorage already
// listens to storage events, so the OBS source on a different tab/laptop sees
// the operator's swap automatically — no extra wiring needed.
const boundMatchId = useStorage<string | null>(
  computed(() => `sb:dynamic:${dynamicId.value}`),
  null
);

const matchIdRef = computed(() => boundMatchId.value ?? '');

// Only set up state when a match is bound; otherwise show waiting screen.
const { state, config } = useMatchState(matchIdRef as Ref<string>);

// Use the shared loader so name fallback ("Team A" / "Team B") matches every
// other surface and stays in sync when the dynamic-URL operator rebinds matches.
const { teamNames, players } = useMatchMeta(matchIdRef as Ref<string>);

// Theme: ?theme= query param wins, then the bound match's stored choice
// (Supabase via useThemeChoice — live-syncs when operator swaps themes),
// then hardcoded baseline.
const { overlay: overlayTheme } = useThemeChoice(matchIdRef as Ref<string>);
const themeId = computed(
  () =>
    String(route.query.theme ?? '') || overlayTheme.value || 'broadcast-classic'
);

const themeEntry = computed(() => getTheme(themeId.value, 'overlay'));

useHead({
  bodyAttrs: { class: 'bg-transparent' },
  htmlAttrs: { class: 'bg-transparent' },
});
</script>

<template>
  <div
    class="fixed inset-0 bg-transparent overflow-hidden font-sans pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]"
  >
    <component
      :is="themeEntry.component"
      v-if="boundMatchId"
      :state="state"
      :config="config"
      :team-names="teamNames"
      :players="players"
      :meta="{}"
    />
    <div
      v-else
      class="absolute bottom-9 left-9 px-4 py-3 rounded-lg bg-neutral-950/80 text-neutral-50 text-sm font-mono"
    >
      No match bound · /d/{{ dynamicId.slice(0, 8) }}
    </div>
  </div>
</template>

<style>
html,
body,
#__nuxt {
  background: transparent !important;
}
</style>
