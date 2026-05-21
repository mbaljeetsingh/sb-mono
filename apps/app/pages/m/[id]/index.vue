<script setup lang="ts">
import { computed, ref } from "vue";
import { useClipboard } from "@vueuse/core";
import { Film, QrCode, Settings } from "lucide-vue-next";
import { toast } from "vue-sonner";
import { type ThemeSurface } from "@sb/themes";
import type { MatchMeta } from "@sb/layer-app-base/composables/useMatchMeta";
import { Button } from "@sb/layer-ui/components/ui/button";
import MatchHeroCard from "~/components/match/MatchHeroCard.vue";
import LookAndFeelCards from "~/components/match/LookAndFeelCards.vue";
import SettingsSheet from "~/components/match/SettingsSheet.vue";
import ThemePickerDialog from "~/components/match/ThemePickerDialog.vue";
import QrDialog from "~/components/match/QrDialog.vue";
import { useUserStore } from "~/stores/user";
import { useRolePermissions } from "~/composables/useRolePermissions";

useSeoMeta({ title: "Match" });

const route = useRoute();
const matchId = computed(() => String(route.params.id ?? ""));
const { state, config, events } = useMatchState(matchId);
const { meta, teamNames, flush: flushMeta } = useMatchMeta(matchId);

// Explicit handler — relying on `v-model:meta="meta"` to auto-translate
// `meta = $event` to `meta.value = $event` is unreliable in template event
// handlers for top-level setup refs. Wiring the setter from setup-script
// JS removes the ambiguity: meta.value gets reassigned, the watch fires.
const onMetaUpdate = (v: MatchMeta) => {
  meta.value = v;
};

const settingsOpen = ref(false);

// Flushing the debounced upsert here means closing the sheet awaits the
// Supabase write — so the matches list (or any other reader fetched right
// after) reflects the new team names instead of the "Team A / Team B"
// placeholder fallback.
const onSettingsClose = async () => {
  try {
    await flushMeta();
  } finally {
    settingsOpen.value = false;
  }
};

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

const themeSheetOpen = ref(false);

// Shared QR enlarge dialog. Each Get Setup row opens it with the right URL +
// per-surface description; the dialog itself shows the big scannable QR + copy.
const qrOpen = ref(false);
const qrUrl = ref("");
const qrTitle = ref("");
const qrDescription = ref<string | undefined>(undefined);
const qrSensitive = ref(false);
const openQr = (opts: {
  url: string;
  title: string;
  description?: string;
  sensitive?: boolean;
}) => {
  qrUrl.value = opts.url;
  qrTitle.value = opts.title;
  qrDescription.value = opts.description;
  qrSensitive.value = !!opts.sensitive;
  qrOpen.value = true;
};

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
        <div
          class="p-3 bg-surface border border-border rounded-md flex gap-3 items-center"
        >
          <span
            class="size-7 rounded-full bg-surface-2 text-fg-muted inline-flex items-center justify-center text-[13px] font-bold flex-shrink-0"
          >
            1
          </span>
          <span class="flex-1 min-w-0">
            <span class="block text-sm font-semibold">
              Score from your phone
            </span>
            <span class="block text-xs text-fg-muted mt-0.5">
              Open on this device, or scan to score from another
            </span>
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Show Control URL as QR code"
            title="Scan with another device to score there"
            @click="
              openQr({
                url: urls.control,
                title: 'Control',
                description: 'Scan with the device you want to score on.',
                sensitive: true,
              })
            "
          >
            <QrCode class="size-4" />
          </Button>
          <Button
            as="a"
            type="button"
            variant="default"
            size="sm"
            :href="`/m/${matchId}/control`"
          >
            Open Control
          </Button>
        </div>

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

        <div
          class="p-3 bg-surface border border-border rounded-md flex gap-3 items-center"
        >
          <span
            class="size-7 rounded-full bg-surface-2 text-fg-muted inline-flex items-center justify-center text-[13px] font-bold flex-shrink-0"
          >
            3
          </span>
          <span class="flex-1 min-w-0">
            <span class="block text-sm font-semibold">Show on venue TV</span>
            <span class="block text-xs text-fg-muted mt-0.5">
              Scan from a TV/tablet, or open here
            </span>
          </span>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Show Scoreboard URL as QR code"
            title="Scan from a TV / second screen"
            @click="
              openQr({
                url: urls.scoreboard,
                title: 'Scoreboard',
                description:
                  'Scan from a TV / second screen to display the live scoreboard.',
              })
            "
          >
            <QrCode class="size-4" />
          </Button>
          <Button
            as="a"
            type="button"
            variant="secondary"
            size="sm"
            :href="urls.scoreboard"
            target="_blank"
            rel="noopener"
          >
            Open
          </Button>
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
      @close="onSettingsClose"
      @deleted="onMatchDeleted"
    />

    <QrDialog
      v-model:open="qrOpen"
      :url="qrUrl"
      :title="qrTitle"
      :description="qrDescription"
      :sensitive="qrSensitive"
    />
  </div>
</template>
