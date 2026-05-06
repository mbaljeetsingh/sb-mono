<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import { themes as themeRegistry, type ThemeSurface } from "@sb/themes";
import ThemePickerSheet from "~/components/match/ThemePickerSheet.vue";

// Uses default layout (AppHeader at top, max-w-6xl content wrapper).
useSeoMeta({ title: "Match" });

const route = useRoute();
const matchId = computed(() => String(route.params.id ?? ""));
const { state, config } = useMatchState(matchId);

const teamNames = ref({ a: "Priya / Anu", b: "Karan / Jay" });

const showAllUrls = ref(false);
const baseUrl = computed(() => {
  if (typeof window === "undefined") return "";
  return window.location.origin;
});

// Per-match theme selection. Persisted to localStorage so the overlay/scoreboard
// pages and the URL builders can reflect the user's choice. DB persistence will
// land with E1.11 (Supabase realtime sync) — until then, localStorage is the truth.
const THEME_STORAGE_KEY = computed(() => `sb:theme:${matchId.value}`);
const overlayTheme = ref<string>("broadcast-classic");
const scoreboardTheme = ref<string>("filmable");
const themeSheetOpen = ref(false);

onMounted(() => {
  if (typeof localStorage === "undefined") return;
  try {
    const raw = localStorage.getItem(THEME_STORAGE_KEY.value);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed?.overlay === "string")
        overlayTheme.value = parsed.overlay;
      if (typeof parsed?.scoreboard === "string")
        scoreboardTheme.value = parsed.scoreboard;
    }
  } catch {}
});

const persistTheme = () => {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(
    THEME_STORAGE_KEY.value,
    JSON.stringify({
      overlay: overlayTheme.value,
      scoreboard: scoreboardTheme.value,
    }),
  );
};

const onPickTheme = ({
  surface,
  id,
}: {
  surface: ThemeSurface;
  id: string;
}) => {
  if (surface === "overlay") overlayTheme.value = id;
  if (surface === "scoreboard") scoreboardTheme.value = id;
  persistTheme();
};

const overlayThemeName = computed(
  () => themeRegistry[overlayTheme.value]?.manifest.name ?? "—",
);
const scoreboardThemeName = computed(
  () => themeRegistry[scoreboardTheme.value]?.manifest.name ?? "—",
);

// URL builders include ?theme= so OBS / venue TV pick up the selected theme.
const urls = computed(() => ({
  control: `${baseUrl.value}/m/${matchId.value}/control`,
  overlay: `${baseUrl.value}/m/${matchId.value}/overlay?theme=${overlayTheme.value}`,
  scoreboard: `${baseUrl.value}/m/${matchId.value}/scoreboard?theme=${scoreboardTheme.value}`,
}));

const score = (side: "a" | "b") => {
  const last = state.value.games[state.value.games.length - 1];
  return last ? last[side] : 0;
};

const statusLabel = computed(() => {
  if (state.value.matchOver) return "Final";
  if (state.value.events?.length === 0) return "Ready · 0 events";
  return `Game ${state.value.games.length} · ${score("a")}–${score("b")}`;
});

const copy = async (text: string) => {
  if (typeof navigator !== "undefined" && navigator.clipboard) {
    await navigator.clipboard.writeText(text);
  }
};

const openControl = () => navigateTo(`/m/${matchId.value}/control`);
</script>

<template>
  <div class="font-sans pb-8">
    <!-- Page header strip — match id badge + disabled settings button.
         Global AppHeader (logo + avatar) is rendered by layouts/default.vue. -->
    <div class="flex items-center justify-between px-4 pt-4 pb-2">
      <span class="text-[13px] font-semibold text-fg-subtle">
        Match · {{ matchId.slice(0, 8) }}…
      </span>
      <button
        type="button"
        class="size-9 rounded-md text-foreground/40 cursor-not-allowed inline-flex items-center justify-center"
        aria-label="Settings (coming in v1.x)"
        title="Match settings (court, round, category, venue) — coming in v1.x"
        disabled
      >
        ⚙
      </button>
    </div>

    <!-- Hero status card -->
    <div class="px-4 pt-2 pb-4">
      <div
        class="rounded-lg p-4 border transition-colors"
        :class="
          state.matchOver
            ? 'bg-neutral-950 text-neutral-50 border-neutral-900'
            : 'bg-surface text-foreground border-border'
        "
      >
        <div class="flex justify-between items-center mb-3">
          <span class="inline-flex gap-1.5 items-center">
            <span
              v-if="state.matchOver"
              class="px-2 py-0.5 rounded text-[10px] font-bold tracking-[0.06em] uppercase bg-success-soft text-success"
              >Final</span
            >
            <span
              v-else
              class="inline-flex items-center gap-1 text-[10px] font-bold tracking-[0.1em] uppercase text-team-a"
            >
              <span
                class="size-1.5 rounded-full bg-team-a animate-pulse-soft"
              />
              LIVE
            </span>
            <span class="text-sm text-fg-muted">
              Badminton 21pt · BO3 · Doubles
            </span>
          </span>
          <span v-if="!state.matchOver" class="text-sm text-fg-subtle">
            {{ statusLabel }}
          </span>
        </div>
        <div class="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
          <div>
            <div
              class="text-sm mb-0.5"
              :class="state.matchOver ? 'text-neutral-400' : 'text-fg-muted'"
            >
              {{ teamNames.a }}
            </div>
            <div class="score text-[40px]">
              {{ state.matchOver ? state.gamesWon.a : score("a") }}
            </div>
            <div class="flex gap-1 mt-1">
              <span
                v-for="i in config.gamesToWin + 1"
                :key="`a-${i}`"
                class="size-1.5 rounded-full"
                :style="{
                  background:
                    i <= state.gamesWon.a
                      ? 'var(--color-team-a)'
                      : 'var(--color-border-strong)',
                }"
              />
            </div>
          </div>
          <span class="text-sm text-fg-subtle">vs</span>
          <div class="text-right">
            <div
              class="text-sm mb-0.5"
              :class="state.matchOver ? 'text-neutral-400' : 'text-fg-muted'"
            >
              {{ teamNames.b }}
            </div>
            <div class="score text-[40px]">
              {{ state.matchOver ? state.gamesWon.b : score("b") }}
            </div>
            <div class="flex gap-1 mt-1 justify-end">
              <span
                v-for="i in config.gamesToWin + 1"
                :key="`b-${i}`"
                class="size-1.5 rounded-full"
                :style="{
                  background:
                    i <= state.gamesWon.b
                      ? 'var(--color-team-b)'
                      : 'var(--color-border-strong)',
                }"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Action 1-2-3 -->
    <div class="px-4 pb-4">
      <div
        class="text-[11px] font-semibold tracking-[0.06em] uppercase text-fg-subtle mb-2.5"
      >
        Get set up
      </div>
      <div class="flex flex-col gap-2">
        <button
          type="button"
          class="p-3 bg-surface border border-border rounded-md flex gap-3 items-center text-left hover:bg-surface-2 transition-colors"
          @click="openControl"
        >
          <span
            class="size-7 rounded-full bg-surface-2 text-fg-muted inline-flex items-center justify-center text-[13px] font-bold flex-shrink-0"
          >
            1
          </span>
          <span class="flex-1 min-w-0">
            <span class="block text-sm font-semibold"
              >Score from your phone</span
            >
            <span class="block text-xs text-fg-muted mt-0.5"
              >Open Control on this device</span
            >
          </span>
          <span
            class="px-3 h-8 inline-flex items-center justify-center rounded-md bg-brand text-brand-foreground text-xs font-semibold"
          >
            Open Control
          </span>
        </button>

        <div
          class="p-3 bg-surface border border-border rounded-md flex gap-3 items-center"
        >
          <span
            class="size-7 rounded-full bg-surface-2 text-fg-muted inline-flex items-center justify-center text-[13px] font-bold flex-shrink-0"
          >
            2
          </span>
          <span class="flex-1 min-w-0">
            <span class="block text-sm font-semibold">Show overlay in OBS</span>
            <span class="block text-xs text-fg-muted mt-0.5"
              >Paste URL into a Browser source</span
            >
          </span>
          <button
            type="button"
            class="px-3 h-8 inline-flex items-center justify-center rounded-md bg-secondary text-secondary-foreground text-xs font-semibold hover:bg-surface-2"
            @click="copy(urls.overlay)"
          >
            Copy URL
          </button>
        </div>

        <a
          :href="urls.scoreboard"
          target="_blank"
          rel="noopener"
          class="p-3 bg-surface border border-border rounded-md flex gap-3 items-center hover:bg-surface-2 transition-colors no-underline text-foreground"
        >
          <span
            class="size-7 rounded-full bg-surface-2 text-fg-muted inline-flex items-center justify-center text-[13px] font-bold flex-shrink-0"
          >
            3
          </span>
          <span class="flex-1 min-w-0">
            <span class="block text-sm font-semibold">Show on venue TV</span>
            <span class="block text-xs text-fg-muted mt-0.5">
              Fullscreen scoreboard on a tablet/TV
            </span>
          </span>
          <span
            class="px-3 h-8 inline-flex items-center justify-center rounded-md bg-secondary text-secondary-foreground text-xs font-semibold"
          >
            Open
          </span>
        </a>
      </div>
    </div>

    <!-- All URLs disclosure -->
    <div class="px-4 pb-4">
      <button
        type="button"
        class="w-full p-3 bg-surface-2 rounded-md flex justify-between items-center text-foreground text-[13px] font-medium hover:brightness-95"
        @click="showAllUrls = !showAllUrls"
      >
        <span>Show all URLs &amp; QR codes</span>
        <span>{{ showAllUrls ? "▴" : "▾" }}</span>
      </button>
      <div v-if="showAllUrls" class="mt-2.5 flex flex-col gap-2">
        <div class="p-3 bg-surface border border-warning rounded-md">
          <div class="flex justify-between items-center mb-1">
            <span
              class="inline-flex gap-1.5 items-center text-[13px] font-semibold"
            >
              Control
              <span
                class="px-1.5 py-0.5 rounded-sm bg-warning-soft text-warning text-[10px] font-bold tracking-[0.06em]"
                >Sensitive</span
              >
            </span>
            <button
              type="button"
              class="text-fg-muted hover:text-foreground"
              @click="copy(urls.control)"
              aria-label="Copy"
            >
              📋
            </button>
          </div>
          <div class="font-mono text-[11px] text-fg-muted break-all">
            {{ urls.control }}
          </div>
          <div class="text-[10px] text-fg-subtle mt-1">
            Sensitive — share with care
          </div>
        </div>

        <div
          v-for="(label, key) in {
            Overlay: 'overlay',
            Scoreboard: 'scoreboard',
          }"
          :key="key"
          class="p-3 bg-surface border border-border rounded-md"
        >
          <div class="flex justify-between items-center mb-1">
            <span class="text-[13px] font-semibold">{{ key }}</span>
            <button
              type="button"
              class="text-fg-muted hover:text-foreground"
              @click="copy(urls[label as keyof typeof urls])"
              aria-label="Copy"
            >
              📋
            </button>
          </div>
          <div class="font-mono text-[11px] text-fg-muted break-all">
            {{ urls[label as keyof typeof urls] }}
          </div>
          <div class="text-[10px] text-fg-subtle mt-1">
            {{
              label === "overlay" ? "OBS browser source" : "Public — TV / share"
            }}
          </div>
        </div>
      </div>
    </div>

    <!-- Branding row -->
    <div class="px-4 pb-4">
      <div
        class="text-[11px] font-semibold tracking-[0.06em] uppercase text-fg-subtle mb-2.5"
      >
        Look &amp; feel
      </div>
      <div class="grid grid-cols-2 gap-2">
        <button
          type="button"
          class="p-3 bg-surface border border-border rounded-md text-left flex flex-col gap-1.5 hover:bg-surface-2"
          @click="themeSheetOpen = true"
        >
          <span class="flex justify-between items-center">
            <span
              class="text-[11px] text-fg-subtle tracking-wide uppercase font-semibold"
            >
              🎨 Theme
            </span>
            <span class="text-fg-subtle">›</span>
          </span>
          <span class="block text-sm font-semibold">{{
            overlayThemeName
          }}</span>
          <span class="block text-[10px] text-fg-subtle">
            Scoreboard: {{ scoreboardThemeName }}
          </span>
        </button>
        <button
          type="button"
          disabled
          class="p-3 bg-surface border border-border rounded-md text-left flex flex-col gap-1.5 opacity-60 cursor-not-allowed"
          title="Custom team colors land in v1.x"
        >
          <span class="flex justify-between items-center">
            <span
              class="text-[11px] text-fg-subtle tracking-wide uppercase font-semibold"
            >
              🖌 Colors
            </span>
            <span class="text-fg-subtle">soon</span>
          </span>
          <span class="text-sm font-semibold inline-flex items-center gap-1.5">
            <span class="size-3.5 rounded-sm bg-team-a" />
            <span class="size-3.5 rounded-sm bg-team-b" />
            Red / Blue
          </span>
        </button>
      </div>
    </div>

    <ThemePickerSheet
      v-model:open="themeSheetOpen"
      :overlay-theme="overlayTheme"
      :scoreboard-theme="scoreboardTheme"
      @pick="onPickTheme"
    />
  </div>
</template>
