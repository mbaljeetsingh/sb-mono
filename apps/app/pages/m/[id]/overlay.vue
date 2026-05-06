<script setup lang="ts">
import { getTheme } from "@sb/themes";

definePageMeta({ layout: false });

const route = useRoute();
const matchId = computed(() => String(route.params.id ?? ""));
const themeId = computed(() =>
  String(route.query.theme ?? "broadcast-classic"),
);

const { state, config } = useMatchState(matchId);
const { teamNames } = useMatchMeta(matchId);
const meta = computed(() => ({
  sportLabel: (config.value.sport ?? "badminton").toUpperCase(),
  // Tournament metadata (court, round, category, venue, sponsor) wires through
  // /m/[id] settings in v1.x — see ROADMAP E1.17. Until then surfaces show none.
  courtLabel: null as string | null,
  round: null as string | null,
  category: null as string | null,
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
  <div class="fixed inset-0 bg-transparent overflow-hidden font-sans">
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
