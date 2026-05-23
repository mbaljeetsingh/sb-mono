<script setup lang="ts">
import { useTemplateRef } from "vue";
import { useElementSize } from "@vueuse/core";
import { getTheme } from "@sb/themes";

definePageMeta({ layout: false, colorMode: "light" });

const route = useRoute();
const matchId = computed(() => String(route.params.id ?? ""));

// Same resolution order as the overlay surface — query string wins, the
// Supabase-backed useThemeChoice next, hardcoded fallback last. Live syncs
// when the operator changes themes on another device.
const { scoreboard: scoreboardTheme } = useThemeChoice(matchId);
const themeId = computed(
  () => String(route.query.theme ?? "") || scoreboardTheme.value || "filmable",
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

// Themes are authored at a fixed 1920×1080 canvas (see docs/PRD §3.10 and
// ThemePreview.vue). The scoreboard page used to absolutely-position the
// theme onto the raw viewport, which works on a real 16:9 venue TV but
// degrades to garbage on any other aspect ratio — a phone held in portrait
// would see oversized fixed-px elements clipping out of the safe area.
// Render the theme inside a fixed-canvas wrapper and `transform: scale()`
// it to fit whatever viewport we got, preserving aspect ratio (letterbox
// in the off-aspect direction). The black page background hides the bars.
const SOURCE_W = 1920;
const SOURCE_H = 1080;
const viewport = useTemplateRef<HTMLDivElement>("viewport");
const { width: vw, height: vh } = useElementSize(viewport);
const scale = computed(() => {
  if (vw.value <= 0 || vh.value <= 0) return 1;
  return Math.min(vw.value / SOURCE_W, vh.value / SOURCE_H);
});
</script>

<template>
  <div
    ref="viewport"
    class="fixed inset-0 bg-black overflow-hidden font-sans pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] pl-[env(safe-area-inset-left)] pr-[env(safe-area-inset-right)] flex items-center justify-center"
  >
    <div
      class="relative origin-center flex-shrink-0"
      :style="{
        width: `${SOURCE_W}px`,
        height: `${SOURCE_H}px`,
        transform: `scale(${scale})`,
      }"
    >
      <component
        :is="themeEntry.component"
        :state="state"
        :config="config"
        :team-names="teamNames"
        :meta="meta"
      />
    </div>
  </div>
</template>
