<script setup lang="ts">
import { getTheme } from "@sb/themes";

definePageMeta({ layout: false });

const route = useRoute();
const dynamicId = computed(() => String(route.params.id ?? ""));
const themeId = computed(() =>
  String(route.query.theme ?? "broadcast-classic"),
);

// Resolve which match this dynamic URL points to. Watches localStorage so
// the OBS source updates live as the operator binds different matches.
const boundMatchId = ref<string | null>(null);

const STORAGE_KEY = computed(() => `sb:dynamic:${dynamicId.value}`);

const resolve = () => {
  if (typeof localStorage === "undefined") return;
  boundMatchId.value = localStorage.getItem(STORAGE_KEY.value);
};

onMounted(() => {
  resolve();
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY.value) resolve();
  });
});

const matchIdRef = computed(() => boundMatchId.value ?? "");

// Only set up state when a match is bound; otherwise show waiting screen.
const { state, config } = useMatchState(matchIdRef as Ref<string>);

const teamNames = ref({ a: "Team A", b: "Team B" });
watchEffect(() => {
  if (!boundMatchId.value || typeof localStorage === "undefined") return;
  try {
    const raw = localStorage.getItem(`sb:meta:${boundMatchId.value}`);
    if (raw) {
      const meta = JSON.parse(raw);
      if (meta?.teamNames) teamNames.value = meta.teamNames;
    }
  } catch {}
});

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
      v-if="boundMatchId"
      :state="state"
      :config="config"
      :team-names="teamNames"
      :meta="{ sportLabel: 'BADMINTON' }"
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
