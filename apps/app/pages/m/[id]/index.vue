<script setup lang="ts">
import { computed, ref } from "vue";
import { useClipboard } from "@vueuse/core";
import {
  ChevronDown,
  ChevronUp,
  Clipboard,
  Film,
  Settings,
} from "lucide-vue-next";
import { toast } from "vue-sonner";
import { type ThemeSurface } from "@sb/themes";
import type { MatchMeta } from "@sb/layer-app-base/composables/useMatchMeta";
import { Button } from "@sb/layer-ui/components/ui/button";
import MatchHeroCard from "~/components/match/MatchHeroCard.vue";
import LookAndFeelCards from "~/components/match/LookAndFeelCards.vue";
import SettingsSheet from "~/components/match/SettingsSheet.vue";
import ThemePickerDialog from "~/components/match/ThemePickerDialog.vue";
import { useUserStore } from "~/stores/user";
import { useRolePermissions } from "~/composables/useRolePermissions";

useSeoMeta({ title: "Match" });

const route = useRoute();
const matchId = computed(() => String(route.params.id ?? ""));
const { state, config, events } = useMatchState(matchId);
const { meta, teamNames } = useMatchMeta(matchId);

// Explicit handler — relying on `v-model:meta="meta"` to auto-translate
// `meta = $event` to `meta.value = $event` is unreliable in template event
// handlers for top-level setup refs. Wiring the setter from setup-script
// JS removes the ambiguity: meta.value gets reassigned, the watch fires.
const onMetaUpdate = (v: MatchMeta) => {
  meta.value = v;
};

const settingsOpen = ref(false);

const userStore = useUserStore();
const { isAdmin } = useRolePermissions();
const onMatchDeleted = () => {
  settingsOpen.value = false;
  navigateTo(userStore.isAuthenticated ? "/matches" : "/");
};
const {
  overlay: overlayTheme,
  scoreboard: scoreboardTheme,
  overlayName,
  scoreboardName,
} = useThemeChoice(matchId);
const urls = useMatchUrls(matchId);

const showAllUrls = ref(false);
const themeSheetOpen = ref(false);

const score = (side: "a" | "b") => {
  const last = state.value.games[state.value.games.length - 1];
  return last ? last[side] : 0;
};

const displayName = computed(
  () =>
    `${config.value.displayName}${
      config.value.gamesToWin > 1
        ? ` · BO${config.value.gamesToWin * 2 - 1}`
        : " · Single"
    }`,
);

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
</script>

<template>
  <div class="font-sans pb-8">
    <div class="flex items-center justify-between px-4 pt-4 pb-2">
      <span class="text-[13px] font-semibold text-fg-subtle">
        Match · {{ matchId.slice(0, 8) }}…
      </span>
      <div class="flex items-center gap-1">
        <Button
          v-if="isAdmin"
          variant="ghost"
          size="icon"
          aria-label="Render video"
          title="Post-game render (beta · admin only)"
          @click="navigateTo(`/m/${matchId}/render`)"
        >
          <Film class="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Match settings"
          title="Match settings — edit team names, tournament info"
          @click="settingsOpen = true"
        >
          <Settings class="size-4" />
        </Button>
      </div>
    </div>

    <div class="px-4 pt-2 pb-4">
      <MatchHeroCard
        :match-over="state.matchOver"
        :display-name="displayName"
        :status-label="statusLabel"
        :team-names="teamNames"
        :total-slots="config.gamesToWin + 1"
        :score-a="score('a')"
        :score-b="score('b')"
        :games-won-a="state.gamesWon.a"
        :games-won-b="state.gamesWon.b"
      />
    </div>

    <div class="px-4 pb-4">
      <div
        class="text-[11px] font-semibold tracking-[0.06em] uppercase text-fg-subtle mb-2.5"
      >
        Get set up
      </div>
      <div class="flex flex-col gap-2">
        <Button
          as="a"
          variant="outline"
          :href="`/m/${matchId}/control`"
          class="h-auto justify-start gap-3 p-3 text-left whitespace-normal"
        >
          <span
            class="size-7 rounded-full bg-surface-2 text-fg-muted inline-flex items-center justify-center text-[13px] font-bold shrink-0"
          >
            1
          </span>
          <span class="flex-1 min-w-0">
            <span class="block text-sm font-semibold">
              Score from your phone
            </span>
            <span class="block text-xs text-fg-muted mt-0.5 font-normal">
              Open Control on this device · ⌘/Ctrl+click for new tab
            </span>
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
            <span class="block text-xs text-fg-muted mt-0.5">
              Paste URL into a Browser source
            </span>
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
              >
                Sensitive
              </span>
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

    <div class="px-4 pb-4">
      <LookAndFeelCards
        :overlay-theme-name="overlayName"
        :scoreboard-theme-name="scoreboardName"
        @open-theme="themeSheetOpen = true"
      />
    </div>

    <ThemePickerDialog
      v-model:open="themeSheetOpen"
      :overlay-theme="overlayTheme"
      :scoreboard-theme="scoreboardTheme"
      @pick="onPickTheme"
    />

    <SettingsSheet
      v-if="settingsOpen"
      :match-id="matchId"
      :meta="meta"
      @update:meta="onMetaUpdate"
      @close="settingsOpen = false"
      @deleted="onMatchDeleted"
    />
  </div>
</template>
