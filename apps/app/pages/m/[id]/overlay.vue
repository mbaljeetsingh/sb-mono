<script setup lang="ts">
import { getTheme } from "@sb/themes";

definePageMeta({ layout: false, colorMode: "light" });

const route = useRoute();
const matchId = computed(() => String(route.params.id ?? ""));

// Theme resolution order: ?theme= query param (per-link override) → the
// matches row in Supabase (useThemeChoice — operator's choice + live sync)
// → hardcoded fallback. A fresh /m/{id}/overlay link without a query string
// hydrates whichever theme the operator picked on /m/[id], and tracks
// changes in real time if they switch themes mid-match.
const { overlay: overlayTheme } = useThemeChoice(matchId);
const themeId = computed(
  () =>
    String(route.query.theme ?? "") ||
    overlayTheme.value ||
    "broadcast-classic",
);

const { state, config } = useMatchState(matchId);
const { teamNames, meta: matchMeta } = useMatchMeta(matchId);
const meta = computed(() => ({
  sportLabel: (
    matchMeta.value.eventName ||
    config.value.sport ||
    "badminton"
  ).toUpperCase(),
  courtLabel: matchMeta.value.courtLabel?.trim() || null,
  round: matchMeta.value.round?.trim() || null,
  category: matchMeta.value.category?.trim() || null,
  venue: null as string | null,
  sponsorName: null as string | null,
}));

const themeEntry = computed(() => getTheme(themeId.value, "overlay"));

useHead({
  bodyAttrs: { class: "bg-transparent" },
  htmlAttrs: { class: "bg-transparent" },
});
</script>

<template>
  <div
    class="fixed inset-0 bg-transparent overflow-hidden font-sans pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)]"
  >
    <component
      :is="themeEntry.component"
      :state="state"
      :config="config"
      :team-names="teamNames"
      :meta="meta"
    />
  </div>
</template>

<style>
/* Overlay routes are inserted into OBS as transparent browser sources.
 * Force the page background transparent regardless of theme.css. */
html,
body,
#__nuxt {
  background: transparent !important;
}
</style>
