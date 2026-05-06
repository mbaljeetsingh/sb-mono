<script setup lang="ts">
import { getTheme } from "@sb/themes";

definePageMeta({ layout: false });

const route = useRoute();
const matchId = computed(() => String(route.params.id ?? ""));
const themeId = computed(() => String(route.query.theme ?? "filmable"));

const { state, config } = useMatchState(matchId);
const { teamNames } = useMatchMeta(matchId);
const meta = computed(() => ({
  sportLabel: (config.value.sport ?? "badminton").toUpperCase(),
  courtLabel: null as string | null,
  round: null as string | null,
  category: null as string | null,
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
