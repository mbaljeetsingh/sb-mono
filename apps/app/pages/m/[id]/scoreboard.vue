<script setup lang="ts">
import { useStorage } from "@vueuse/core";
import { getTheme } from "@sb/themes";

definePageMeta({ layout: false });

const route = useRoute();
const matchId = computed(() => String(route.params.id ?? ""));

// Same resolution order as the overlay surface — query string wins, stored
// choice next, hardcoded fallback last.
const themeChoice = useStorage(
  computed(() => `sb:theme:${matchId.value}`),
  { overlay: "broadcast-classic", scoreboard: "filmable" },
);
const themeId = computed(
  () =>
    String(route.query.theme ?? "") ||
    themeChoice.value.scoreboard ||
    "filmable",
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

const themeEntry = computed(() => getTheme(themeId.value, "scoreboard"));
</script>

<template>
  <div class="fixed inset-0 bg-black overflow-hidden font-sans">
    <component
      :is="themeEntry.component"
      :state="state"
      :config="config"
      :team-names="teamNames"
      :meta="meta"
    />
  </div>
</template>
