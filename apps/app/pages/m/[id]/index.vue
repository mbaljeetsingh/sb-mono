<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import { useClipboard, useStorage } from "@vueuse/core";
import { ChevronDown, ChevronUp, Clipboard, Settings } from "lucide-vue-next";
import { toast } from "vue-sonner";
import { themes as themeRegistry, type ThemeSurface } from "@sb/themes";
import { Button } from "@sb/layer-ui/components/ui/button";
import ThemePickerDialog from "~/components/match/ThemePickerDialog.vue";

// Uses default layout (AppHeader at top, max-w-6xl content wrapper).
useSeoMeta({ title: "Match" });

const route = useRoute();
const matchId = computed(() => String(route.params.id ?? ""));
const { state, config, events } = useMatchState(matchId);
const { teamNames } = useMatchMeta(matchId);

const showAllUrls = ref(false);
const baseUrl = computed(() => {
  if (typeof window === "undefined") return "";
  return window.location.origin;
});

// Per-match theme selection — reactive useStorage ref auto-persists on every
// change AND syncs across same-domain tabs. The overlay/scoreboard surfaces
// pick up choices via `?theme=` in the URLs we build below.
type ThemeChoice = { overlay: string; scoreboard: string };
const themeChoice = useStorage<ThemeChoice>(
  computed(() => `sb:theme:${matchId.value}`),
  { overlay: "broadcast-classic", scoreboard: "filmable" },
  undefined,
  { mergeDefaults: true },
);
const overlayTheme = computed({
  get: () => themeChoice.value.overlay,
  set: (v) => {
    themeChoice.value = { ...themeChoice.value, overlay: v };
  },
});
const scoreboardTheme = computed({
  get: () => themeChoice.value.scoreboard,
  set: (v) => {
    themeChoice.value = { ...themeChoice.value, scoreboard: v };
  },
});
const themeSheetOpen = ref(false);

const onPickTheme = ({
  surface,
  id,
}: {
  surface: ThemeSurface;
  id: string;
}) => {
  if (surface === "overlay") overlayTheme.value = id;
  if (surface === "scoreboard") scoreboardTheme.value = id;
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
  if (events.value.length === 0) return "Ready · 0 events";
  return `Game ${state.value.games.length} · ${score("a")}–${score("b")}`;
});

const { copy: clipboardCopy } = useClipboard({ legacy: true });
const copy = async (text: string, label = "URL") => {
  await clipboardCopy(text);
  toast.success(`${label} copied`);
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
      <Button
        variant="ghost"
        size="icon"
        aria-label="Settings (coming in v1.x)"
        title="Match settings (court, round, category, venue) — coming in v1.x"
        disabled
      >
        <Settings class="size-4" />
      </Button>
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
              {{ config.displayName }}
              {{
                config.gamesToWin > 1
                  ? ` · BO${config.gamesToWin * 2 - 1}`
                  : " · Single"
              }}
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
        <Button
          type="button"
          variant="outline"
          class="h-auto justify-start gap-3 p-3 text-left whitespace-normal"
          @click="openControl"
        >
          <span
            class="size-7 rounded-full bg-surface-2 text-fg-muted inline-flex items-center justify-center text-[13px] font-bold shrink-0"
          >
            1
          </span>
          <span class="flex-1 min-w-0">
            <span class="block text-sm font-semibold"
              >Score from your phone</span
            >
            <span class="block text-xs text-fg-muted mt-0.5 font-normal"
              >Open Control on this device</span
            >
          </span>
          <span
            class="px-3 h-8 inline-flex items-center justify-center rounded-md bg-primary text-primary-foreground text-xs font-semibold"
          >
            Open Control
          </span>
        </Button>

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
          <Button
            type="button"
            variant="secondary"
            size="sm"
            @click="copy(urls.overlay, 'Overlay URL')"
          >
            Copy URL
          </Button>
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
      <Button
        type="button"
        variant="secondary"
        class="w-full justify-between font-medium"
        @click="showAllUrls = !showAllUrls"
      >
        <span>Show all URLs &amp; QR codes</span>
        <component :is="showAllUrls ? ChevronUp : ChevronDown" class="size-4" />
      </Button>
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
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Copy"
              @click="copy(urls.control, 'Control URL')"
            >
              <Clipboard class="size-4" />
            </Button>
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
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Copy"
              @click="copy(urls[label as keyof typeof urls], `${key} URL`)"
            >
              <Clipboard class="size-4" />
            </Button>
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
        <Button
          type="button"
          variant="outline"
          class="h-auto flex-col items-stretch gap-1.5 p-3 text-left whitespace-normal"
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
          <span class="block text-[10px] text-fg-subtle font-normal">
            Scoreboard: {{ scoreboardThemeName }}
          </span>
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled
          class="h-auto flex-col items-stretch gap-1.5 p-3 text-left whitespace-normal"
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
        </Button>
      </div>
    </div>

    <ThemePickerDialog
      v-model:open="themeSheetOpen"
      :overlay-theme="overlayTheme"
      :scoreboard-theme="scoreboardTheme"
      @pick="onPickTheme"
    />
  </div>
</template>
